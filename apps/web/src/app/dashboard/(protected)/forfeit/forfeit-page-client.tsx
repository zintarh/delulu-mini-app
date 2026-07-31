"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Search,
  ShieldAlert,
  X,
  FileCheck2,
  Flame,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { formatAddress, cn } from "@/lib/utils";
import {
  AdminFilterPill,
  AdminPagination,
} from "@/components/admin/admin-ui";
import {
  DashboardPage,
  DashboardStatGrid,
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
  DashboardChartCard,
  DashboardBarChart,
  DashboardDonutChart,
  DashboardHorizontalBars,
  type ChartDatum,
} from "@/components/dashboard/dashboard-charts";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/modal";
import { DashboardSectionTabs, FORFEIT_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import {
  useDashboardForfeit,
  type ForfeitCommitmentAdmin,
} from "@/hooks/dashboard/use-dashboard-forfeit";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "forfeited", label: "Forfeited" },
  { id: "cancelled", label: "Cancelled" },
  { id: "pending_confirmation", label: "Pending" },
] as const;

const RANGE_TABS = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
] as const;

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
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

function formatStake(amount: number | null, symbol: string) {
  if (amount == null || Number.isNaN(amount)) return "—";
  const display =
    amount >= 1000
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return `${display} ${symbol}`;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "active":
      return "bg-delulu-blue-light text-delulu-blue";
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "forfeited":
      return "bg-red-50 text-red-700";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    case "pending_confirmation":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        statusBadgeClass(status),
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8e8e3] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {sub ? (
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
    </div>
  );
}

function toChartData(points: Array<{ label: string; value: number; color?: string }>): ChartDatum[] {
  return points.map((p) => ({
    label: p.label,
    value: p.value,
    color: p.color,
  }));
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[#f0f0eb] py-2.5 text-sm last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function ForfeitDetailModal({
  item,
  open,
  onOpenChange,
}: {
  item: ForfeitCommitmentAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <ModalHeader>
          <ModalTitle className="pr-8">{item.title}</ModalTitle>
          <ModalDescription>
            Full forfeit commitment record and period history
          </ModalDescription>
        </ModalHeader>

        <div className="mt-2 space-y-1">
          <DetailRow label="Status">
            <StatusBadge status={item.status} />
          </DetailRow>
          <DetailRow label="On-chain ID">
            {item.onChainId != null ? `#${item.onChainId}` : "—"}
          </DetailRow>
          <DetailRow label="Creator">
            {item.creatorUsername ? (
              <span>
                @{item.creatorUsername}{" "}
                <span className="text-muted-foreground">
                  ({formatAddress(item.creatorWallet)})
                </span>
              </span>
            ) : (
              formatAddress(item.creatorWallet)
            )}
          </DetailRow>
          <DetailRow label="Description">
            {item.description?.trim() || "—"}
          </DetailRow>
          <DetailRow label="Stake">
            {formatStake(item.stakeAmount, item.tokenSymbol)}
          </DetailRow>
          <DetailRow label="Evidence">{item.evidenceType}</DetailRow>
          <DetailRow label="Verification">{item.verificationMethod}</DetailRow>
          <DetailRow label="Destination">
            {item.destinationLabel}
            {item.destinationFriendUsername
              ? ` · @${item.destinationFriendUsername}`
              : null}
            {item.destinationFriendEmail
              ? ` · ${item.destinationFriendEmail}`
              : null}
            {item.destinationAddr
              ? ` · ${formatAddress(item.destinationAddr)}`
              : null}
          </DetailRow>
          <DetailRow label="Verifier">
            {item.verifierWallet ? formatAddress(item.verifierWallet) : "—"}
          </DetailRow>
          <DetailRow label="Flags">
            {[
              item.isPrivate ? "Private" : "Public",
              item.remindEnabled ? "Reminders on" : "Reminders off",
              item.isCharityIntent ? "Charity intent" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </DetailRow>
          <DetailRow label="Created">{formatWhen(item.createdAt)}</DetailRow>
          <DetailRow label="Confirmed">{formatWhen(item.confirmedAt)}</DetailRow>
          <DetailRow label="Create tx">
            {item.createTxHash ? (
              <a
                href={`https://celoscan.io/tx/${item.createTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-delulu-blue hover:underline"
              >
                {formatAddress(item.createTxHash)}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              "—"
            )}
          </DetailRow>
        </div>

        <div className="mt-6">
          <h4 className="mb-3 text-sm font-bold text-foreground">
            Periods ({item.periods.length})
          </h4>
          {item.periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No periods recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {item.periods.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-[#e8e8e3] bg-[#fafaf7] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      Period {p.periodIndex}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(p.createdAt)}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>
                      Verifier:{" "}
                      <span className="font-semibold text-foreground">
                        {p.verifierAction ?? "—"}
                      </span>
                    </div>
                    <div>Resolved: {formatWhen(p.resolvedAt)}</div>
                    <div>
                      Proof:{" "}
                      {p.proofUrl ? (
                        <a
                          href={p.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-delulu-blue hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                    {p.txHash ? (
                      <div>
                        Tx:{" "}
                        <a
                          href={`https://celoscan.io/tx/${p.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-delulu-blue hover:underline"
                        >
                          {formatAddress(p.txHash)}
                        </a>
                      </div>
                    ) : null}
                    {p.aiVerdict != null ? (
                      <div className="pt-1">
                        <p className="font-semibold text-foreground">AI verdict</p>
                        <pre className="mt-1 max-h-32 overflow-auto rounded-lg bg-white p-2 text-[10px] text-foreground">
                          {JSON.stringify(p.aiVerdict, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

export function ForfeitAdminPageClient() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<"day" | "week">("day");
  const [selected, setSelected] = useState<ForfeitCommitmentAdmin | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, error, refetch } = useDashboardForfeit({
    page,
    query: debouncedSearch,
    status,
  });

  const analytics = data?.analytics;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  const createdSeries = useMemo(() => {
    if (!analytics) return [];
    return toChartData(
      range === "day" ? analytics.createdDaily : analytics.createdWeekly,
    );
  }, [analytics, range]);

  const proofsSeries = useMemo(() => {
    if (!analytics) return [];
    return toChartData(
      range === "day" ? analytics.proofsDaily : analytics.proofsWeekly,
    );
  }, [analytics, range]);

  const loading = isLoading && !data;

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Forfeit analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every commitment created, stake destinations, and proof activity —
          daily and weekly growth included.
        </p>
      </div>

      <DashboardSectionTabs items={FORFEIT_SECTION_TABS} />

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load forfeit data"}
          <button
            type="button"
            onClick={() => void refetch()}
            className="ml-3 font-bold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <DashboardStatGrid className="mb-6 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total forfeits"
          value={analytics?.kpis.total ?? (loading ? "…" : 0)}
          sub={
            analytics
              ? `${analytics.kpis.createdToday} today · ${analytics.kpis.createdThisWeek} this week`
              : undefined
          }
          icon={Flame}
        />
        <KpiCard
          label="Active"
          value={analytics?.kpis.active ?? (loading ? "…" : 0)}
          sub={
            analytics
              ? `${analytics.kpis.completed} completed · ${analytics.kpis.forfeited} forfeited`
              : undefined
          }
          icon={ShieldAlert}
          accent="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          label="Proofs submitted"
          value={analytics?.kpis.proofsSubmitted ?? (loading ? "…" : 0)}
          sub={
            analytics
              ? `${analytics.kpis.proofsToday} today · ${analytics.kpis.proofsThisWeek} this week`
              : undefined
          }
          icon={FileCheck2}
          accent="bg-amber-50 text-amber-700"
        />
        <KpiCard
          label="Proof outcomes"
          value={
            analytics
              ? `${analytics.kpis.proofsApproved}/${analytics.kpis.proofsRejected}`
              : loading
                ? "…"
                : "0/0"
          }
          sub="Approved / rejected"
          icon={CheckCircle2}
          accent="bg-violet-50 text-violet-700"
        />
      </DashboardStatGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        {RANGE_TABS.map((tab) => (
          <AdminFilterPill
            key={tab.id}
            active={range === tab.id}
            onClick={() => setRange(tab.id)}
          >
            {tab.label}
          </AdminFilterPill>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardChartCard
          title={range === "day" ? "Created per day" : "Created per week"}
          subtitle="New forfeit commitments"
        >
          {loading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <DashboardBarChart data={createdSeries} height={200} />
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title={
            range === "day" ? "Proofs submitted per day" : "Proofs submitted per week"
          }
          subtitle="Period proofs with a proof URL"
        >
          {loading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <DashboardBarChart
              data={proofsSeries.map((d, i) => ({
                ...d,
                color: ["#10b981", "#34d399", "#059669"][i % 3],
              }))}
              height={200}
            />
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Cumulative growth"
          subtitle="Running total of forfeits created (30 days)"
        >
          {loading ? (
            <div className="h-[200px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <DashboardBarChart
              data={toChartData(analytics?.growthCumulative ?? []).map((d) => ({
                ...d,
                color: "#2563eb",
              }))}
              height={200}
            />
          )}
        </DashboardChartCard>

        <DashboardChartCard title="Status mix" subtitle="All commitments">
          {loading ? (
            <div className="h-[180px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <DashboardDonutChart
              data={toChartData(analytics?.byStatus ?? [])}
              size={150}
            />
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Evidence types"
          subtitle="How people prove their forfeit"
        >
          {loading ? (
            <div className="h-[160px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <DashboardHorizontalBars
              data={toChartData(analytics?.byEvidence ?? [])}
            />
          )}
        </DashboardChartCard>

        <DashboardChartCard
          title="Verification & destination"
          subtitle="Who verifies and where stake goes on miss"
        >
          {loading ? (
            <div className="h-[160px] animate-pulse rounded-xl bg-muted/60" />
          ) : (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Verification
                </p>
                <DashboardHorizontalBars
                  data={toChartData(analytics?.byVerification ?? [])}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Destination
                </p>
                <DashboardHorizontalBars
                  data={toChartData(analytics?.byDestination ?? [])}
                />
              </div>
            </div>
          )}
        </DashboardChartCard>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <AdminFilterPill
              key={f.id}
              active={status === f.id}
              onClick={() => {
                setStatus(f.id);
                setPage(1);
              }}
            >
              {f.label}
            </AdminFilterPill>
          ))}
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, wallet, friend, on-chain id…"
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : !data?.commitments.length ? (
          <DashboardTableEmptyState
            title="No forfeits found"
            description="Try another status filter or search term."
          />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[1100px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>Created</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Title</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Creator</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Stake</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Evidence</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Verify</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Destination</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Proofs</DashboardTableHeadCell>
                    <DashboardTableHeadCell>On-chain</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.commitments.map((row) => (
                    <DashboardTableRow
                      key={row.id}
                      onClick={() => setSelected(row)}
                    >
                      <DashboardTableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatWhen(row.createdAt)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <p className="max-w-[200px] truncate font-semibold text-foreground">
                          {row.title}
                        </p>
                        {row.isPrivate ? (
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Private
                          </p>
                        ) : null}
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
                      <DashboardTableCell className="whitespace-nowrap tabular-nums">
                        {formatStake(row.stakeAmount, row.tokenSymbol)}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <StatusBadge status={row.status} />
                      </DashboardTableCell>
                      <DashboardTableCell className="capitalize">
                        {row.evidenceType}
                      </DashboardTableCell>
                      <DashboardTableCell className="capitalize">
                        {row.verificationMethod}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="block max-w-[140px] truncate">
                          {row.destinationLabel}
                          {row.destinationFriendUsername
                            ? ` · @${row.destinationFriendUsername}`
                            : ""}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell className="tabular-nums">
                        {row.proofsSubmitted}
                        <span className="text-muted-foreground">
                          /{row.periodCount}
                        </span>
                        {row.proofsApproved > 0 || row.proofsRejected > 0 ? (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">
                            {row.proofsApproved}✓ {row.proofsRejected}✗
                          </span>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums text-xs">
                            {row.onChainId != null ? `#${row.onChainId}` : "—"}
                          </span>
                          {row.createTxHash ? (
                            <a
                              href={`https://celoscan.io/tx/${row.createTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-delulu-blue hover:opacity-80"
                              title="View create tx"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
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

      <ForfeitDetailModal
        item={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </DashboardPage>
  );
}
