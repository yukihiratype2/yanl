import type { BgmCalendarDay } from "@/lib/bgm";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS } from "./constants";

type MediaCalendarTabsProps = {
  days: BgmCalendarDay[];
  activeTabId: number;
  todayWeekdayId: number;
  onChange: (weekdayId: number) => void;
};

export function MediaCalendarTabs({
  days,
  activeTabId,
  todayWeekdayId,
  onChange,
}: MediaCalendarTabsProps) {
  return (
    <div className="flex items-center justify-center p-1 bg-muted/60 rounded-xl overflow-x-auto no-scrollbar">
      {days.map((day) => {
        const isToday = day.weekday.id === todayWeekdayId;
        const isActive = day.weekday.id === activeTabId;

        return (
          <button
            key={day.weekday.id}
            onClick={() => onChange(day.weekday.id)}
            className={cn(
              "flex-1 min-w-[60px] relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out",
              isActive
                ? "bg-background text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
              isToday && !isActive && "text-primary font-semibold"
            )}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="leading-none">
                {day.weekday.en || WEEKDAY_LABELS[day.weekday.id]}
              </span>
              {day.weekday.cn && (
                <span className="text-[10px] opacity-80 leading-none">{day.weekday.cn}</span>
              )}
            </div>
            {isToday && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
