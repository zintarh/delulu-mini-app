"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Search, Sparkles, X } from "lucide-react";
import { formatAddress } from "@/lib/utils";
import { AdminKpiStrip, AdminPagination } from "@/components/admin/admin-ui";
import {
  DashboardPage,
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
import {
  DashboardSectionTabs,
  PEOPLE_SECTION_TABS,
} from "@/components/dashboard/dashboard-section-tabs";

type ReferralRow = {
  id: string;
  referrerAddress: string;
  referrerUsername: string | null;
  referredAddress: string;
  referredUsername: string | null;
  qualifyingAction: "forfeit" | "campaign_join";
  gdollarsAmount: number;
  payoutStatus: "not_eligible" | "sent" | "failed";
  payoutTxHash: string | null;
  creditedAt: string;
};

type ReferralsResponse = {
  referrals: ReferralRow[];
  total: number;
  totalGDollars: number;
  page: number;
  pageSize: number;
};

const ACTION_LABEL: Record<ReferralRow["qualifyingAction"], string> = {
  forfeit: "Started a Forfeit",
  campaign_join: "Joined a campaign",
};

const PAYOUT_STATUS_STYLE: Record<ReferralRow["payoutStatus"], string> = {
  sent: "bg-delulu-green/10 text-delulu-green",
  failed: "bg-destructive/10 text-destructive",
  not_eligible: "bg-muted text-muted-foreground",
};

const PAYOUT_STATUS_LABEL: Record<ReferralRow["payoutStatus"], string> = {
  sent: "Sent",
  failed: "Failed",
  not_eligible: "Locked",
};

function PayoutStatusBadge({ status }: { status: ReferralRow["payoutStatus"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYOUT_STATUS_STYLE[status]}`}
    >
      {PAYOUT_STATUS_LABEL[status]}
    </span>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WalletCell({
  address,
  username,
}: {
  address: string;
  username: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">
          {username ? `@${username}` : formatAddress(address as `0x${string}`)}
        </p>
        {username ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            {formatAddress(address as `0x${string}`)}
          </p>
        ) : null}
      </div>
      <a
        href={`https://celoscan.io/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        title="View on Celoscan"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function AdminReferralsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set("query", debouncedSearch);
      const res = await fetch(`/api/dashboard/referrals?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error ?? `Request failed: ${res.status}`,
        );
      }
      setData(json as ReferralsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referrals");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardSectionTabs items={PEOPLE_SECTION_TABS} />
      <p className="mb-5 text-sm text-muted-foreground">
        Every counted referral — verified, then joined a campaign or started a Forfeit. 6,000 G$
        each, unlocked once a wallet has 5 counted referrals.
      </p>

      {data ? (
        <div className="mb-6 flex flex-wrap gap-3">
          <AdminKpiStrip icon={Sparkles}>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {data.total}
            </span>
            <span className="text-sm text-muted-foreground">
              {data.total === 1 ? "referral" : "referrals"}
            </span>
          </AdminKpiStrip>
          <AdminKpiStrip icon={Sparkles}>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {data.totalGDollars.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">G$ sent</span>
          </AdminKpiStrip>
        </div>
      ) : null}

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search referrer or referred address…"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : error ? (
          <DashboardTableEmptyState title="Couldn't load referrals" description={error} />
        ) : !data || data.referrals.length === 0 ? (
          <DashboardTableEmptyState
            title="No successful referrals yet"
            description="Referrals show up here once the referred wallet verifies and joins a campaign or starts a Forfeit."
          />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[980px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>Referrer</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Referred user</DashboardTableHeadCell>
                    <DashboardTableHeadCell>How</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="text-right">G$</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Payout</DashboardTableHeadCell>
                    <DashboardTableHeadCell>When</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.referrals.map((r) => (
                    <DashboardTableRow key={r.id}>
                      <DashboardTableCell>
                        <WalletCell address={r.referrerAddress} username={r.referrerUsername} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <WalletCell address={r.referredAddress} username={r.referredUsername} />
                      </DashboardTableCell>
                      <DashboardTableCell className="text-muted-foreground">
                        {ACTION_LABEL[r.qualifyingAction]}
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right font-semibold tabular-nums text-delulu-green">
                        {r.payoutStatus === "sent" ? `+${r.gdollarsAmount.toLocaleString()}` : "—"}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {r.payoutTxHash ? (
                          <a
                            href={`https://celoscan.io/tx/${r.payoutTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            <PayoutStatusBadge status={r.payoutStatus} />
                          </a>
                        ) : (
                          <PayoutStatusBadge status={r.payoutStatus} />
                        )}
                      </DashboardTableCell>
                      <DashboardTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatWhen(r.creditedAt)}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
            <AdminPagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </DashboardTableCard>
    </DashboardPage>
  );
}
