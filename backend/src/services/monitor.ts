import cron from "node-cron";
import {
  getActiveSubscriptions,
  getEpisodesBySubscription,
  getTorrentsBySubscription,
  createEpisode,
  updateEpisode,
  getSubscriptionById,
  Subscription,
  Episode,
  createTorrent,
  updateSubscription,
} from "../db/models";
import * as tmdb from "./tmdb";
import * as bgm from "./bgm";
import * as rss from "./rss";
import * as ai from "./ai";
import * as qbittorrent from "./qbittorrent";
import * as fileManager from "./fileManager";
import { getSetting } from "../db/settings";
import { join } from "path";

// ---- Job Tracking ----

export interface JobStatus {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  nextRunAt: string | null;
}

interface JobEntry {
  name: string;
  description: string;
  schedule: string;
  running: boolean;
  lastRunAt: Date | null;
  lastRunDurationMs: number | null;
  lastRunError: string | null;
  task: ReturnType<typeof cron.schedule> | null;
  fn: () => Promise<void>;
}

const jobs: Map<string, JobEntry> = new Map();

function computeNextRun(expression: string, from: Date): Date | null {
  // Simple cron next-run calculator for standard 5-field cron expressions
  // Format: minute hour day-of-month month day-of-week
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const parseField = (field: string, min: number, max: number): number[] => {
    const values: number[] = [];
    for (const part of field.split(",")) {
      if (part === "*") {
        for (let i = min; i <= max; i++) values.push(i);
      } else if (part.includes("/")) {
        const [range, stepStr] = part.split("/");
        const step = parseInt(stepStr);
        const start = range === "*" ? min : parseInt(range);
        for (let i = start; i <= max; i += step) values.push(i);
      } else if (part.includes("-")) {
        const [a, b] = part.split("-").map(Number);
        for (let i = a; i <= b; i++) values.push(i);
      } else {
        values.push(parseInt(part));
      }
    }
    return values.sort((a, b) => a - b);
  };

  const minutes = parseField(parts[0], 0, 59);
  const hours = parseField(parts[1], 0, 23);
  const daysOfMonth = parseField(parts[2], 1, 31);
  const months = parseField(parts[3], 1, 12);
  const daysOfWeek = parseField(parts[4], 0, 6);

  const isWildcardDom = parts[2] === "*";
  const isWildcardDow = parts[4] === "*";

  // Brute-force search for next matching minute in the next 366 days
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // start from next minute

  for (let i = 0; i < 366 * 24 * 60; i++) {
    const m = candidate.getMinutes();
    const h = candidate.getHours();
    const dom = candidate.getDate();
    const mon = candidate.getMonth() + 1;
    const dow = candidate.getDay();

    if (
      minutes.includes(m) &&
      hours.includes(h) &&
      months.includes(mon) &&
      (isWildcardDom || daysOfMonth.includes(dom)) &&
      (isWildcardDow || daysOfWeek.includes(dow))
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

function registerJob(name: string, description: string, schedule: string, fn: () => Promise<void>) {
  const entry: JobEntry = {
    name,
    description,
    schedule,
    running: false,
    lastRunAt: null,
    lastRunDurationMs: null,
    lastRunError: null,
    task: null,
    fn,
  };

  entry.task = cron.schedule(schedule, () => {
    runJobInternal(entry);
  });

  jobs.set(name, entry);
}

async function runJobInternal(entry: JobEntry) {
  if (entry.running) {
    console.log(`Job "${entry.name}" already running, skipping.`);
    return;
  }

  entry.running = true;
  entry.lastRunError = null;
  const start = Date.now();
  console.log(`Running job: ${entry.name}`);

  try {
    await entry.fn();
  } catch (err: any) {
    entry.lastRunError = err?.message || String(err);
    console.error(`Job "${entry.name}" failed:`, err);
  } finally {
    entry.lastRunAt = new Date();
    entry.lastRunDurationMs = Date.now() - start;
    entry.running = false;
  }
}

export function getJobStatuses(): JobStatus[] {
  return Array.from(jobs.values()).map((j) => ({
    name: j.name,
    description: j.description,
    schedule: j.schedule,
    running: j.running,
    lastRunAt: j.lastRunAt?.toISOString() ?? null,
    lastRunDurationMs: j.lastRunDurationMs,
    lastRunError: j.lastRunError,
    nextRunAt: computeNextRun(j.schedule, new Date())?.toISOString() ?? null,
  }));
}

export async function runJobNow(name: string): Promise<boolean> {
  const entry = jobs.get(name);
  if (!entry) return false;
  // Run in background, don't await
  runJobInternal(entry);
  return true;
}

const JOB_SCHEDULES = {
  checkNewEpisodes: "0 0 * * *", // Every day at midnight
  searchAndDownload: "0 * * * *", // Every hour
  monitorDownloads: "*/5 * * * *", // Every 5 minutes
};

export function startMonitor() {
  console.log("Starting background monitor...");

  registerJob("checkNewEpisodes", "Check TMDB for newly aired episodes", JOB_SCHEDULES.checkNewEpisodes, checkNewEpisodes);
  registerJob("searchAndDownload", "Search RSS feeds and start downloads", JOB_SCHEDULES.searchAndDownload, searchAndDownload);
  registerJob("monitorDownloads", "Monitor active downloads and organize files", JOB_SCHEDULES.monitorDownloads, monitorDownloads);

  // Initial run on startup
  const entry = jobs.get("checkNewEpisodes");
  if (entry) runJobInternal(entry);
}

async function checkNewEpisodes() {
  const subscriptions = getActiveSubscriptions();

  for (const sub of subscriptions) {
    if (sub.source === "tvdb" && sub.media_type === "tv") {
      try {
        await processTVSubscription(sub);
      } catch (err) {
        console.error(`Error processing TV sub ${sub.title}:`, err);
      }
    }
    if (sub.source === "bgm" && sub.media_type !== "movie") {
      try {
        await processBgmSubscription(sub);
      } catch (err) {
        console.error(`Error processing BGM sub ${sub.title}:`, err);
      }
    }
    // Movies are single-item, handled by status check usually,
    // but we can check if a movie "Just Released" here if we want to change status to 'searching'.
    // For now, assuming movies in 'active' status are ready to be searched.
  }
}

async function processTVSubscription(sub: Subscription) {
  // If season_number is specified, only track that season.
  // Otherwise, track the latest season or all?
  // For simplicity, let's look at the latest aired season from TMDB.
  
  let seasonData;
  if (sub.season_number) {
    seasonData = await tmdb.getSeasonDetail(sub.source_id, sub.season_number);
  } else {
    // Fetch show detail to find latest season
    const showDetail = await tmdb.getTVDetail(sub.source_id);
    const lastSeason = showDetail.seasons[showDetail.seasons.length - 1];
    if (lastSeason) {
      seasonData = await tmdb.getSeasonDetail(sub.source_id, lastSeason.season_number);
    }
  }

  if (!seasonData) return;

  const existingEpisodes = getEpisodesBySubscription(sub.id);
  const existingEpMap = new Set(existingEpisodes.map((e) => e.episode_number));

  const today = new Date().toISOString().split("T")[0];

  for (const ep of seasonData.episodes) {
    if (ep.air_date && ep.air_date <= today && !existingEpMap.has(ep.episode_number)) {
      // New episode aired!
      console.log(`Found new episode for ${sub.title}: S${seasonData.season_number}E${ep.episode_number}`);
      createEpisode({
        subscription_id: sub.id,
        episode_number: ep.episode_number,
        title: ep.name,
        air_date: ep.air_date,
        overview: ep.overview,
        still_path: ep.still_path,
        status: "pending",
        torrent_hash: null,
        file_path: null,
      });
    }
  }
}

async function processBgmSubscription(sub: Subscription) {
  const episodes = await bgm.getAllEpisodes(sub.source_id, { type: 0 });
  const existingEpisodes = getEpisodesBySubscription(sub.id);
  const existingEpMap = new Set(existingEpisodes.map((e) => e.episode_number));

  const today = new Date().toISOString().split("T")[0];

  for (const ep of episodes) {
    const numberRaw = ep.ep ?? ep.sort;
    const episodeNumber = Number(numberRaw);
    if (!Number.isInteger(episodeNumber) || episodeNumber <= 0) continue;
    if (existingEpMap.has(episodeNumber)) continue;
    if (!ep.airdate || ep.airdate > today) continue;

    createEpisode({
      subscription_id: sub.id,
      episode_number: episodeNumber,
      title: ep.name_cn || ep.name || null,
      air_date: ep.airdate,
      overview: ep.desc || null,
      still_path: null,
      status: "pending",
      torrent_hash: null,
      file_path: null,
    });
  }
}

async function searchAndDownload() {
  // 1. Handle Pending Episodes
  const subscriptions = getActiveSubscriptions();

  for (const sub of subscriptions) {
    if (sub.media_type === "tv" || sub.media_type === "anime") {
      const episodes = getEpisodesBySubscription(sub.id);
      const pendingEps = episodes.filter((e) => e.status === "pending");

      if (pendingEps.length === 0) continue;

      // Search for the show once (optimization)
      // Or search per episode? RSS usually returns latest.
      // Better to search "Show Name Season X"
      const query = `${sub.title} ${sub.season_number ? "Season " + sub.season_number : ""}`;
      const searchResults = await rss.searchTorrents(query);

      for (const ep of pendingEps) {
        // Try to match matching results
        for (const item of searchResults) {
          const parseResult = item.ai;
          if (!parseResult) continue;

          // AI Logic matching
          const nameMatch = 
            parseResult.englishTitle?.toLowerCase().includes(sub.title.toLowerCase()) || 
            parseResult.chineseTitle?.toLowerCase().includes(sub.title.toLowerCase()) || 
            sub.title.toLowerCase().includes(parseResult.englishTitle?.toLowerCase() || "") ||
            sub.title.toLowerCase().includes(parseResult.chineseTitle?.toLowerCase() || "");
          // Ideally use fuzzy match or TMDB comparison
          
          if (nameMatch && parseResult.episodeNumber === ep.episode_number) {
            // Check season if we have it
             // If sub has season_number, match it. 
             // Let's rely on strict match if both are present.
            if (sub.season_number && parseResult.seasonNumber && parseResult.seasonNumber !== sub.season_number) {
               continue;
            }

            console.log(`Found match for ${sub.title} Ep ${ep.episode_number}: ${item.title}`);
            
            try {
              // Add to qBittorrent
              // Save to path: "downloads/anime/Show Name" (temp download path)
              // We'll let qbit manage the temp path, move later.
              await qbittorrent.addTorrentByUrl(item.link, "nas-tools-monitored");
              
              const torrentInfo = (await qbittorrent.getTorrents({ filter: "all" })).find(t => t.name === item.title || t.magnet_uri === item.link); // Approximate find to get hash
              // Actually qbit addTorrent doesn't return hash.
              // We might need to wait or rely on rss 'link' if it's a magnet, or fetch the hash from response if possible?
              // `addTorrentByUrl` return is "Ok.".
              // Workaround: Fetch list and match name closest or assume it's added.
              // For robustness, let's assume we can find it by name or we have to wait a sec.
              
              // Let's create Torrent record with null hash for now, or skip if we can't find it?
              // Better: just mark status 'downloading' and fill hash in the monitor step if possible, or try to get hash from text if magnet.
              
              let hash = null;
              if (item.link.startsWith("magnet:?xt=urn:btih:")) {
                 hash = item.link.split("xt=urn:btih:")[1].split("&")[0].toLowerCase();
              }

              updateEpisode(ep.id, {
                status: "downloading",
                torrent_hash: hash // might be null if .torrent file
              });

              createTorrent({
                subscription_id: sub.id,
                episode_id: ep.id,
                title: item.title,
                link: item.link,
                hash: hash,
                size: item.ai?.size || item.torrent?.contentLength || null,
                source: item.source,
                status: "downloading",
                download_path: null // unknown yet
              });

              break; // Found one, move to next episode
            } catch (err) {
              console.error(`Failed to add torrent ${item.title}`, err);
            }
          }
        }
      }

    } else if (sub.media_type === "movie" && sub.status === "active") {
        // Simple movie logic
        const query = sub.title;
        const searchResults = await rss.searchTorrents(query);
        for (const item of searchResults) {
            const parseResult = item.ai;
            if (!parseResult) continue;
            
            const nameMatch = 
              parseResult.englishTitle?.toLowerCase().includes(sub.title.toLowerCase()) || 
              parseResult.chineseTitle?.toLowerCase().includes(sub.title.toLowerCase()) || 
              sub.title.toLowerCase().includes(parseResult.englishTitle?.toLowerCase() || "") ||
              sub.title.toLowerCase().includes(parseResult.chineseTitle?.toLowerCase() || "");

            if (nameMatch) {
                 console.log(`Found movie match: ${item.title}`);
                 try {
                     await qbittorrent.addTorrentByUrl(item.link, "nas-tools-movies");
                     
                     let hash = null;
                     if (item.link.startsWith("magnet:?xt=urn:btih:")) {
                        hash = item.link.split("xt=urn:btih:")[1].split("&")[0].toLowerCase();
                     }

                     updateSubscription(sub.id, { status: "downloading" });
                     createTorrent({
                        subscription_id: sub.id,
                        episode_id: null,
                        title: item.title,
                        link: item.link,
                        hash: hash,
                        size: item.ai?.size || item.torrent?.contentLength || null,
                        source: item.source,
                        status: "downloading",
                        download_path: null
                     });
                     
                     break; 
                 } catch (err) {
                     console.error("Movie add error", err);
                 }
            }
        }
    }
  }
}

async function monitorDownloads() {
  // Check Active processing episodes/movies
  // We need to look at our Torrent table to know what we are tracking.
  // Or just "downloading" episodes.
  
  // Strategy: Get all 'downloading' Episodes
  // And all 'downloading' Movies (Subscriptions).
  // Actually, easier to iterate ACTIVE Torrents from our DB.
  
  // Need a function getActiveTorrents() in models? 
  // For now, let's fetch all subscriptions, then their torrents.
  // Or just iterate QBittorrent list and match with our hashes.
  
  let qbitTorrents;
  try {
    qbitTorrents = await qbittorrent.getTorrents();
  } catch(e) { 
    console.error("QBit connection validation", e);
    return;
  }

  const subscriptions = getActiveSubscriptions();
  
  for (const sub of subscriptions) {
    if (sub.source !== "tvdb") continue;
    if (sub.media_type === "tv") {
          const episodes = getEpisodesBySubscription(sub.id).filter(e => e.status === "downloading");
          for (const ep of episodes) {
             if (!ep.torrent_hash) {
                 // Try to recover hash if we missed it
                 // Look for title match in qbitTorrents?
                 // Skip for now.
                 continue;
             }
             
             const torrent = qbitTorrents.find(t => t.hash.toLowerCase() === ep.torrent_hash!.toLowerCase());
             if (torrent) {
                 if (torrent.state === "uploading" || torrent.state === "stalledUP" || torrent.state === "pausedUP" || torrent.progress === 1) {
                     // Finished!
                     console.log(`Download complete: ${ep.title}`);
                     
                     // Move file
                     // torrent.content_path could be file or folder.
                     let sourceFile = torrent.content_path;
                     const files = fileManager.findVideoFiles(torrent.content_path);
                     if (files.length > 0) {
                         // Pick largest video file?
                         // Sort by size
                         // For now check just one.
                         sourceFile = files[0]; // Naive
                     }
                     
                     try {
                        const seasonNum = sub.season_number || 1; // Default to season 1 folder if unknown? Or look up episode's mapping?
                        // DB Models: Subscription has season_number usually.
                        
                        const destDir = fileManager.createMediaFolder("tv", sub.title, seasonNum);
                        const ext = sourceFile.split('.').pop();
                        const newName = `${sub.title} - S${String(seasonNum).padStart(2, '0')}E${String(ep.episode_number).padStart(2,'0')}.${ext}`;
                        
                        const finalPath = fileManager.moveFileToMediaDir(sourceFile, destDir, newName);
                        
                        updateEpisode(ep.id, {
                            status: "completed",
                            file_path: finalPath
                        });
                        
                        // Cleanup torrent?
                        // await qbittorrent.deleteRequest(torrent.hash); 
                     } catch(err) {
                         console.error("Move file error", err);
                     }
                 }
             }
          }
      } else if (sub.media_type === "movie" && sub.status === "downloading") {
           const torrents = getTorrentsBySubscription(sub.id);
           // Assume the latest torrent is the active one
           const activeTorrentRecord = torrents[0];
           
           if (activeTorrentRecord && activeTorrentRecord.hash) {
             const torrent = qbitTorrents.find(t => t.hash.toLowerCase() === activeTorrentRecord.hash!.toLowerCase());
             if (torrent) {
                if (torrent.state === "uploading" || torrent.state === "stalledUP" || torrent.state === "pausedUP" || torrent.progress === 1) {
                    console.log(`Movie download complete: ${sub.title}`);
                    
                    let sourceFile = torrent.content_path;
                    const files = fileManager.findVideoFiles(torrent.content_path);
                    if (files.length > 0) sourceFile = files[0];

                    try {
                        const destDir = fileManager.createMediaFolder("movie", sub.title);
                        // For movies, we usually name it "Movie Title (Year).ext" or similar.
                        // We have sub.title.
                        const ext = sourceFile.split('.').pop();
                        const newName = `${sub.title}.${ext}`;

                        fileManager.moveFileToMediaDir(sourceFile, destDir, newName);

                        updateSubscription(sub.id, { status: "completed" });
                        // update torrent status?
                    } catch(err) {
                        console.error("Movie move error", err);
                    }
                }
             }
           }
      }
  }
}
