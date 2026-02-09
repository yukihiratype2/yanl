import { Calendar as CalendarIcon, Loader2, Star } from "lucide-react";
import Image from "next/image";
import type { BgmCalendarDay, BgmSubjectSmall } from "@/lib/bgm";
import type { Subscription } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MediaGridSectionProps = {
  loading: boolean;
  error: string | null;
  activeDay?: BgmCalendarDay;
  subscribedMap: Record<number, Subscription>;
  onOpenDetail: (item: BgmSubjectSmall) => void;
  onRetry: () => void;
};

export function MediaGridSection({
  loading,
  error,
  activeDay,
  subscribedMap,
  onOpenDetail,
  onRetry,
}: MediaGridSectionProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-red-500">
        <p>{error}</p>
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (!activeDay?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
        <CalendarIcon className="w-10 h-10 mb-2 opacity-20" />
        <p>No episodes scheduled for {activeDay?.weekday.en || "this day"}.</p>
      </div>
    );
  }

  return (
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
            onClick={() => onOpenDetail(item)}
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
                <Badge className="absolute right-2 top-2 z-10 bg-emerald-500 hover:bg-emerald-600 shadow-sm">
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
                {item.eps || item.eps_count ? <span>{item.eps || item.eps_count} ep</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
