"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WeeklyActivityResult } from "@/lib/user-activity-subgraph";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar Monday 00:00:00 for the week containing `date`. */
export function startOfWeekMonday(date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** e.g. "Jul 20 – 26" or "Jul 28 – Aug 3" */
export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const mMonth = MONTH_SHORT[monday.getMonth()];
  const sMonth = MONTH_SHORT[sunday.getMonth()];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${mMonth} ${monday.getDate()} – ${sunday.getDate()}`;
  }
  return `${mMonth} ${monday.getDate()} – ${sMonth} ${sunday.getDate()}`;
}

export const dailyActivityKeys = {
  week: (address: string, weekStart: string) =>
    ["home", "daily-activity", address.toLowerCase(), weekStart] as const,
};

async function fetchWeeklyActivity(input: {
  address: string;
  weekStart: string;
  fromUnix: number;
  toUnix: number;
  tzOffsetMinutes: number;
}): Promise<WeeklyActivityResult> {
  const params = new URLSearchParams({
    address: input.address,
    weekStart: input.weekStart,
    from: String(input.fromUnix),
    to: String(input.toUnix),
    tzOffsetMinutes: String(input.tzOffsetMinutes),
  });
  const res = await fetch(`/api/user/activity/week?${params}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error ?? "Failed to load activity");
  }
  return json as WeeklyActivityResult;
}

export function useDailyActivity(address: string | undefined) {
  const currentMonday = useMemo(() => startOfWeekMonday(new Date()), []);
  const [weekMonday, setWeekMonday] = useState(() => startOfWeekMonday(new Date()));

  const weekStart = toIsoDateLocal(weekMonday);
  const fromUnix = Math.floor(weekMonday.getTime() / 1000);
  const toUnix = Math.floor(addDays(weekMonday, 7).getTime() / 1000);
  const tzOffsetMinutes =
    typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;

  const canGoForward = weekMonday.getTime() < currentMonday.getTime();

  const query = useQuery({
    queryKey: dailyActivityKeys.week(address ?? "", weekStart),
    queryFn: () =>
      fetchWeeklyActivity({
        address: address!,
        weekStart,
        fromUnix,
        toUnix,
        tzOffsetMinutes,
      }),
    enabled: Boolean(address),
    staleTime: 30_000,
  });

  const goPrevWeek = useCallback(() => {
    setWeekMonday((prev) => addDays(prev, -7));
  }, []);

  const goNextWeek = useCallback(() => {
    setWeekMonday((prev) => {
      const next = addDays(prev, 7);
      if (next.getTime() > currentMonday.getTime()) return prev;
      return next;
    });
  }, [currentMonday]);

  return {
    weekMonday,
    weekStart,
    weekLabel: formatWeekRange(weekMonday),
    canGoForward,
    goPrevWeek,
    goNextWeek,
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
