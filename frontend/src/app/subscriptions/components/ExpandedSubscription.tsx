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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";

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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to add torrent"));
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
                      <Badge
                        variant="secondary"
                        className={`h-5 border-transparent text-[10px] ${
                          release.released
                            ? "bg-success/20 text-success"
                            : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        {release.status}
                      </Badge>
                    </div>
                    {fileStatus && (
                      <div className="mt-1">
                        <Badge
                          variant="secondary"
                          className={`h-5 border-transparent text-[10px] ${
                            fileStatus.tone === "success"
                              ? "bg-success/20 text-success"
                              : fileStatus.tone === "warning"
                              ? "bg-warning/20 text-warning"
                              : "bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {fileStatus.label}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {canSearch && (
                    <Button
                      onClick={() => openEpisodeSearch(ep)}
                      variant="outline"
                      size="icon-sm"
                      title="Search torrents for this episode"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
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
              <Button
                onClick={() => {
                  setEpisodeSearchOpen(false);
                  setEpisodeSearchTarget(null);
                }}
                variant="ghost"
                size="icon-sm"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={episodeSearchQuery}
                  onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && runEpisodeSearch(e.currentTarget.value)
                  }
                  placeholder={sub.title}
                  className="flex-1"
                />
                <Button
                  onClick={() => runEpisodeSearch(episodeSearchQuery || sub.title)}
                  disabled={episodeSearchLoading}
                >
                  {episodeSearchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </Button>
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
                    <Badge variant="secondary" className="h-5 border-transparent text-[10px]">
                      {item.source}
                    </Badge>
                    <span className="flex-1 truncate text-xs" title={item.title}>
                      {item.title}
                    </span>
                    <Button
                      onClick={() => handleEpisodeDownload(item)}
                      disabled={episodeDownloading === item.link}
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 transition-all"
                      title="Download"
                    >
                      {episodeDownloading === item.link ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
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
