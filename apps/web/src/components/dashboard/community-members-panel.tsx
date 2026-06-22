"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClaimSparkline } from "@/components/dashboard/claim-sparkline";
import {
  DashboardPanel,
  DashboardTableScroll,
  DashboardTableHead,
  DashboardTableHeadRow,
  DashboardTableHeadCell,
  DashboardTableBody,
  DashboardTableRow,
  DashboardTableCell,
} from "@/components/dashboard/dashboard-ui";

type MemberFilter = "all" | "claimed" | "unclaimed";

type MemberRow = {
  id: string;
  wallet_address: string;
  username: string | null;
  joined_at: string;
  joined_via: string | null;
  gd_claim_count: number;
  gd_first_claimed_at: string | null;
  claimSparkline: number[];
};

type MembersResponse = {
  stats: { total: number; claimed: number; unclaimed: number; claimsToday: number };
  communitySparkline: number[];
  members: MemberRow[];
  page: number;
  totalPages: number;
};

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function joinLabel(via: string | null) {
  if (via === "onboarding") return "Onboarding";
  if (via === "invite_code") return "Invite";
  if (via === "admin_added") return "Admin";
  return "—";
}

const FILTERS: { id: MemberFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "claimed", label: "Claimed G$" },
  { id: "unclaimed", label: "Unclaimed" },
];

export function CommunityMembersPanel({ communityId }: { communityId: string }) {
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MembersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dashboard/communities/${communityId}/members?filter=${filter}&page=${page}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load members");
      setData(json as MembersResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [communityId, filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  if (loading && !data) {
    return (
      <DashboardPanel>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardPanel>
    );
  }

  if (error) {
    return (
      <DashboardPanel>
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      </DashboardPanel>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total members" value={stats.total} />
          <StatCard label="Claimed G$" value={stats.claimed} />
          <StatCard label="Unclaimed" value={stats.unclaimed} />
          <StatCard label="Claims today (UTC)" value={stats.claimsToday} />
        </div>
      ) : null}

      {data?.communitySparkline ? (
        <DashboardPanel>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Community claims (30d)
              </p>
              <p className="text-sm text-muted-foreground">Daily Good Dollar claim activity</p>
            </div>
            <ClaimSparkline data={data.communitySparkline} className="h-10 w-32" />
          </div>
        </DashboardPanel>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filter === f.id
                ? "bg-delulu-blue text-white"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <DashboardPanel>
        {loading && data ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {!data?.members.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No members match this filter</p>
        ) : (
          <DashboardTableScroll>
            <DashboardTableHead>
              <DashboardTableHeadRow>
                <DashboardTableHeadCell>Member</DashboardTableHeadCell>
                <DashboardTableHeadCell>Joined</DashboardTableHeadCell>
                <DashboardTableHeadCell>Source</DashboardTableHeadCell>
                <DashboardTableHeadCell>Claims</DashboardTableHeadCell>
                <DashboardTableHeadCell>30d</DashboardTableHeadCell>
                <DashboardTableHeadCell>First claim</DashboardTableHeadCell>
              </DashboardTableHeadRow>
            </DashboardTableHead>
            <DashboardTableBody>
              {data.members.map((m) => (
                <DashboardTableRow key={m.id}>
                  <DashboardTableCell>
                    <div>
                      <p className="font-mono text-xs">{m.username ? `@${m.username}` : formatAddress(m.wallet_address)}</p>
                    </div>
                  </DashboardTableCell>
                  <DashboardTableCell className="text-xs text-muted-foreground">
                    {formatDate(m.joined_at)}
                  </DashboardTableCell>
                  <DashboardTableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {joinLabel(m.joined_via)}
                    </span>
                  </DashboardTableCell>
                  <DashboardTableCell className="tabular-nums font-semibold">
                    {m.gd_claim_count}
                  </DashboardTableCell>
                  <DashboardTableCell>
                    <ClaimSparkline data={m.claimSparkline} />
                  </DashboardTableCell>
                  <DashboardTableCell className="text-xs text-muted-foreground">
                    {m.gd_first_claimed_at ? formatDate(m.gd_first_claimed_at) : "—"}
                  </DashboardTableCell>
                </DashboardTableRow>
              ))}
            </DashboardTableBody>
          </DashboardTableScroll>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs font-semibold text-delulu-blue disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs font-semibold text-delulu-blue disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
        </DashboardPanel>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
}
