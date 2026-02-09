function toValidDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatSchedule(cron: string): string {
  const map: Record<string, string> = {
    "0 0 * * *": "Daily at midnight",
    "0 * * * *": "Every hour",
    "*/5 * * * *": "Every 5 minutes",
    "*/10 * * * *": "Every 10 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
  };
  return map[cron] || cron;
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "-";

  const date = toValidDate(iso);
  if (!date) return "-";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  if (absDiff < 60_000) {
    const seconds = Math.round(absDiff / 1000);
    return isFuture ? `in ${seconds}s` : `${seconds}s ago`;
  }
  if (absDiff < 3_600_000) {
    const minutes = Math.round(absDiff / 60_000);
    return isFuture ? `in ${minutes}m` : `${minutes}m ago`;
  }
  if (absDiff < 86_400_000) {
    const hours = Math.round(absDiff / 3_600_000);
    return isFuture ? `in ${hours}h` : `${hours}h ago`;
  }
  const days = Math.round(absDiff / 86_400_000);
  return isFuture ? `in ${days}d` : `${days}d ago`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = toValidDate(iso);
  if (!date) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
