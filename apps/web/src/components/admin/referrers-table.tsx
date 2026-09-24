"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Lock, RefreshCw, ShieldOff } from "lucide-react";
import { AdminKpiStrip } from "@/components/admin/admin-ui";
import { WalletCell } from "@/components/admin/wallet-cell";
import { ONBOARDING_STEP_LABELS } from "@/components/referral-onboarding-checklist";
import {
  DashboardTableCard,
  DashboardTableLoading,
  DashboardTableEmptyState,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
} from "@/components/dashboard/dashboard-ui";
import type {
  AdminReferrerItem,
  ReferrerStatus,
} from "@/app/api/dashboard/referrals/referrers/route";

const STATUS_META: Record<
  ReferrerStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-delulu-green/10 text-delulu-green" },
  locked: { label: "Locked", icon: Lock, className: "bg-destructive/10 text-destructive" },
  onboarding: { label: "Onboarding", icon: Clock, className: "bg-muted text-muted-foreground" },
  blocked: { label: "Blocked", icon: ShieldOff, className: "bg-muted text-muted-foreground" },
};

type Filter = "all" | ReferrerStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "locked", label: "Locked" },
  { value: "onboarding", label: "Onboarding" },
];

const STEP_LABEL = Object.fromEntries(ONBOARDING_STEP_LABELS.map((s) => [s.key, s.label]));

function StatusBadge({ status }: { status: ReferrerStatus }) {
  const { label, icon: Icon, className } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function Reason({ item }: { item: AdminReferrerItem }) {
  if (item.status === "locked" && item.standing?.campaign) {
    const { campaign, missedCount } = item.standing;
    return (
      <span>
        {missedCount} missed · today&apos;s proof not in ·{" "}
        <Link
          href={`/communities/${campaign.slug}/campaigns/${campaign.id}`}
          target="_blank"
          className="underline underline-offset-2 hover:text-foreground"
        >
          {campaign.title}
        </Link>
      </span>
    );
  }
  if (item.status === "onboarding") {
    return <span>Missing: {item.missingSteps.map((s) => STEP_LABEL[s] ?? s).join(", ")}</span>;
  }
  if (item.status === "blocked") return <span>Blacklisted</span>;
  return <span>—</span>;
}

/**
 * Who can refer right now. Everyone who has referred at least one signup,
 * checked live against the referral rules (lib/referral/standing.ts +
 * lib/referral/eligibility.ts).
 */
export function ReferrersTable() {
  const [items, setItems] = useState<AdminReferrerItem[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/referrals/referrers", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`);
      }
      const data = json as { referrers: AdminReferrerItem[]; checkedAt: string };
      setItems(data.referrers);
      setCheckedAt(data.checkedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrers");
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<ReferrerStatus, number> = { active: 0, locked: 0, onboarding: 0, blocked: 0 };
    for (const i of items ?? []) c[i.status]++;
    return c;
  }, [items]);

  const visible = (items ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <>
      {items ? (
        <div className="mb-6 flex flex-wrap gap-3">
          {(["active", "locked", "onboarding"] as const).map((s) => (
            <AdminKpiStrip key={s} icon={STATUS_META[s].icon}>
              <span className="text-sm font-bold tabular-nums text-foreground">{counts[s]}</span>
              <span className="text-sm text-muted-foreground">{STATUS_META[s].label.toLowerCase()}</span>
            </AdminKpiStrip>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.value
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {checkedAt
            ? `Checked ${new Date(checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
            : "Refresh"}
        </button>
      </div>

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : error ? (
          <DashboardTableEmptyState title="Couldn't load referrers" description={error} />
        ) : visible.length === 0 ? (
          <DashboardTableEmptyState
            title="No referrers here"
            description="Anyone who has referred at least one signup shows up here."
          />
        ) : (
          <DashboardTableScroll>
            <table className="w-full min-w-[900px] text-left text-sm">
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell>Referrer</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Why</DashboardTableHeadCell>
                  <DashboardTableHeadCell className="text-right">Signups</DashboardTableHeadCell>
                  <DashboardTableHeadCell className="text-right">Counted</DashboardTableHeadCell>
                  <DashboardTableHeadCell className="text-right">G$ sent</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {visible.map((i) => (
                  <DashboardTableRow key={i.address}>
                    <DashboardTableCell>
                      <WalletCell address={i.address} username={i.username} />
                    </DashboardTableCell>
                    <DashboardTableCell>
                      <StatusBadge status={i.status} />
                    </DashboardTableCell>
                    <DashboardTableCell className="max-w-[360px] text-xs text-muted-foreground">
                      <Reason item={i} />
                    </DashboardTableCell>
                    <DashboardTableCell className="text-right tabular-nums">{i.signups}</DashboardTableCell>
                    <DashboardTableCell className="text-right tabular-nums">{i.counted}</DashboardTableCell>
                    <DashboardTableCell className="text-right font-semibold tabular-nums text-delulu-green">
                      {i.gdollarsSent > 0 ? i.gdollarsSent.toLocaleString() : "—"}
                    </DashboardTableCell>
                  </DashboardTableRow>
                ))}
              </DashboardTableBody>
            </table>
          </DashboardTableScroll>
        )}
      </DashboardTableCard>
    </>
  );
}
