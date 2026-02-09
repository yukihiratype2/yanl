"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Star, Tv, X, Calendar as CalendarIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

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
  const [subscribeState, setSubscribeState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  const todayWeekdayId = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  const [activeTabId, setActiveTabId] = useState<number>(todayWeekdayId);

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
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "Failed to load BGM calendar"));
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriptions() {
    try {
      const subs = await getSubscriptions("active");
      const nextMap: Record<number, Subscription> = {};
      for (const sub of subs) {
        if (sub.source !== "bgm") continue;
        if (sub.source_id == null) continue;
        nextMap[sub.source_id] = sub;
      }
      setSubscribedMap(nextMap);
    } catch (err: unknown) {
      console.warn("Failed to load subscriptions:", getErrorMessage(err));
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

  const activeDay = useMemo(() => {
    return orderedDays.find((d) => d.weekday.id === activeTabId);
  }, [orderedDays, activeTabId]);

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const selectedItemId = selectedItem.id;
    let active = true;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        const data = await getBgmSubject(selectedItemId);
        if (active) {
          setDetail(data);
        }
      } catch (err: unknown) {
        if (active) {
          setDetailError(getErrorMessage(err, "Failed to load details"));
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
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to subscribe");
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tv className="w-6 h-6" /> Media Calendar
        </h1>
        <div className="text-sm text-muted-foreground">
           BGM.tv Data Source
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center p-1 bg-muted/60 rounded-xl overflow-x-auto no-scrollbar">
          {orderedDays.map((day) => {
            const isToday = day.weekday.id === todayWeekdayId;
            const isActive = day.weekday.id === activeTabId;
            return (
              <button
                key={day.weekday.id}
                onClick={() => setActiveTabId(day.weekday.id)}
                className={cn(
                  "flex-1 min-w-[60px] relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out",
                  isActive
                    ? "bg-background text-primary shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                  isToday && !isActive && "text-primary font-semibold"
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="leading-none">{day.weekday.en || WEEKDAY_LABELS[day.weekday.id]}</span>
                  {day.weekday.cn && <span className="text-[10px] opacity-80 leading-none">{day.weekday.cn}</span>}
                </div>
                {isToday && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading calendar...</p>
          </div>
        ) : error ? (
           <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-500">
             <p>{error}</p>
             <Button variant="outline" onClick={() => loadCalendar()}>Retry</Button>
           </div>
        ) : !activeDay?.items.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            <CalendarIcon className="w-10 h-10 mb-2 opacity-20" />
            <p>No episodes scheduled for {activeDay?.weekday.en || "this day"}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {activeDay.items.map((item) => {
              const title = item.name_cn || item.name;
              const image =
                item.images?.large ||
                item.images?.common ||
                item.images?.medium ||
                item.images?.grid ||
                "/placeholder.svg";
              const isSubscribed = Boolean(subscribedMap[item.id]);
              const ratingValue = item.rating?.score;

              return (
                <div
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="group relative flex flex-col gap-2 cursor-pointer"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:scale-[1.02]">
                    <Image
                      src={image}
                      alt={title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    
                    {isSubscribed && (
                      <Badge
                        className="absolute right-2 top-2 z-10 bg-emerald-500 hover:bg-emerald-600 shadow-sm"
                      >
                        Subscribed
                      </Badge>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full transition-transform duration-300 group-hover:translate-y-0">
                      <div className="flex items-center gap-1 text-white text-xs font-medium">
                         <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                         <span>{ratingValue?.toFixed(1) || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 px-1">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.air_date ? item.air_date.split("-").slice(1).join("/") : "Unknown"}</span>
                      {item.eps || item.eps_count ? (
                        <span>{item.eps || item.eps_count} ep</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between p-4 border-b border-border bg-card/80 backdrop-blur-md">
              <div className="pr-8">
                <div className="text-lg font-bold leading-tight">
                  {selectedItem.name_cn || selectedItem.name}
                </div>
                {selectedItem.name_cn &&
                  selectedItem.name &&
                  selectedItem.name !== selectedItem.name_cn && (
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {selectedItem.name}
                    </div>
                  )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 -mr-2 rounded-full"
                onClick={closeDetail}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-5 grid gap-6 md:grid-cols-[200px,1fr]">
              <div className="mx-auto w-[200px] shrink-0 space-y-3">
                 <div className="aspect-[3/4] relative rounded-lg overflow-hidden shadow-md">
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
                    fill
                    className="object-cover"
                  />
                 </div>
                 
                 <Button
                    type="button"
                    className={cn(
                        "w-full gap-2 transition-all",
                        selectedSubscribed ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    )}
                    onClick={handleSubscribe}
                    disabled={
                      subscribeState.status === "loading" ||
                      subscribeState.status === "success" ||
                      Boolean(selectedSubscribed)
                    }
                  >
                    {subscribeState.status === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : selectedSubscribed ? (
                         <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                             Subscribed
                         </div>
                    ) : (
                        "Subscribe"
                    )}
                  </Button>
                  {subscribeState.status === "error" && (
                     <div className="text-xs text-red-500 text-center font-medium">
                         {subscribeState.message}
                     </div>
                  )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 px-2.5 py-1 rounded-md font-medium dark:text-amber-400 dark:bg-amber-500/20">
                    <Star className="w-4 h-4 fill-current" />
                    {detail?.rating?.score != null
                      ? detail.rating.score.toFixed(1)
                      : selectedItem.rating?.score != null
                        ? selectedItem.rating.score.toFixed(1)
                        : "N/A"}
                  </div>
                  
                  {(detail?.total_episodes ??
                    detail?.eps ??
                    selectedItem.eps ??
                    selectedItem.eps_count) != null && (
                    <div className="flex items-center gap-1.5 text-muted-foreground px-2 py-1 bg-secondary rounded-md">
                       <Tv className="w-4 h-4" />
                       {detail?.total_episodes ??
                        detail?.eps ??
                        selectedItem.eps ??
                        selectedItem.eps_count}{" "}
                      episodes
                    </div>
                  )}

                   {(detail?.date || selectedItem.air_date) && (
                      <div className="flex items-center gap-1.5 text-muted-foreground px-2 py-1 bg-secondary rounded-md">
                        <CalendarIcon className="w-4 h-4" />
                        {detail?.date || selectedItem.air_date}
                      </div>
                   )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                      Synopsis
                      {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </h4>
                   {detailError ? (
                      <div className="text-sm text-red-500">{detailError}</div>
                   ) : (
                       <p className="text-sm leading-relaxed text-muted-foreground/90 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                         {detail?.summary || selectedItem.summary || "No summary available."}
                      </p>
                   )}
                </div>

                {tagItems.length > 0 && (
                   <div className="space-y-2">
                     <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {tagItems.map((tag) => (
                          <Badge
                            key={tag.label}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {tag.label}
                            {tag.count != null && (
                              <span className="ml-1 opacity-50">
                                {tag.count}
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                   </div>
                )}
                
                {infoboxItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Information</h4>
                      <div className="grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
                        {infoboxItems.map((item) => (
                          <div key={item.key} className="flex gap-2 min-w-0">
                            <span className="font-semibold text-foreground shrink-0">
                              {item.key}:
                            </span>
                            <span className="text-muted-foreground truncate" title={formatInfoboxValue(item.value)}>
                                {formatInfoboxValue(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                  </div>
                )}

                <div className="pt-2">
                     <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline hover:text-primary/80 transition-colors"
                    >
                      View on BGM.tv <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
