"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Gift,
  Search,
  X,
} from "lucide-react";
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

type GrantRow = {
  id: string;
  recipientAddress: string;
  recipientUsername: string | null;
  tokenSymbol: string;
  amount: number;
  reason: string | null;
  txHash: string;
  senderAddress: string;
  staffEmail: string | null;
  createdAt: string;
};

type GrantsResponse = {
  grants: GrantRow[];
  total: number;
  page: number;
  pageSize: number;
};

function formatAmount(amount: number, symbol: string) {
  const display =
    amount >= 1000
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${display} ${symbol}`;
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

export default function AdminRewardTransactionsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<GrantsResponse | null>(null);
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
      const res = await fetch(`/api/dashboard/rewards/grants?${params}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error ?? `Request failed: ${res.status}`,
        );
      }
      setData(json as GrantsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
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
        Every admin RewardVault send — open the Celoscan link to verify on-chain. Reward someone from
        Directory or Leaderboard.
      </p>

      {data ? (
        <AdminKpiStrip icon={Gift}>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {data.total}
          </span>
          <span className="text-sm text-muted-foreground">
            {data.total === 1 ? "transaction" : "transactions"}
          </span>
        </AdminKpiStrip>
      ) : null}

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipient, tx, token, staff…"
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <DashboardTableEmptyState title="Couldn’t load transactions" description={error} />
        ) : !data || data.grants.length === 0 ? (
          <DashboardTableEmptyState
            title="No reward transactions yet"
            description="Sends from Users or Leaderboard will show up here with a Celoscan link."
          />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[920px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>When</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Recipient</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Amount</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Reason</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Sent by</DashboardTableHeadCell>
                    <DashboardTableHeadCell className="w-28 text-right">
                      Tx
                    </DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.grants.map((grant) => (
                    <DashboardTableRow key={grant.id}>
                      <DashboardTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatWhen(grant.createdAt)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {grant.recipientUsername
                              ? `@${grant.recipientUsername}`
                              : formatAddress(grant.recipientAddress as `0x${string}`)}
                          </p>
                          {grant.recipientUsername ? (
                            <p className="font-mono text-[11px] text-muted-foreground">
                              {formatAddress(grant.recipientAddress as `0x${string}`)}
                            </p>
                          ) : null}
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell className="font-semibold tabular-nums">
                        {formatAmount(grant.amount, grant.tokenSymbol)}
                      </DashboardTableCell>
                      <DashboardTableCell className="max-w-[200px]">
                        <span className="line-clamp-2 text-muted-foreground">
                          {grant.reason?.trim() || "—"}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="min-w-0">
                          {grant.staffEmail ? (
                            <p className="truncate text-xs text-foreground">
                              {grant.staffEmail}
                            </p>
                          ) : null}
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {formatAddress(grant.senderAddress as `0x${string}`)}
                          </p>
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell className="text-right">
                        {grant.txHash ? (
                          <a
                            href={`https://celoscan.io/tx/${grant.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-delulu-blue transition-colors hover:bg-delulu-blue-light"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
            <AdminPagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
            />
          </>
        )}
      </DashboardTableCard>
    </DashboardPage>
  );
}
