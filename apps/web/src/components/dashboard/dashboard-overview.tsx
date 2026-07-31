"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Building2,
  Flag,
  UserPlus,
  Wallet,
} from "lucide-react";
import { usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { useDashboardOverview } from "@/hooks/dashboard/use-dashboard-overview";
import {
  DashboardPage,
  DashboardStatGrid,
} from "@/components/dashboard/dashboard-ui";
import {
  DashboardChartCard,
  DashboardHorizontalBars,
  DashboardSparkline,
  type ChartDatum,
} from "@/components/dashboard/dashboard-charts";
import { cn } from "@/lib/utils";

function EnhancedStat({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  isLoading,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  trend?: number[];
  isLoading?: boolean;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {isLoading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-muted" />
          ) : (
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          )}
          {sub && !isLoading ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            accent ?? "bg-delulu-blue-light text-delulu-blue",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && trend.length > 1 && !isLoading ? (
        <div className="mt-3 flex justify-end">
          <DashboardSparkline data={trend} />
        </div>
      ) : null}
    </div>
  );
}

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  funding: "Funding",
  active: "Active",
  ended: "Ended",
  rejected: "Rejected",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  pending_approval: "#f59e0b",
  approved: "#2563eb",
  funding: "#8b5cf6",
  active: "#10b981",
  ended: "#64748b",
  rejected: "#ef4444",
};

export function DashboardOverview() {
  const { milestones: pendingMilestones, isLoading: loadingMilestones } =
    usePendingMilestones();
  const { data: platform, isLoading: loadingPlatform } = useDashboardOverview();

  const pendingCount = pendingMilestones.length;

  const campaignPipeline = useMemo<ChartDatum[]>(() => {
    const byStatus = platform?.campaigns.byStatus ?? {};
    return Object.entries(byStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        label: CAMPAIGN_STATUS_LABELS[status] ?? status.replace(/_/g, " "),
        value: count,
        color: CAMPAIGN_STATUS_COLORS[status],
      }));
  }, [platform]);

  return (
    <DashboardPage className="max-w-7xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-foreground">Home</h2>
        <p className="text-sm text-muted-foreground">
          Platform health and items that need attention.
        </p>
      </div>

      <DashboardStatGrid className="mb-4 sm:grid-cols-2 lg:grid-cols-4">
        <EnhancedStat
          label="Pending review"
          value={pendingCount}
          icon={ShieldCheck}
          accent="bg-amber-50 text-amber-600"
          isLoading={loadingMilestones}
        />
        <EnhancedStat
          label="Campaigns"
          value={platform?.campaigns.total ?? "—"}
          icon={Flag}
          isLoading={loadingPlatform}
        />
        <EnhancedStat
          label="Communities"
          value={platform?.communities.total ?? "—"}
          sub={platform ? `${platform.communities.active} active` : undefined}
          icon={Building2}
          isLoading={loadingPlatform}
        />
        <EnhancedStat
          label="Users"
          value={platform?.users.total ?? "—"}
          sub={
            platform && platform.users.newThisWeek > 0
              ? `+${platform.users.newThisWeek} this week`
              : undefined
          }
          icon={Users}
          isLoading={loadingPlatform}
        />
      </DashboardStatGrid>

      {pendingCount > 0 ? (
        <div className="mb-6">
          <Link
            href="/dashboard/milestones"
            className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-foreground hover:bg-amber-50"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              {pendingCount} milestone{pendingCount === 1 ? "" : "s"} to review
            </span>
            <span className="text-xs font-bold text-amber-700">Review →</span>
          </Link>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <DashboardChartCard
          title="Campaign pipeline"
          subtitle={`${platform?.campaigns.total ?? 0} total campaigns`}
          className="lg:col-span-1"
        >
          {loadingPlatform ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : campaignPipeline.length > 0 ? (
            <DashboardHorizontalBars data={campaignPipeline} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No campaigns yet</p>
          )}
        </DashboardChartCard>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#e8e8e3] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-delulu-blue" />
              <h3 className="text-sm font-bold text-foreground">Community members</h3>
            </div>
            {loadingPlatform ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{platform?.members.total ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {platform?.members.claimed ?? 0} claimed G$ ·{" "}
                  {(platform?.members.total ?? 0) - (platform?.members.claimed ?? 0)} pending
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0f0eb]">
                  <div
                    className="h-full rounded-full bg-delulu-blue transition-all"
                    style={{
                      width: `${
                        platform?.members.total
                          ? ((platform.members.claimed / platform.members.total) * 100).toFixed(0)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#e8e8e3] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-foreground">New signups</h3>
            </div>
            {loadingPlatform ? (
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{platform?.users.newThisWeek ?? 0}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  since Wednesday · {platform?.users.total ?? 0} total users
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
