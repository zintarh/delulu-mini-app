"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPagination } from "@/components/admin/admin-ui";
import {
  DashboardPage,
  DashboardTableBody,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmptyState,
  DashboardTableHead,
  DashboardTableHeadCell,
  DashboardTableHeadRow,
  DashboardTableLoading,
  DashboardTableRow,
  DashboardTableScroll,
  StatusChip,
} from "@/components/dashboard/dashboard-ui";
import { DashboardSectionTabs, REWARD_ENGINE_SECTION_TABS } from "@/components/dashboard/dashboard-section-tabs";
import {
  REWARD_CATEGORY_LABEL,
  adminFetch,
  configPathLabel,
  formatConfigValue,
  formatG,
  formatWhen,
} from "@/components/admin/reward-engine-ui";
import type { RewardAuditRow } from "@/app/api/dashboard/reward-engine/audit/route";
import type { ConfigChange } from "@/lib/rewards/config-schema";
import type { RewardCategory } from "@/lib/rewards/rules";
import { formatAddress } from "@/lib/utils";

type AuditResponse = { rows: RewardAuditRow[]; total: number; page: number; pageSize: number };

function Details({ row }: { row: RewardAuditRow }) {
  if (row.action === "config_update") {
    const changes = (row.details.changes as ConfigChange[] | undefined) ?? [];
    return (
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <li key={c.path} className="text-xs">
            <span className="font-medium text-foreground">{configPathLabel(c.path)}:</span>{" "}
            <span className="text-muted-foreground line-through">{formatConfigValue(c.before)}</span>{" "}
            <span className="font-semibold text-foreground">→ {formatConfigValue(c.after)}</span>
          </li>
        ))}
      </ul>
    );
  }
  const d = row.details as {
    wallet?: string;
    category?: RewardCategory;
    amount?: number;
    statusBefore?: string;
    statusAfter?: string;
    txHash?: string | null;
    error?: string | null;
  };
  return (
    <div className="space-y-1 text-xs">
      <p>
        {formatG(d.amount)} · {d.category ? REWARD_CATEGORY_LABEL[d.category] : "—"} ·{" "}
        <span className="font-mono">{d.wallet ? formatAddress(d.wallet as `0x${string}`) : "—"}</span>
      </p>
      <p className="flex items-center gap-1.5">
        {d.statusBefore ? <StatusChip status={d.statusBefore} /> : null}→{d.statusAfter ? <StatusChip status={d.statusAfter} /> : null}
        {d.txHash ? (
          <a href={`https://celoscan.io/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="text-delulu-blue hover:underline">
            tx
          </a>
        ) : null}
      </p>
      {d.error ? <p className="text-muted-foreground">{d.error}</p> : null}
    </div>
  );
}

export default function RewardEngineAuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminFetch<AuditResponse>(`/api/dashboard/reward-engine/audit?page=${page}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardSectionTabs items={REWARD_ENGINE_SECTION_TABS} />
      <p className="mb-5 text-sm text-muted-foreground">Every settings change and manual payout, with who did it and why.</p>
      <DashboardTableCard>
        {loading ? (
          <DashboardTableLoading />
        ) : error ? (
          <DashboardTableEmptyState title="Couldn’t load the audit log" description={error} />
        ) : !data || data.rows.length === 0 ? (
          <DashboardTableEmptyState title="Nothing logged yet" description="Settings changes and manual retries will appear here." />
        ) : (
          <>
            <DashboardTableScroll>
              <table className="w-full min-w-[880px] text-left text-sm">
                <DashboardTableHead>
                  <DashboardTableHeadRow>
                    <DashboardTableHeadCell>When</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Admin</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Action</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Reason</DashboardTableHeadCell>
                    <DashboardTableHeadCell>Details</DashboardTableHeadCell>
                  </DashboardTableHeadRow>
                </DashboardTableHead>
                <DashboardTableBody>
                  {data.rows.map((r) => (
                    <DashboardTableRow key={r.id}>
                      <DashboardTableCell className="whitespace-nowrap align-top text-muted-foreground">{formatWhen(r.createdAt)}</DashboardTableCell>
                      <DashboardTableCell className="align-top">{r.actorEmail}</DashboardTableCell>
                      <DashboardTableCell className="whitespace-nowrap align-top font-semibold">
                        {r.action === "config_update" ? "Settings changed" : "Manual payout"}
                      </DashboardTableCell>
                      <DashboardTableCell className="max-w-[240px] align-top text-muted-foreground">{r.reason}</DashboardTableCell>
                      <DashboardTableCell className="align-top">
                        <Details row={r} />
                      </DashboardTableCell>
                    </DashboardTableRow>
                  ))}
                </DashboardTableBody>
              </table>
            </DashboardTableScroll>
            <AdminPagination page={page} totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))} onPage={setPage} />
          </>
        )}
      </DashboardTableCard>
    </DashboardPage>
  );
}
