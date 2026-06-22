"use client";

import { useQuery } from "@tanstack/react-query";

export type DashboardOverviewStats = {
  communities: { total: number; active: number };
  campaigns: {
    total: number;
    byStatus: Record<string, number>;
    pendingApproval: number;
    active: number;
    funded: number;
  };
  users: { total: number; newThisWeek: number };
  members: { total: number; claimed: number };
};

export const dashboardOverviewKey = ["dashboard", "overview"] as const;

async function fetchOverview(): Promise<DashboardOverviewStats> {
  const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load overview");
  return res.json();
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: dashboardOverviewKey,
    queryFn: fetchOverview,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
