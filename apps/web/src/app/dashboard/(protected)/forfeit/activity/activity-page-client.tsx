"use client";

import { useState } from "react";
import { ExternalLink, HandCoins, HeartHandshake } from "lucide-react";
import { formatAddress, cn } from "@/lib/utils";
import { AdminFilterPill } from "@/components/admin/admin-ui";
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
import { DashboardSectionTabs, FORFEIT_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import {
  useDashboardForfeitActivity,
  type ForfeitPoolStat,
} from "@/hooks/dashboard/use-dashboard-forfeit-activity";

const OUTCOME_FILTERS = [
  { id: "all", label: "All" },
  { id: "forfeited", label: "Forfeited" },
  { id: "success", label: "Stake returned" },
] as const;

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

function formatAmount(amount: number | null, symbol: string) {
  if (amount == null) return "—";
  const display =
    amount >= 1000
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${display} ${symbol}`;
}

function OutcomeBadge({ outcome }: { outcome: "success" | "forfeited" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        outcome === "forfeited" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
      )}
    >
      {outcome === "forfeited" ? "Forfeited" : "Stake returned"}
    </span>
  );
}

function PoolStatCard({ stat }: { stat: ForfeitPoolStat }) {
  const charityPct =
    stat.balance > 0 ? Math.min(100, Math.round((stat.charityShare / stat.balance) * 100)) : 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Community pool · {stat.tokenSymbol}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {stat.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {stat.charityShare > 0
              ? `of which ~${stat.charityShare.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${charityPct}%) earmarked charity`
              : "none earmarked charity yet"}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-delulu-blue-light text-delulu-blue">
          <HandCoins className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function ForfeitActivityPageClient() {
  const [outcome, setOutcome] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useDashboardForfeitActivity({ page, outcome });

  const loading = isLoading && !data;

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Forfeit activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every stake sent to charity, the community pool, or a friend — and every stake
          returned on success.
        </p>
      </div>

      <DashboardSectionTabs items={FORFEIT_SECTION_TABS} />

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load forfeit activity"}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-3 font-bold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data && data.pool.length > 0 ? (
          data.pool.map((stat) => <PoolStatCard key={stat.token} stat={stat} />)
        ) : isLoading ? (
          <>
            <div className="h-[92px] animate-pulse rounded-2xl bg-muted/40" />
            <div className="h-[92px] animate-pulse rounded-2xl bg-muted/40" />
          </>
        ) : (
          <div className="col-span-full flex items-center gap-2 rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 text-sm text-muted-foreground shadow-sm">
            <HeartHandshake className="h-4 w-4" />
            No pooled balances yet.
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {OUTCOME_FILTERS.map((f) => (
          <AdminFilterPill
            key={f.id}
            active={outcome === f.id}
            onClick={() => {
              setOutcome(f.id);
              setPage(1);
            }}
          >
            {f.label}
          </AdminFilterPill>
        ))}
      </div>

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : !data?.items.length ? (
          <DashboardTableEmptyState
            title="No activity found"
            description="Try another filter."
          />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[1000px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>Date</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Commitment</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Creator</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Outcome</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Amount</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Destination</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Tx</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.items.map((row) => (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatWhen(row.createdAt)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <p className="max-w-[220px] truncate font-semibold text-foreground">
                          {row.commitmentTitle ?? `Commitment #${row.commitmentId}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Period {row.periodIndex}
                        </p>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.creatorUsername ? (
                          <span className="font-semibold">@{row.creatorUsername}</span>
                        ) : (
                          <span className="font-mono text-xs">
                            {formatAddress(row.creatorWallet)}
                          </span>
                        )}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <OutcomeBadge outcome={row.outcome} />
                      </DashboardTableCell>
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {formatAmount(row.amount, row.tokenSymbol)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.destinationLabel ?? "—"}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <a
                          href={`https://celoscan.io/tx/${row.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-delulu-blue hover:opacity-80"
                        >
                          {formatAddress(row.txHash)}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">Page {page}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.hasNextPage}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </DashboardTableCard>
    </DashboardPage>
  );
}
