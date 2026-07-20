"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Megaphone,
  Users,
  Building2,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useAdminDelulus, usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { useDashboardOverview } from "@/hooks/dashboard/use-dashboard-overview";
import type { FormattedDelulu } from "@/lib/types";
import {
  DashboardPage,
  DashboardStatGrid,
  DashboardNavCard,
  DashboardCardGrid,
} from "@/components/dashboard/dashboard-ui";
import {
  DashboardBarChart,
  DashboardChartCard,
  DashboardDonutChart,
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

function bucketGoalsByWeek(delulus: FormattedDelulu[], weeks = 8): ChartDatum[] {
  const now = new Date();
  const buckets: ChartDatum[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);

    const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    buckets.push({ label, value: 0 });
  }

  for (const d of delulus) {
    const created = d.createdAt;
    if (!created) continue;
    const t = created.getTime();
    for (let i = 0; i < weeks; i++) {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      end.setDate(end.getDate() - (weeks - 1 - i) * 7);
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      if (t >= start.getTime() && t <= end.getTime()) {
        buckets[i].value += 1;
        break;
      }
    }
  }

  return buckets;
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
  const { delulus, isLoading: loadingDelulus } = useAdminDelulus();
  const { milestones: pendingMilestones, isLoading: loadingMilestones } = usePendingMilestones();
  const { data: platform, isLoading: loadingPlatform } = useDashboardOverview();

  const stats = useMemo(() => {
    const now = new Date();
    const active = delulus.filter((d) => !d.isResolved && !d.isCancelled).length;
    const resolved = delulus.filter((d) => d.isResolved).length;
    const endedUnresolved = delulus.filter(
      (d) => d.stakingDeadline && d.stakingDeadline <= now && !d.isResolved && !d.isCancelled,
    ).length;
    const endingSoon = delulus.filter((d) => {
      if (d.isResolved || d.isCancelled) return false;
      const dl = d.resolutionDeadline?.getTime() ?? 0;
      const week = 7 * 24 * 60 * 60 * 1000;
      return dl > now.getTime() && dl <= now.getTime() + week;
    }).length;

    return {
      total: delulus.length,
      active,
      resolved,
      pendingMilestones: pendingMilestones.length,
      endedUnresolved,
      endingSoon,
    };
  }, [delulus, pendingMilestones]);

  const weeklyGoals = useMemo(() => bucketGoalsByWeek(delulus), [delulus]);
  const weeklyTrend = useMemo(() => weeklyGoals.map((b) => b.value), [weeklyGoals]);

  const goalStatusChart = useMemo<ChartDatum[]>(
    () => [
      { label: "Active", value: stats.active, color: "#10b981" },
      { label: "Resolved", value: stats.resolved, color: "#2563eb" },
      { label: "Needs resolution", value: stats.endedUnresolved, color: "#f59e0b" },
    ],
    [stats],
  );

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

  const isLoading = loadingDelulus || loadingMilestones;

  return (
    <DashboardPage className="max-w-7xl">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Platform health, goals activity, and items that need attention.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Goals data from subgraph · Communities from database
        </p>
      </div>

      <DashboardStatGrid className="mb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <EnhancedStat
          label="Goals"
          value={stats.total}
          icon={Target}
          trend={weeklyTrend}
          isLoading={isLoading}
        />
        <EnhancedStat
          label="Active"
          value={stats.active}
          sub={stats.endingSoon > 0 ? `${stats.endingSoon} ending soon` : undefined}
          icon={TrendingUp}
          accent="bg-emerald-50 text-emerald-600"
          isLoading={isLoading}
        />
        <EnhancedStat
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          accent="bg-delulu-blue-light text-delulu-blue"
          isLoading={isLoading}
        />
        <EnhancedStat
          label="Pending review"
          value={stats.pendingMilestones}
          icon={ShieldCheck}
          accent="bg-amber-50 text-amber-600"
          isLoading={isLoading}
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

      {(stats.pendingMilestones > 0 || stats.endedUnresolved > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {stats.pendingMilestones > 0 ? (
            <Link
              href="/dashboard/milestones"
              className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-foreground hover:bg-amber-50"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                {stats.pendingMilestones} milestone{stats.pendingMilestones === 1 ? "" : "s"} to review
              </span>
              <span className="text-xs font-bold text-amber-700">Review →</span>
            </Link>
          ) : null}
          {stats.endedUnresolved > 0 ? (
            <Link
              href="/dashboard/markets"
              className="flex items-center justify-between rounded-2xl border border-delulu-blue-border bg-delulu-blue-light px-4 py-3 text-sm font-semibold text-foreground hover:bg-delulu-blue-light/80"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-delulu-blue" />
                {stats.endedUnresolved} goal{stats.endedUnresolved === 1 ? "" : "s"} need resolution
              </span>
              <span className="text-xs font-bold text-delulu-blue">Open →</span>
            </Link>
          ) : null}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <DashboardChartCard title="Goals created" subtitle="Last 8 weeks">
          <DashboardBarChart data={weeklyGoals} />
        </DashboardChartCard>

        <DashboardChartCard title="Goal status" subtitle="On-chain goals breakdown">
          <DashboardDonutChart data={goalStatusChart} />
        </DashboardChartCard>
      </div>

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
                  in the last 7 days · {platform?.users.total ?? 0} total users
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-foreground">Quick links</h3>
        <DashboardCardGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <DashboardNavCard href="/dashboard/communities" icon={Building2} label="Communities" />
          <DashboardNavCard
            href="/dashboard/milestones"
            icon={ShieldCheck}
            label="Milestones"
            badge={stats.pendingMilestones}
          />
          <DashboardNavCard href="/dashboard/markets" icon={Target} label="Goals" />
          <DashboardNavCard href="/dashboard/broadcasts" icon={Megaphone} label="Broadcasts" />
          <DashboardNavCard href="/dashboard/users" icon={Users} label="Users" />
          <DashboardNavCard
            href="/dashboard/markets"
            icon={AlertTriangle}
            label="Needs resolution"
            badge={stats.endedUnresolved}
          />
        </DashboardCardGrid>
      </div>
    </DashboardPage>
  );
}
