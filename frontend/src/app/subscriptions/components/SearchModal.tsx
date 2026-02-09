"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import Image from "next/image";
import {
  getProfiles,
  getTVDetail,
  searchMedia,
  subscribe,
  tmdbImage,
  type Profile,
  type SearchResult,
  type TMDBTVDetail,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";

type SearchModalProps = {
  onClose: () => void;
};

type SearchSource = "tvdb" | "bgm";

type MediaChoice = "anime" | "tv";

type SubscribeMediaType = "anime" | "tv" | "movie";

type SubscribeOptions = {
  closeOnSuccess?: boolean;
};

export default function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<SearchResult | null>(
    null
  );
  const [subscribeDetail, setSubscribeDetail] = useState<TMDBTVDetail | null>(
    null
  );
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [mediaTypeChoice, setMediaTypeChoice] = useState<MediaChoice>("tv");
  const [searchSource, setSearchSource] = useState<SearchSource>("tvdb");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getProfiles();
        if (!mounted) return;
        setProfiles(data);
        const defaultProfile = data.find((p) => p.is_default === 1);
        setSelectedProfileId(defaultProfile ? defaultProfile.id : null);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    try {
      setSearching(true);
      const res = await searchMedia(query, undefined, searchSource);
      if (searchSource === "tvdb") {
        setResults(
          res.results.filter(
            (r) =>
              r.media_type === "tv" ||
              r.media_type === "movie" ||
              !r.media_type
          )
        );
      } else {
        setResults(res.results);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubscribe(
    result: SearchResult,
    mediaType: SubscribeMediaType,
    seasonNumber?: number,
    opts: SubscribeOptions = {}
  ) {
    try {
      setSubscribing(result.id);
      await subscribe({
        source: result.source,
        source_id: result.id,
        media_type: mediaType,
        season_number: seasonNumber,
        profile_id: selectedProfileId,
      });
      alert(`Subscribed to ${result.name || result.title}!`);
      if (opts.closeOnSuccess !== false) {
        setSubscribeTarget(null);
        setSubscribeDetail(null);
        onClose();
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to subscribe"));
    } finally {
      setSubscribing(null);
    }
  }

  async function handleOpenSubscribe(result: SearchResult) {
    try {
      setSubscribeLoading(true);
      setSubscribeTarget(result);
      setSubscribeDetail(null);
      setSelectedSeason("all");
      setMediaTypeChoice(result.source === "bgm" ? "anime" : "tv");

      if (result.source === "bgm") {
        return;
      }

      if (result.media_type !== "movie") {
        const detail = await getTVDetail(result.id);
        setSubscribeDetail(detail);
        const seasons = detail.seasons.filter((s) => s.season_number > 0);
        const defaultSeason = seasons[0]?.season_number ?? 1;
        setSelectedSeason(seasons.length > 1 ? "all" : String(defaultSeason));
      }
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Failed to load details"));
      setSubscribeTarget(null);
      setSubscribeDetail(null);
    } finally {
      setSubscribeLoading(false);
    }
  }

  async function handleConfirmSubscribe() {
    if (!subscribeTarget) return;

    if (subscribeTarget.source === "bgm") {
      await handleSubscribe(subscribeTarget, mediaTypeChoice);
      return;
    }

    const isMovie = subscribeTarget.media_type === "movie";
    const mediaType: SubscribeMediaType = isMovie ? "movie" : mediaTypeChoice;

    if (isMovie) {
      await handleSubscribe(subscribeTarget, mediaType);
      return;
    }

    const seasons =
      subscribeDetail?.seasons.filter((s) => s.season_number > 0) || [];
    const shouldSelectSeason = seasons.length > 1;

    if (shouldSelectSeason && selectedSeason === "all") {
      for (const season of seasons) {
        await handleSubscribe(subscribeTarget, mediaType, season.season_number, {
          closeOnSuccess: false,
        });
      }
      setSubscribeTarget(null);
      setSubscribeDetail(null);
      onClose();
      return;
    }

    const seasonNumber = shouldSelectSeason
      ? Number(selectedSeason)
      : seasons[0]?.season_number;

    if (seasonNumber == null) {
      alert("Season not available");
      return;
    }

    await handleSubscribe(subscribeTarget, mediaType, seasonNumber);
  }

  const resultList = (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {results.map((result) => (
        <div
          key={result.id}
          className="flex items-center gap-4 p-3 bg-background rounded-lg hover:bg-secondary/50 transition-colors"
        >
          <Image
            src={tmdbImage(result.poster_path, "w92")}
            alt={result.name || result.title || ""}
            width={48}
            height={72}
            className="w-12 h-18 object-cover rounded-lg shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">
              {result.name || result.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {result.original_name || result.original_title}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="h-5 border-transparent text-[10px]">
                {result.source === "bgm" ? "BGM" : "TVDB"}
              </Badge>
              <span className="uppercase text-accent">
                {result.media_type || "tv"}
              </span>
              <span>{result.first_air_date || result.release_date || ""}</span>
              {result.vote_average > 0 && (
                <span>⭐ {result.vote_average.toFixed(1)}</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <Button
              onClick={() => handleOpenSubscribe(result)}
              disabled={subscribeLoading && subscribeTarget?.id === result.id}
              size="sm"
              className="h-7 gap-1 text-xs"
            >
              {subscribeLoading && subscribeTarget?.id === result.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Subscription
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-20 z-50">
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Search Media</h2>
          <Button onClick={onClose} variant="ghost" size="icon-sm">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="search-source"
                  value="tvdb"
                  checked={searchSource === "tvdb"}
                  onChange={() => setSearchSource("tvdb")}
                  className="accent-primary"
                />
                TVDB
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="search-source"
                  value="bgm"
                  checked={searchSource === "bgm"}
                  onChange={() => setSearchSource("bgm")}
                  className="accent-primary"
                />
                BGM.tv
              </label>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search anime, TV shows, movies..."
                autoFocus
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </Button>
            </div>
          </div>
        </div>

        {resultList}
      </div>

      {subscribeTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold">Subscribe</h3>
              <Button
                onClick={() => {
                  setSubscribeTarget(null);
                  setSubscribeDetail(null);
                }}
                variant="ghost"
                size="icon-sm"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-3">
                <Image
                  src={tmdbImage(subscribeTarget.poster_path, "w154")}
                  alt={subscribeTarget.name || subscribeTarget.title || ""}
                  width={80}
                  height={112}
                  className="w-20 h-28 object-cover rounded-lg"
                />
                <div>
                  <h4 className="font-semibold text-base">
                    {subscribeTarget.name || subscribeTarget.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subscribeTarget.overview?.slice(0, 120) || ""}
                  </p>
                </div>
              </div>

              {subscribeTarget.media_type !== "movie" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Type
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => setMediaTypeChoice("tv")}
                      variant={mediaTypeChoice === "tv" ? "default" : "secondary"}
                      size="sm"
                    >
                      TV
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setMediaTypeChoice("anime")}
                      variant={mediaTypeChoice === "anime" ? "default" : "secondary"}
                      size="sm"
                    >
                      Anime
                    </Button>
                  </div>
                </div>
              )}

              {subscribeTarget.media_type !== "movie" &&
                (subscribeDetail?.seasons.filter((s) => s.season_number > 0)
                  .length || 0) > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Season
                    </label>
                    <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All seasons</SelectItem>
                        {subscribeDetail?.seasons
                          .filter((s) => s.season_number > 0)
                          .map((season) => (
                            <SelectItem
                              key={season.id}
                              value={String(season.season_number)}
                            >
                              {season.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Profile
                </label>
                <Select
                  value={
                    selectedProfileId != null
                      ? String(selectedProfileId)
                      : "__default"
                  }
                  onValueChange={(value) =>
                    setSelectedProfileId(
                      value === "__default" ? null : Number(value)
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default">Default (if set)</SelectItem>
                    {profiles.length === 0 && (
                      <SelectItem value="__no_profiles" disabled>
                        No profiles available
                      </SelectItem>
                    )}
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={String(profile.id)}>
                        {profile.name}
                        {profile.is_default === 1 ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <Button
                onClick={() => {
                  setSubscribeTarget(null);
                  setSubscribeDetail(null);
                }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmSubscribe}
                disabled={subscribing === subscribeTarget.id}
              >
                {subscribing === subscribeTarget.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
