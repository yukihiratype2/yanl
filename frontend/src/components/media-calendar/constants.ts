import type { BgmCalendarDay } from "@/lib/bgm";

export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function buildOrderedDays(calendar: BgmCalendarDay[]): BgmCalendarDay[] {
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
}
