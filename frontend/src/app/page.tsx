"use client";

import { useEffect, useMemo, useState } from "react";
import { Tv } from "lucide-react";
import {
  getBgmCalendar,
  getBgmSubject,
  type BgmCalendarDay,
  type BgmSubjectDetail,
  type BgmSubjectSmall,
} from "@/lib/bgm";
import { getSubscriptions, subscribe, type Subscription } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildOrderedDays } from "@/components/media-calendar/constants";
import { MediaCalendarTabs } from "@/components/media-calendar/MediaCalendarTabs";
import { MediaGridSection } from "@/components/media-calendar/MediaGridSection";
import { MediaDetailModal } from "@/components/media-calendar/MediaDetailModal";

type SubscribeState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

export default function MediaListPage() {
  const [calendar, setCalendar] = useState<BgmCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<BgmSubjectSmall | null>(null);
  const [detail, setDetail] = useState<BgmSubjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [subscribedMap, setSubscribedMap] = useState<Record<number, Subscription>>({});
  const [subscribeState, setSubscribeState] = useState<SubscribeState>({ status: "idle" });

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

  const orderedDays = useMemo(() => buildOrderedDays(calendar), [calendar]);

  const activeDay = useMemo(() => {
    return orderedDays.find((day) => day.weekday.id === activeTabId);
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

  const selectedSubscribed = selectedItem != null ? subscribedMap[selectedItem.id] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tv className="w-6 h-6" /> Media Calendar
        </h1>
        <div className="text-sm text-muted-foreground">BGM.tv Data Source</div>
      </div>

      <div className="space-y-4">
        <MediaCalendarTabs
          days={orderedDays}
          activeTabId={activeTabId}
          todayWeekdayId={todayWeekdayId}
          onChange={setActiveTabId}
        />

        <MediaGridSection
          loading={loading}
          error={error}
          activeDay={activeDay}
          subscribedMap={subscribedMap}
          onOpenDetail={(item) => {
            setSelectedItem(item);
            setSubscribeState({ status: "idle" });
          }}
          onRetry={loadCalendar}
        />
      </div>

      {selectedItem && (
        <MediaDetailModal
          selectedItem={selectedItem}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          infoboxItems={infoboxItems}
          tagItems={tagItems}
          selectedSubscribed={selectedSubscribed}
          subscribeState={subscribeState}
          onClose={() => setSelectedItem(null)}
          onSubscribe={handleSubscribe}
        />
      )}
    </div>
  );
}
