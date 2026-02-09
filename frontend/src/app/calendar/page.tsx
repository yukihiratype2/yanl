"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getCalendarEpisodes, tmdbImage, type CalendarEpisode } from "@/lib/api";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [episodes, setEpisodes] = useState<CalendarEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  useEffect(() => {
    loadEpisodes();
  }, [year, month]);

  async function loadEpisodes() {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      totalDays
    ).padStart(2, "0")}`;
    try {
      setLoading(true);
      const res = await getCalendarEpisodes(start, end);
      setEpisodes(res.episodes);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const episodesByDate = useMemo(() => {
    const map: Record<string, CalendarEpisode[]> = {};
    for (const ep of episodes) {
      if (!ep.air_date) continue;
      if (!map[ep.air_date]) map[ep.air_date] = [];
      map[ep.air_date].push(ep);
    }
    return map;
  }, [episodes]);

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let i = 1; i <= totalDays; i++) cells.push(i);
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 0; i < remaining; i++) cells.push(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6" /> Calendar
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90"
          >
            Today
          </button>
          <h2 className="text-lg font-semibold w-40 text-center">
            {currentDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
            })}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[100px] border-b border-r border-border bg-background/50"
                />
              );
            }

            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const dayEpisodes = episodesByDate[dateStr] || [];
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`min-h-[100px] border-b border-r border-border p-1.5 ${
                  isToday ? "bg-primary/10" : ""
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 ${
                    isToday
                      ? "text-primary font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-1">
                  {dayEpisodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex items-center gap-1 p-1 bg-accent/10 rounded text-xs group cursor-default"
                      title={`${ep.subscription_title} E${String(
                        ep.episode_number
                      ).padStart(2, "0")} - ${ep.title || ""}`}
                    >
                      <img
                        src={tmdbImage(ep.poster_path, "w92")}
                        alt=""
                        className="w-4 h-6 object-cover rounded-sm shrink-0"
                      />
                      <span className="truncate">
                        {ep.subscription_title} E
                        {String(ep.episode_number).padStart(2, "0")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
