"use client";

import { useState } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import {
  downloadTorrent,
  searchTorrents,
  type Episode,
  type RSSItem,
  type Subscription,
} from "@/lib/api";

type ExpandedSubscriptionProps = {
  sub: Subscription;
  onUpdate: () => void;
};

type EpisodeReleaseInfo = {
  status: "Released" | "Upcoming" | "TBA";
  date: string;
  released: boolean;
};

type FileStatusTone = "success" | "warning" | "muted";

type FileStatus = {
  label: string;
  tone: FileStatusTone;
};

export default function ExpandedSubscription({
  sub,
  onUpdate,
}: ExpandedSubscriptionProps) {
  const [episodeSearchOpen, setEpisodeSearchOpen] = useState(false);
  const [episodeSearchTarget, setEpisodeSearchTarget] = useState<Episode | null>(
    null
  );
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState("");
  const [episodeSearchResults, setEpisodeSearchResults] = useState<RSSItem[]>([]);
  const [episodeSearchLoading, setEpisodeSearchLoading] = useState(false);
  const [episodeDownloading, setEpisodeDownloading] = useState<string | null>(
    null
  );

  const todayStr = new Date().toISOString().split("T")[0];

  function getReleaseInfo(ep: Episode): EpisodeReleaseInfo {
    if (!ep.air_date) {
      return { status: "TBA", date: "TBA", released: false };
    }
    const released = ep.air_date <= todayStr;
    return {
      status: released ? "Released" : "Upcoming",
      date: ep.air_date,
      released,
    };
  }

  function getFileStatus(ep: Episode, released: boolean): FileStatus | null {
    if (!released) return null;
    if (ep.file_path) {
      return {
        label: "File exists in target folder (finished)",
        tone: "success",
      };
    }
    if (ep.status === "completed" || ep.status === "moved") {
      return { label: "Download finished, not moved to target", tone: "warning" };
    }
    if (ep.status === "downloaded") {
      return { label: "Download finished, not moved to target", tone: "warning" };
    }
    if (ep.status === "downloading") {
      return { label: "Downloading", tone: "warning" };
    }
    if (ep.status === "pending") {
      if (ep.air_date) {
        const releasedAt = new Date(`${ep.air_date}T00:00:00`);
        const daysSinceRelease =
          (Date.now() - releasedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRelease >= 2) {
          return { label: "No torrent link found", tone: "muted" };
        }
      }
      return { label: "Not started", tone: "muted" };
    }
    return { label: ep.status, tone: "muted" };
  }

  function hasTorrentAdded(ep: Episode) {
    if (ep.torrent_hash) return true;
    return ["downloading", "downloaded", "completed", "moved"].includes(
      ep.status
    );
  }

  async function openEpisodeSearch(ep: Episode) {
    setEpisodeSearchTarget(ep);
    setEpisodeSearchQuery(sub.title);
    setEpisodeSearchResults([]);
    setEpisodeSearchOpen(true);
    await runEpisodeSearch(sub.title, ep);
  }

  async function runEpisodeSearch(query: string, target?: Episode | null) {
    const ep = target ?? episodeSearchTarget;
    if (!ep) return;
    const season = sub.season_number ?? undefined;
    try {
      setEpisodeSearchLoading(true);
      const results = await searchTorrents(query, {
        season,
        episode: ep.episode_number,
      });
      setEpisodeSearchResults(results);
    } catch (err: any) {
      console.error(err);
    } finally {
      setEpisodeSearchLoading(false);
    }
  }

  async function handleEpisodeDownload(item: RSSItem) {
    if (!episodeSearchTarget) return;
    try {
      setEpisodeDownloading(item.link);
      await downloadTorrent({
        subscription_id: sub.id,
        episode_id: episodeSearchTarget.id,
        title: item.title,
        link: item.link,
        source: item.source,
      });
      alert("Torrent added to qBittorrent!");
      setEpisodeSearchOpen(false);
      setEpisodeSearchTarget(null);
      onUpdate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEpisodeDownloading(null);
    }
  }

  return (
    <div className="border-t border-border p-4 space-y-4">
      {sub.episodes && sub.episodes.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Episodes</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sub.episodes.map((ep: Episode) => {
              const release = getReleaseInfo(ep);
              const fileStatus = getFileStatus(ep, release.released);
              const canSearch = release.released && !hasTorrentAdded(ep);

              return (
                <div
                  key={ep.id}
                  className="flex items-start gap-3 p-3 bg-background rounded-lg text-sm"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      E{String(ep.episode_number).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {release.date}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate">
                        {ep.title || `Episode ${ep.episode_number}`}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          release.released
                            ? "bg-success/20 text-success"
                            : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        {release.status}
                      </span>
                    </div>
                    {fileStatus && (
                      <div className="mt-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            fileStatus.tone === "success"
                              ? "bg-success/20 text-success"
                              : fileStatus.tone === "warning"
                              ? "bg-warning/20 text-warning"
                              : "bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {fileStatus.label}
                        </span>
                      </div>
                    )}
                  </div>
                  {canSearch && (
                    <button
                      onClick={() => openEpisodeSearch(ep)}
                      className="p-1.5 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Search torrents for this episode"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sub.folder_path && (
        <p className="text-xs text-muted-foreground">Folder: {sub.folder_path}</p>
      )}

      {episodeSearchOpen && episodeSearchTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-20 z-50">
          <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">
                  Search Episode Torrents
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  E{String(episodeSearchTarget.episode_number).padStart(2, "0")} ·{" "}
                  {episodeSearchTarget.title || "Episode"}
                </p>
              </div>
              <button
                onClick={() => {
                  setEpisodeSearchOpen(false);
                  setEpisodeSearchTarget(null);
                }}
                className="p-1 hover:bg-secondary rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={episodeSearchQuery}
                  onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && runEpisodeSearch(e.currentTarget.value)
                  }
                  placeholder={sub.title}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => runEpisodeSearch(episodeSearchQuery || sub.title)}
                  disabled={episodeSearchLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {episodeSearchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2">
              {episodeSearchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {episodeSearchLoading
                    ? "Searching..."
                    : "No results yet. Try searching."}
                </p>
              ) : (
                episodeSearchResults.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 bg-background rounded-lg text-sm group"
                  >
                    <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                      {item.source}
                    </span>
                    <span className="flex-1 truncate text-xs" title={item.title}>
                      {item.title}
                    </span>
                    <button
                      onClick={() => handleEpisodeDownload(item)}
                      disabled={episodeDownloading === item.link}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/20 text-primary rounded transition-all disabled:opacity-50"
                      title="Download"
                    >
                      {episodeDownloading === item.link ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
