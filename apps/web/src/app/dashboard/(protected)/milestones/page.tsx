"use client";

import { useState } from "react";
import {
  usePendingMilestones,
  type PendingMilestoneRow,
} from "@/hooks/graph/useAdminDashboard";
import { MilestoneActionSheet } from "@/app/dashboard/milestone-action-sheet";
import {
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminKpiStrip,
  AdminPagination,
} from "@/components/admin/admin-ui";
import {
  DashboardPage,
  DashboardPageHeader,
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

const PAGE_SIZE = 20;

export default function AdminMilestonesPage() {
  const { milestones, isLoading, refetch } = usePendingMilestones();
  const [page, setPage] = useState(1);
  const [actionRow, setActionRow] = useState<PendingMilestoneRow | null>(null);
  const [actionMode, setActionMode] = useState<"verify" | "reject" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(milestones.length / PAGE_SIZE));
  const paginated = milestones.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAction = (row: PendingMilestoneRow, mode: "verify" | "reject") => {
    setActionRow(row);
    setActionMode(mode);
    setSheetOpen(true);
  };

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardPageHeader title="Milestones" />

      {!isLoading && (
        <AdminKpiStrip icon={ShieldCheck}>
          <span className="text-sm font-bold text-foreground tabular-nums">{milestones.length}</span>
          <span className="text-sm text-muted-foreground">
            pending milestone{milestones.length !== 1 ? "s" : ""}
          </span>
        </AdminKpiStrip>
      )}

      <DashboardTableCard>
        {isLoading ? (
          <DashboardTableLoading />
        ) : milestones.length === 0 ? (
          <DashboardTableEmptyState icon={CheckCircle2} title="Queue is empty" />
        ) : (
          <>
            <DashboardTableScroll minWidth="720px">
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell>Delulu</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Creator</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Milestone</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Deadline</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Submitted</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Proof</DashboardTableHeadCell>
                  <DashboardTableHeadCell align="right">Actions</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {paginated.map((row) => {
                  const isOverdue = row.deadline < new Date();
                  const creator = row.delulu.creator;
                  const username = creator.username ?? null;
                  const shortId = creator.id.slice(0, 6) + "…" + creator.id.slice(-4);
                  return (
                    <DashboardTableRow key={row.id}>
                      <DashboardTableCell>
                        <span className="text-xs font-mono font-semibold text-foreground">
                          #{row.delulu.onChainId || row.delulu.id}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {username ? (
                          <span className="font-semibold text-foreground">@{username}</span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
                        )}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="text-xs font-mono text-muted-foreground">
                          #{row.milestoneId}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span
                          className={cn(
                            "text-xs",
                            isOverdue ? "text-destructive font-semibold" : "text-muted-foreground",
                          )}
                        >
                          {row.deadline.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.submittedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {row.submittedAt.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.proofLink ? (
                          <a
                            href={row.proofLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-delulu-blue hover:text-delulu-blue/80"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell align="right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openAction(row, "verify")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-delulu-blue-border bg-delulu-blue-light px-2.5 py-1.5 text-xs font-semibold text-delulu-blue hover:bg-delulu-blue-light/80 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => openAction(row, "reject")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </DashboardTableCell>
                    </DashboardTableRow>
                  );
                })}
              </DashboardTableBody>
            </DashboardTableScroll>
            <AdminPagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </DashboardTableCard>

      <MilestoneActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        row={actionRow}
        mode={actionMode}
        onSuccess={refetch}
      />
    </DashboardPage>
  );
}
