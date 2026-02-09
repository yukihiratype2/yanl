"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Star, Tv, X } from "lucide-react";
import Image from "next/image";
import {
  getBgmCalendar,
  getBgmSubject,
  type BgmCalendarDay,
  type BgmSubjectDetail,
  type BgmSubjectInfoboxItem,
  type BgmSubjectSmall,
} from "@/lib/bgm";
import { getSubscriptions, subscribe, type Subscription } from "@/lib/api";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export default function MediaListPage() {
  const [calendar, setCalendar] = useState<BgmCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BgmSubjectSmall | null>(
    null
  );
  const [detail, setDetail] = useState<BgmSubjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [subscribedMap, setSubscribedMap] = useState<
    Record<number, Subscription>
  >({});
  const [subsLoading, setSubsLoading] = useState(false);
  const [subscribeState, setSubscribeState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    loadCalendar();
    loadSubscriptions();
  }, []);

  async function loadCalendar() {
    try {
      setLoading(true);
      setError(null);
      const data = await getBgmCalendar();
      setCalendar(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load BGM calendar");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriptions() {
    try {
      setSubsLoading(true);
      const subs = await getSubscriptions("active");
      const nextMap: Record<number, Subscription> = {};
      for (const sub of subs) {
        if (sub.source !== "bgm") continue;
        if (sub.source_id == null) continue;
        nextMap[sub.source_id] = sub;
      }
      setSubscribedMap(nextMap);
    } catch (err: any) {
      console.warn("Failed to load subscriptions:", err?.message || err);
    } finally {
      setSubsLoading(false);
    }
  }

  const orderedDays = useMemo(() => {
    const byId = new Map<number, BgmCalendarDay>();
    for (const day of calendar) {
      byId.set(day.weekday.id, day);
    }

    return WEEKDAY_ORDER.map((id) => {
      const existing = byId.get(id);
      if (existing) return existing;
      return {
        weekday: {
          id,
          en: WEEKDAY_LABELS[id],
          cn: "",
          ja: "",
        },
        items: [],
      } as BgmCalendarDay;
    });
  }, [calendar]);

  const todayWeekdayId = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let active = true;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const data = await getBgmSubject(selectedItem.id);
        if (active) {
          setDetail(data);
        }
      } catch (err: any) {
        if (active) {
          setDetailError(err?.message || "Failed to load details");
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [selectedItem]);

  function openDetail(item: BgmSubjectSmall) {
    setSelectedItem(item);
    setSubscribeState({ status: "idle" });
  }

  function closeDetail() {
    setSelectedItem(null);
  }

  async function handleSubscribe() {
    if (!selectedItem) return;

    try {
      setSubscribeState({ status: "loading" });
      const sub = await subscribe({
        source: "bgm",
        source_id: selectedItem.id,
        media_type: "anime",
      });
      setSubscribedMap((prev) => ({ ...prev, [selectedItem.id]: sub }));
      setSubscribeState({ status: "success", message: "Subscribed" });
    } catch (err: any) {
      const message = err?.message || "Failed to subscribe";
      if (message.toLowerCase().includes("already subscribed")) {
        setSubscribeState({ status: "success", message: "Already subscribed" });
        loadSubscriptions();
      } else {
        setSubscribeState({ status: "error", message });
      }
    }
  }

  function formatInfoboxValue(
    value: BgmSubjectInfoboxItem["value"]
  ): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((entry) => {
          if ("k" in entry && entry.k) {
            return `${entry.k}: ${entry.v}`;
          }
          return entry.v;
        })
        .join(", ");
    }
    return "";
  }

  const infoboxItems = useMemo(() => {
    if (!detail?.infobox?.length) return [];
    return detail.infobox.slice(0, 6);
  }, [detail]);

  const tagItems = useMemo(() => {
    if (detail?.tags?.length) {
      return detail.tags.slice(0, 12).map((tag) => ({
        label: tag.name,
        count: tag.count,
      }));
    }
    if (detail?.meta_tags?.length) {
      return detail.meta_tags.slice(0, 12).map((name) => ({
        label: name,
        count: null,
      }));
    }
    return [];
  }, [detail]);

  const selectedSubscribed =
    selectedItem != null ? subscribedMap[selectedItem.id] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tv className="w-6 h-6" /> Media List
        </h1>
      </div>

      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <span className="text-sm font-semibold">BGM.tv</span>
          <span className="text-xs text-muted-foreground">
            Weekly broadcast calendar
          </span>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="px-4 py-6 text-sm text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <div className="divide-y divide-border">
            {orderedDays.map((day) => (
              <div key={day.weekday.id} className="flex gap-4 p-4">
                <div className="w-20 shrink-0">
                  <div
                    className={[
                      "text-sm font-semibold",
                      day.weekday.id === todayWeekdayId
                        ? "text-primary text-base"
                        : "",
                    ].join(" ")}
                  >
                    {day.weekday.en || WEEKDAY_LABELS[day.weekday.id]}
                  </div>
                  {day.weekday.cn && (
                    <div
                      className={[
                        "text-xs text-muted-foreground",
                        day.weekday.id === todayWeekdayId
                          ? "text-primary/90 font-semibold"
                          : "",
                      ].join(" ")}
                    >
                      {day.weekday.cn}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  <div className="flex gap-4 min-w-max pr-4 pb-2">
                    {day.items.length === 0 && (
                      <div className="text-sm text-muted-foreground py-3">
                        No shows today
                      </div>
                    )}
                    {day.items.map((item) => {
                      const title = item.name_cn || item.name;
                      const image =
                        item.images?.medium ||
                        item.images?.small ||
                        item.images?.grid ||
                        "/placeholder.svg";
                      const isSubscribed = Boolean(subscribedMap[item.id]);
                      const ratingValue = item.rating?.score;
                      const ratingText =
                        ratingValue != null ? ratingValue.toFixed(1) : "N/A";
                      const episodeCount = item.eps ?? item.eps_count;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openDetail(item)}
                          className={[
                            "group w-64 flex-shrink-0 rounded-xl border",
                            "border-border/60 bg-background/60",
                            "hover:bg-secondary transition-colors",
                            "text-left",
                          ].join(" ")}
                          title={title}
                        >
                          <div className="flex gap-3 p-3">
                            <div className="relative">
                              <Image
                                src={image}
                                alt=""
                                width={80}
                                height={112}
                                sizes="80px"
                                className="w-20 h-28 object-cover rounded-lg shrink-0"
                              />
                              {isSubscribed && (
                                <span
                                  className={[
                                    "absolute left-1 top-1 rounded-full",
                                    "bg-emerald-500/90 px-2 py-0.5",
                                    "text-[10px] font-semibold text-white",
                                  ].join(" ")}
                                >
                                  Subscribed
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold truncate">
                                {title}
                              </div>
                              {item.name && item.name !== title && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.name}
                                </div>
                              )}
                              <div className="mt-2 flex items-center gap-1 text-xs">
                                <Star className="w-3.5 h-3.5 text-amber-500" />
                                <span className="font-semibold">
                                  {ratingText}
                                </span>
                                {ratingValue != null && (
                                  <span className="text-muted-foreground">
                                    / 10
                                  </span>
                                )}
                              </div>
                              {episodeCount != null && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {episodeCount} episodes
                                </div>
                              )}
                              {item.air_date && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.air_date}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-card border border-border shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-border">
              <div>
                <div className="text-lg font-semibold">
                  {selectedItem.name_cn || selectedItem.name}
                </div>
                {selectedItem.name_cn &&
                  selectedItem.name &&
                  selectedItem.name !== selectedItem.name_cn && (
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.name}
                    </div>
                  )}
                {selectedSubscribed && (
                  <span
                    className={[
                      "mt-2 inline-flex rounded-full",
                      "bg-emerald-500/90 px-2 py-0.5",
                      "text-xs font-semibold text-white",
                    ].join(" ")}
                  >
                    Subscribed
                  </span>
                )}
              </div>
              <button
                type="button"
                className="p-1 rounded-md hover:bg-secondary"
                onClick={closeDetail}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 grid gap-4 md:grid-cols-[180px,1fr]">
              <Image
                src={
                  detail?.images?.large ||
                  detail?.images?.medium ||
                  selectedItem.images?.medium ||
                  detail?.images?.small ||
                  selectedItem.images?.small ||
                  "/placeholder.svg"
                }
                alt=""
                width={180}
                height={270}
                sizes="180px"
                className="w-full max-w-[180px] rounded-lg object-cover"
              />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">
                    {detail?.rating?.score != null
                      ? detail.rating.score.toFixed(1)
                      : selectedItem.rating?.score != null
                        ? selectedItem.rating.score.toFixed(1)
                        : "N/A"}
                  </span>
                  {(detail?.rating?.score ?? selectedItem.rating?.score) !=
                    null && (
                    <span className="text-muted-foreground">/ 10</span>
                  )}
                  {detail?.rating?.rank != null && (
                    <span className="text-xs text-muted-foreground">
                      Rank #{detail.rating.rank}
                    </span>
                  )}
                  {detail?.rating?.total != null && (
                    <span className="text-xs text-muted-foreground">
                      {detail.rating.total} votes
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {(detail?.date || selectedItem.air_date) && (
                    <span>
                      Air date: {detail?.date || selectedItem.air_date}
                    </span>
                  )}
                  {(detail?.date || selectedItem.air_date) &&
                    (detail?.total_episodes ??
                      detail?.eps ??
                      selectedItem.eps ??
                      selectedItem.eps_count) != null && (
                      <span className="mx-2">•</span>
                    )}
                  {(detail?.total_episodes ??
                    detail?.eps ??
                    selectedItem.eps ??
                    selectedItem.eps_count) != null && (
                    <span>
                      {detail?.total_episodes ??
                        detail?.eps ??
                        selectedItem.eps ??
                        selectedItem.eps_count}{" "}
                      episodes
                    </span>
                  )}
                  {detail?.platform && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{detail.platform}</span>
                    </>
                  )}
                </div>
                {detailLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading details...
                  </div>
                )}
                {detailError && (
                  <div className="text-xs text-red-500">{detailError}</div>
                )}
                {(detail?.summary || selectedItem.summary) && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {detail?.summary || selectedItem.summary}
                  </p>
                )}
                {detail?.collection && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-5">
                    <div className="rounded-md bg-secondary/60 px-2 py-1">
                      Wish {detail.collection.wish}
                    </div>
                    <div className="rounded-md bg-secondary/60 px-2 py-1">
                      Collect {detail.collection.collect}
                    </div>
                    <div className="rounded-md bg-secondary/60 px-2 py-1">
                      Doing {detail.collection.doing}
                    </div>
                    <div className="rounded-md bg-secondary/60 px-2 py-1">
                      Hold {detail.collection.on_hold}
                    </div>
                    <div className="rounded-md bg-secondary/60 px-2 py-1">
                      Dropped {detail.collection.dropped}
                    </div>
                  </div>
                )}
                {tagItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {tagItems.map((tag) => (
                      <span
                        key={tag.label}
                        className="rounded-full bg-secondary/70 px-2 py-0.5 text-muted-foreground"
                      >
                        {tag.label}
                        {tag.count != null && (
                          <span className="ml-1 text-[10px]">
                            {tag.count}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {infoboxItems.length > 0 && (
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {infoboxItems.map((item) => (
                      <div key={item.key} className="truncate">
                        <span className="font-semibold text-foreground">
                          {item.key}
                        </span>
                        : {formatInfoboxValue(item.value)}
                      </div>
                    ))}
                  </div>
                )}
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  View on BGM.tv <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 border-t border-border">
              <div className="text-sm">
                {subscribeState.status === "error" && (
                  <span className="text-red-500">{subscribeState.message}</span>
                )}
                {subscribeState.status === "success" && (
                  <span className="text-emerald-600">
                    {subscribeState.message}
                  </span>
                )}
                {!subsLoading && selectedSubscribed && (
                  <span className="text-emerald-600">Already subscribed</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={
                  subscribeState.status === "loading" ||
                  subscribeState.status === "success" ||
                  Boolean(selectedSubscribed)
                }
                className={[
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 transition-opacity",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {subscribeState.status === "loading"
                  ? "Subscribing..."
                  : selectedSubscribed
                    ? "Subscribed"
                    : "Subscribe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
