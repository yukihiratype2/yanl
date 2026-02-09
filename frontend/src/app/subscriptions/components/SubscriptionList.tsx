"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { tmdbImage, type Subscription } from "@/lib/api";

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
    ? "bg-success/20 text-success"
    : "bg-muted/20 text-muted-foreground";
}

function SubscriptionMeta({ sub }: { sub: Subscription }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
      <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-full uppercase">
        {sub.media_type}
      </span>
      {sub.season_number != null && <span>Season {sub.season_number}</span>}
      {sub.total_episodes && <span>{sub.total_episodes} episodes</span>}
      <span className={`px-2 py-0.5 rounded-full ${statusClasses(sub.status)}`}>
        {sub.status}
      </span>
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive(sub)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(sub);
                    }}
                    disabled={isUpdating(sub.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                      isActive(sub)
                        ? "bg-success/60 border-success/70"
                        : "bg-muted border-border"
                    } ${isUpdating(sub.id) ? "opacity-60 cursor-not-allowed" : ""}`}
                    title={isActive(sub) ? "Disable subscription" : "Enable subscription"}
                    aria-label={`${
                      isActive(sub) ? "Disable" : "Enable"
                    } ${sub.title}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition ${
                        isActive(sub) ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(sub);
                    }}
                    className="p-2 rounded-lg bg-background/80 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    title="Delete"
                    aria-label={`Delete ${sub.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive(sub)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(sub);
                  }}
                  disabled={isUpdating(sub.id)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                    isActive(sub)
                      ? "bg-success/60 border-success/70"
                      : "bg-muted border-border"
                  } ${isUpdating(sub.id) ? "opacity-60 cursor-not-allowed" : ""}`}
                  title={isActive(sub) ? "Disable subscription" : "Enable subscription"}
                  aria-label={`${
                    isActive(sub) ? "Disable" : "Enable"
                  } ${sub.title}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-background transition ${
                      isActive(sub) ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(sub);
                  }}
                  className="p-2 hover:bg-destructive/20 text-destructive rounded-lg transition-colors"
                  title="Delete"
                  aria-label={`Delete ${sub.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
