"use client";

import { useQuery } from "@tanstack/react-query";

export type ForfeitPeriodAdmin = {
  id: string;
  periodIndex: number;
  proofUrl: string | null;
  aiVerdict: unknown;
  verifierAction: string | null;
  resolvedAt: string | null;
  txHash: string | null;
  createdAt: string;
};

export type ForfeitCommitmentAdmin = {
  id: string;
  onChainId: number | null;
  creatorWallet: string;
  creatorUsername: string | null;
  title: string;
  description: string | null;
  evidenceType: string;
  verificationMethod: string;
  isPrivate: boolean;
  remindEnabled: boolean;
  isCharityIntent: boolean;
  stakeAmountWei: string | null;
  stakeAmount: number | null;
  token: string | null;
  tokenSymbol: string;
  destinationType: number | null;
  destinationLabel: string;
  destinationAddr: string | null;
  destinationFriendUsername: string | null;
  destinationFriendEmail: string | null;
  verifierWallet: string | null;
  status: string;
  createTxHash: string | null;
  createdAt: string;
  confirmedAt: string | null;
  periodCount: number;
  proofsSubmitted: number;
  proofsApproved: number;
  proofsRejected: number;
  periods: ForfeitPeriodAdmin[];
};

export type ForfeitChartPoint = {
  key: string;
  label: string;
  value: number;
  color?: string;
};

export type ForfeitAnalytics = {
  kpis: {
    total: number;
    active: number;
    completed: number;
    forfeited: number;
    cancelled: number;
    pendingConfirmation: number;
    createdToday: number;
    createdThisWeek: number;
    proofsSubmitted: number;
    proofsApproved: number;
    proofsRejected: number;
    proofsResolved: number;
    proofsToday: number;
    proofsThisWeek: number;
  };
  byStatus: ForfeitChartPoint[];
  byEvidence: ForfeitChartPoint[];
  byVerification: ForfeitChartPoint[];
  byDestination: ForfeitChartPoint[];
  createdDaily: ForfeitChartPoint[];
  createdWeekly: ForfeitChartPoint[];
  proofsDaily: ForfeitChartPoint[];
  proofsWeekly: ForfeitChartPoint[];
  growthCumulative: ForfeitChartPoint[];
};

export type ForfeitDashboardResponse = {
  commitments: ForfeitCommitmentAdmin[];
  total: number;
  page: number;
  pageSize: number;
  analytics: ForfeitAnalytics;
};

export type ForfeitDashboardFilters = {
  page: number;
  query: string;
  status: string;
};

export const dashboardForfeitKey = (filters: ForfeitDashboardFilters) =>
  ["dashboard", "forfeit", filters] as const;

async function fetchForfeitDashboard(
  filters: ForfeitDashboardFilters,
): Promise<ForfeitDashboardResponse> {
  const params = new URLSearchParams({
    page: String(filters.page),
  });
  if (filters.query) params.set("query", filters.query);
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  const res = await fetch(`/api/dashboard/forfeit?${params}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? `Request failed: ${res.status}`,
    );
  }
  return json as ForfeitDashboardResponse;
}

export function useDashboardForfeit(filters: ForfeitDashboardFilters) {
  return useQuery({
    queryKey: dashboardForfeitKey(filters),
    queryFn: () => fetchForfeitDashboard(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });
}
