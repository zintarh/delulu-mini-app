"use client";

import { useState } from "react";
import {
  usePendingMilestones,
  type PendingMilestoneRow,
} from "@/hooks/graph/useAdminDashboard";
import { MilestoneActionSheet } from "@/app/admin/milestone-action-sheet";
import {
  ShieldCheck,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p as number)}
                className={cn(
                  "min-w-[30px] rounded-lg border px-2 py-1 text-xs font-bold transition-colors",
                  page === p
                    ? "border-[#1a1a19] bg-[#1a1a19] text-white"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            ),
          )}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

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
    <div className="w-full px-5 sm:px-7 py-6 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Milestone Queue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Submitted milestone proofs waiting for on-chain verification.
        </p>
      </div>

      {/* KPI strip */}
      {!isLoading && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground tabular-nums">{milestones.length}</span>
          <span className="text-sm text-muted-foreground">
            pending milestone{milestones.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <CheckCircle2 className="h-10 w-10 text-[#35d07f]/60" />
            <p className="text-sm font-semibold text-foreground">Queue is empty</p>
            <p className="text-xs text-muted-foreground">No submitted milestones awaiting review.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Delulu</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Milestone</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deadline</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Submitted</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Proof</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => {
                    const isOverdue = row.deadline < new Date();
                    const creator = row.delulu.creator;
                    const username = creator.username ?? null;
                    const shortId = creator.id.slice(0, 6) + "…" + creator.id.slice(-4);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            #{row.delulu.onChainId || row.delulu.id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {username ? (
                            <span className="text-sm font-semibold text-foreground">@{username}</span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{shortId}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">
                          #{row.milestoneId}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={cn(
                              "text-xs",
                              isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground",
                            )}
                          >
                            {row.deadline.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                          {row.submittedAt
                            ? row.submittedAt.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          {row.proofLink ? (
                            <a
                              href={row.proofLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline hover:text-muted-foreground transition-colors"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openAction(row, "verify")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#35d07f]/40 px-2.5 py-1.5 text-xs font-semibold text-[#1a8f53] hover:bg-[#35d07f]/10 transition-colors"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => openAction(row, "reject")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </div>

      <MilestoneActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        row={actionRow}
        mode={actionMode}
        onSuccess={refetch}
      />
    </div>
  );
}
