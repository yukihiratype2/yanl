"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { tmdbImage, type Subscription } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type LayoutMode = "list" | "grid";

type SubscriptionListProps = {
  subscriptions: Subscription[];
  layout: LayoutMode;
  onDelete: (sub: Subscription) => void;
  onToggle: (sub: Subscription) => void;
  isUpdating: (id: number) => boolean;
};

function statusClasses(status: string) {
  return status === "active"
    ? "border-transparent bg-success/20 text-success"
    : "border-transparent bg-muted/20 text-muted-foreground";
}

function SubscriptionMeta({ sub }: { sub: Subscription }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
      <Badge
        variant="secondary"
        className="h-5 border-transparent bg-primary/20 text-[10px] uppercase text-primary"
      >
        {sub.media_type}
      </Badge>
      {sub.season_number != null && <span>Season {sub.season_number}</span>}
      {sub.total_episodes && <span>{sub.total_episodes} episodes</span>}
      <Badge className={statusClasses(sub.status)}>
        {sub.status}
      </Badge>
    </div>
  );
}

export default function SubscriptionList({
  subscriptions,
  layout,
  onDelete,
  onToggle,
  isUpdating,
}: SubscriptionListProps) {
  const router = useRouter();
  const isGrid = layout === "grid";
  const isActive = (sub: Subscription) => sub.status === "active";

  function openDetail(id: number) {
    router.push(`/subscriptions/${id}`);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    id: number
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetail(id);
    }
  }

  return (
    <div
      className={
        isGrid
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-3"
      }
    >
      {subscriptions.map((sub) => (
        <div
          key={sub.id}
          role="button"
          tabIndex={0}
          onClick={() => openDetail(sub.id)}
          onKeyDown={(event) => handleKeyDown(event, sub.id)}
          className={`bg-card rounded-xl border border-border overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isGrid ? "flex flex-col" : ""
          } ${isActive(sub) ? "" : "opacity-70"}`}
        >
          {isGrid ? (
            <div className="flex flex-col h-full">
              <div className="relative">
                <Image
                  src={tmdbImage(sub.poster_path, "w342")}
                  alt={sub.title}
                  width={342}
                  height={513}
                  sizes="(min-width: 1280px) 240px, (min-width: 1024px) 220px, (min-width: 640px) 200px, 50vw"
                  className="w-full aspect-[2/3] object-cover"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Switch
                    checked={isActive(sub)}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={() => onToggle(sub)}
                    disabled={isUpdating(sub.id)}
                    title={isActive(sub) ? "Disable subscription" : "Enable subscription"}
                    aria-label={`${
                      isActive(sub) ? "Disable" : "Enable"
                    } ${sub.title}`}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(sub);
                    }}
                    title="Delete"
                    aria-label={`Delete ${sub.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-4">
                <h3 className="font-semibold truncate">{sub.title}</h3>
                <SubscriptionMeta sub={sub} />
                {sub.first_air_date && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {sub.first_air_date}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4">
              <Image
                src={tmdbImage(sub.poster_path, "w92")}
                alt={sub.title}
                width={92}
                height={138}
                sizes="56px"
                className="w-14 h-20 object-cover rounded-lg shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{sub.title}</h3>
                <SubscriptionMeta sub={sub} />
                {sub.first_air_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {sub.first_air_date}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isActive(sub)}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={() => onToggle(sub)}
                  disabled={isUpdating(sub.id)}
                  title={isActive(sub) ? "Disable subscription" : "Enable subscription"}
                  aria-label={`${
                    isActive(sub) ? "Disable" : "Enable"
                  } ${sub.title}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(sub);
                  }}
                  className="text-destructive hover:bg-destructive/20 hover:text-destructive"
                  title="Delete"
                  aria-label={`Delete ${sub.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
