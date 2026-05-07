"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAdminDelulus, usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { BarChart3, ShieldCheck, Megaphone, Users, AlertTriangle, Activity, Clock, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: "green" | "red" | "blue" | "neutral";
  isLoading?: boolean;
}) {
  const border = { green: "border-l-[#35d07f]", red: "border-l-red-400", blue: "border-l-sky-400", neutral: "border-l-border" };
  const icon = { green: "text-[#1a8f53] dark:text-[#35d07f]", red: "text-red-500", blue: "text-sky-500", neutral: "text-muted-foreground" };
  return (
    <div className={cn("rounded-xl border border-border border-l-4 bg-card px-5 py-5 shadow-sm", border[accent])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          {isLoading ? (
            <div className="mt-2 h-8 w-12 rounded bg-muted animate-pulse" />
          ) : (
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">{value}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60", icon[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  description,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:bg-muted/30 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-foreground">{label}</p>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-black text-background tabular-nums min-w-[20px]">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

export default function AdminOverviewPage() {
  const { delulus, isLoading: loadingDelulus } = useAdminDelulus();
  const { milestones: pendingMilestones, isLoading: loadingMilestones } = usePendingMilestones();

  const stats = useMemo(() => {
    const now = new Date();
    const active = delulus.filter((d) => !d.isResolved && !d.isCancelled).length;
    const endedUnresolved = delulus.filter(
      (d) => d.stakingDeadline && d.stakingDeadline <= now && !d.isResolved && !d.isCancelled,
    ).length;
    return { total: delulus.length, active, pendingMilestones: pendingMilestones.length, endedUnresolved };
  }, [delulus, pendingMilestones]);

  const isLoading = loadingDelulus || loadingMilestones;

  return (
    <div className="w-full px-5 sm:px-7 py-6 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Platform health at a glance.</p>
      </div>

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Markets" value={stats.total} icon={BarChart3} accent="blue" isLoading={isLoading} />
        <KpiCard label="Active Markets" value={stats.active} icon={Activity} accent="green" isLoading={isLoading} />
        <KpiCard label="Pending Review" value={stats.pendingMilestones} icon={ShieldCheck} accent="neutral" isLoading={isLoading} />
        <KpiCard label="Needs Resolution" value={stats.endedUnresolved} icon={Clock} accent="red" isLoading={isLoading} />
      </div>

      {/* Alert if there are pending milestones */}
      {stats.pendingMilestones > 0 && (
        <Link
          href="/admin/milestones"
          className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/30 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {stats.pendingMilestones} milestone{stats.pendingMilestones !== 1 ? "s" : ""} waiting for verification
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Review →</span>
        </Link>
      )}

      {/* Quick links */}
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick access</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <QuickLink
          href="/admin/milestones"
          icon={ShieldCheck}
          label="Milestone Queue"
          description="Review and verify submitted milestone proofs"
          badge={stats.pendingMilestones}
        />
        <QuickLink
          href="/admin/markets"
          icon={BarChart3}
          label="All Markets"
          description={`${stats.total} indexed delulus`}
        />
        <QuickLink
          href="/admin/broadcasts"
          icon={Megaphone}
          label="Broadcasts"
          description="Email creators who haven't set milestones yet"
        />
        <QuickLink
          href="/admin/users"
          icon={Users}
          label="Users"
          description="View and manage registered profiles"
        />
      </div>
    </div>
  );
}
