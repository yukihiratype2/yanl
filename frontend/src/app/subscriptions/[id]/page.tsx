"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  getSubscription,
  tmdbImage,
  updateSubscription,
  type Subscription,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/errors";
import ExpandedSubscription from "../components/ExpandedSubscription";

function statusClasses(status: string) {
  return status === "active"
    ? "border-transparent bg-success/20 text-success"
    : "border-transparent bg-muted/20 text-muted-foreground";
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const rawId = params?.id;
  const id = Array.isArray(rawId) ? Number(rawId[0]) : Number(rawId);
  const isValidId = Number.isFinite(id);

  const loadSubscription = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      setError("Invalid subscription id.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const detail = await getSubscription(id);
      setSubscription(detail);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load subscription."));
    } finally {
      setLoading(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  async function handleToggle() {
    if (!subscription) return;
    const nextStatus =
      subscription.status === "active" ? "disabled" : "active";
    try {
      setUpdating(true);
      await updateSubscription(subscription.id, { status: nextStatus });
      setSubscription({ ...subscription, status: nextStatus });
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Failed to update subscription."));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => router.push("/subscriptions")}
          variant="outline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Subscription Detail</h1>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && subscription && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6">
            <Image
              src={tmdbImage(subscription.poster_path, "w342")}
              alt={subscription.title}
              width={176}
              height={264}
              className="w-32 md:w-44 rounded-lg object-cover aspect-[2/3]"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{subscription.title}</h2>
              {subscription.title_original && (
                <p className="text-sm text-muted-foreground mt-1">
                  {subscription.title_original}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-muted-foreground">
                <Badge
                  variant="secondary"
                  className="h-5 border-transparent bg-primary/20 text-[10px] uppercase text-primary"
                >
                  {subscription.media_type}
                </Badge>
                {subscription.season_number != null && (
                  <span>Season {subscription.season_number}</span>
                )}
                {subscription.total_episodes && (
                  <span>{subscription.total_episodes} episodes</span>
                )}
                <Badge className={statusClasses(subscription.status)}>
                  {subscription.status}
                </Badge>
                <Switch
                  checked={subscription.status === "active"}
                  onClick={handleToggle}
                  disabled={updating}
                  title={
                    subscription.status === "active"
                      ? "Disable subscription"
                      : "Enable subscription"
                  }
                  aria-label={`${
                    subscription.status === "active" ? "Disable" : "Enable"
                  } ${subscription.title}`}
                />
                {subscription.first_air_date && (
                  <span>{subscription.first_air_date}</span>
                )}
              </div>
              {subscription.overview && (
                <p className="text-sm text-muted-foreground mt-4 whitespace-pre-line">
                  {subscription.overview}
                </p>
              )}
            </div>
          </div>

          <ExpandedSubscription
            sub={subscription}
            onUpdate={loadSubscription}
          />
        </div>
      )}
    </div>
  );
}
