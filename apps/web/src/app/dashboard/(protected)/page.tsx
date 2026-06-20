"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAdminDelulus, usePendingMilestones } from "@/hooks/graph/useAdminDashboard";
import { ShieldCheck, Megaphone, Users, Activity, Clock, Building2, Target } from "lucide-react";
import {
  DashboardPage,
  DashboardStatGrid,
  DashboardStat,
  DashboardNavCard,
  DashboardCardGrid,
} from "@/components/dashboard/dashboard-ui";

export default function AdminOverviewPage() {
  const { delulus, isLoading: loadingDelulus } = useAdminDelulus();
  const { milestones: pendingMilestones, isLoading: loadingMilestones } = usePendingMilestones();

  const stats = useMemo(() => {
    const now = new Date();
    const active = delulus.filter((d) => !d.isResolved && !d.isCancelled).length;
    const endedUnresolved = delulus.filter(
      (d) => d.stakingDeadline && d.stakingDeadline <= now && !d.isResolved && !d.isCancelled,
    ).length;
    return {
      total: delulus.length,
      active,
      pendingMilestones: pendingMilestones.length,
      endedUnresolved,
    };
  }, [delulus, pendingMilestones]);

  const isLoading = loadingDelulus || loadingMilestones;

  return (
    <DashboardPage>
      <DashboardStatGrid>
        <DashboardStat label="Goals" value={stats.total} isLoading={isLoading} />
        <DashboardStat label="Active" value={stats.active} isLoading={isLoading} />
        <DashboardStat label="Pending" value={stats.pendingMilestones} isLoading={isLoading} />
        <DashboardStat label="Unresolved" value={stats.endedUnresolved} isLoading={isLoading} />
      </DashboardStatGrid>

      {stats.pendingMilestones > 0 ? (
        <Link
          href="/dashboard/milestones"
          className="mb-6 flex items-center justify-between rounded-2xl border border-delulu-blue-border bg-delulu-blue-light px-4 py-3 text-sm font-semibold text-foreground hover:bg-delulu-blue-light/80"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-delulu-blue" />
            {stats.pendingMilestones} to review
          </span>
          <span className="text-xs font-bold text-delulu-blue">Open →</span>
        </Link>
      ) : null}

      <DashboardCardGrid className="sm:grid-cols-2">
        <DashboardNavCard
          href="/dashboard/communities"
          icon={Building2}
          label="Communities"
        />
        <DashboardNavCard
          href="/dashboard/milestones"
          icon={ShieldCheck}
          label="Milestones"
          badge={stats.pendingMilestones}
        />
        <DashboardNavCard href="/dashboard/markets" icon={Target} label="Goals" />
        <DashboardNavCard href="/dashboard/broadcasts" icon={Megaphone} label="Broadcasts" />
        <DashboardNavCard href="/dashboard/users" icon={Users} label="Users" />
        <DashboardNavCard href="/dashboard/send-email" icon={Activity} label="Email" />
        <DashboardNavCard
          href="/dashboard/markets"
          icon={Clock}
          label="Needs resolution"
          badge={stats.endedUnresolved}
        />
      </DashboardCardGrid>
    </DashboardPage>
  );
}
