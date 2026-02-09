import { Calendar as CalendarIcon, ExternalLink, Loader2, Star, Tv, X } from "lucide-react";
import Image from "next/image";
import type { BgmSubjectDetail, BgmSubjectInfoboxItem, BgmSubjectSmall } from "@/lib/bgm";
import type { Subscription } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubscribeState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

type TagItem = {
  label: string;
  count: number | null;
};

type MediaDetailModalProps = {
  selectedItem: BgmSubjectSmall;
  detail: BgmSubjectDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  infoboxItems: BgmSubjectInfoboxItem[];
  tagItems: TagItem[];
  selectedSubscribed: Subscription | null;
  subscribeState: SubscribeState;
  onClose: () => void;
  onSubscribe: () => void;
};

function formatInfoboxValue(value: BgmSubjectInfoboxItem["value"]): string {
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

export function MediaDetailModal({
  selectedItem,
  detail,
  detailLoading,
  detailError,
  infoboxItems,
  tagItems,
  selectedSubscribed,
  subscribeState,
  onClose,
  onSubscribe,
}: MediaDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between p-4 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="pr-8">
            <div className="text-lg font-bold leading-tight">{selectedItem.name_cn || selectedItem.name}</div>
            {selectedItem.name_cn &&
              selectedItem.name &&
              selectedItem.name !== selectedItem.name_cn && (
                <div className="text-sm text-muted-foreground mt-0.5">{selectedItem.name}</div>
              )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 -mr-2 rounded-full"
            onClick={onClose}
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
              onClick={onSubscribe}
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
              <div className="text-xs text-red-500 text-center font-medium">{subscribeState.message}</div>
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
                  {detail?.total_episodes ?? detail?.eps ?? selectedItem.eps ?? selectedItem.eps_count} episodes
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
                    <Badge key={tag.label} variant="secondary" className="text-xs font-normal">
                      {tag.label}
                      {tag.count != null && <span className="ml-1 opacity-50">{tag.count}</span>}
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
                      <span className="font-semibold text-foreground shrink-0">{item.key}:</span>
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
  );
}
