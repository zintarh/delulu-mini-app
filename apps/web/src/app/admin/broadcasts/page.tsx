"use client";

import { useState, useMemo } from "react";
import {
  useAdminDelulus,
  useDelulusWithoutMilestones,
} from "@/hooks/graph/useAdminDashboard";
import { BroadcastSheet } from "@/app/admin/broadcast-sheet";
import {
  Megaphone,
  Loader2,
  Send,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import type { FormattedDelulu } from "@/lib/types";

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
                    ? "border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]"
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

function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked ? "border-foreground bg-foreground" : "border-border bg-card hover:border-foreground/40",
      )}
    >
      {checked && (
        <svg className="h-2.5 w-2.5 text-background" fill="none" viewBox="0 0 10 10">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function AdminBroadcastsPage() {
  const { delulus: allDelulus, isLoading: loadingDelulus } = useAdminDelulus();
  const { delulusWithoutMilestones, isLoading: loadingMilestones } = useDelulusWithoutMilestones(allDelulus);

  const isLoading = loadingDelulus || loadingMilestones;

  // Filter: market hasn't resolved yet (resolutionDeadline is when the whole market ends)
  const eligibleDelulus = useMemo<FormattedDelulu[]>(() => {
    const now = new Date();
    return delulusWithoutMilestones.filter((d) => d.resolutionDeadline > now);
  }, [delulusWithoutMilestones]);

  // All unique creator addresses across the full eligible list
  const allCreatorAddresses = useMemo(
    () => [...new Set(eligibleDelulus.map((d) => d.creator).filter(Boolean))],
    [eligibleDelulus],
  );

  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(eligibleDelulus.length / PAGE_SIZE));
  const paginated = eligibleDelulus.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // The delulus to pass to BroadcastSheet: only those whose creator is selected (or all if none selected)
  const delulusForSheet = useMemo<FormattedDelulu[]>(() => {
    if (selectedAddresses.size === 0) return eligibleDelulus;
    return eligibleDelulus.filter((d) => selectedAddresses.has(d.creator));
  }, [eligibleDelulus, selectedAddresses]);

  const pageAddresses = useMemo(
    () => [...new Set(paginated.map((d) => d.creator).filter(Boolean))],
    [paginated],
  );
  const allPageSelected = pageAddresses.length > 0 && pageAddresses.every((a) => selectedAddresses.has(a));
  const somePageSelected = pageAddresses.some((a) => selectedAddresses.has(a));

  const toggleAddress = (addr: string) => {
    setSelectedAddresses((prev) => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      return next;
    });
  };

  const togglePageAll = () => {
    setSelectedAddresses((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageAddresses.forEach((a) => next.delete(a));
      } else {
        pageAddresses.forEach((a) => next.add(a));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedAddresses(new Set(allCreatorAddresses));
  };

  const clearAll = () => {
    setSelectedAddresses(new Set());
  };

  const handleOpenSheet = () => setSheetOpen(true);

  return (
    <div className="w-full px-5 sm:px-7 py-6 pb-12">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Broadcasts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Active delulus with no milestones set. Select recipients and send a reminder.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenSheet}
          disabled={isLoading || eligibleDelulus.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          <Send className="h-4 w-4" />
          {selectedAddresses.size > 0
            ? `Send Reminder to ${selectedAddresses.size} selected`
            : "Send Broadcast"}
        </button>
      </div>

      {/* KPI strip + bulk actions */}
      {!isLoading && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground tabular-nums">{eligibleDelulus.length}</span>
            <span className="text-sm text-muted-foreground">
              eligible delulu{eligibleDelulus.length !== 1 ? "s" : ""}
            </span>
          </div>

          {selectedAddresses.size > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-[#35d07f]" />
              <span className="text-sm font-bold text-foreground tabular-nums">{selectedAddresses.size}</span>
              <span className="text-sm text-muted-foreground">creator{selectedAddresses.size !== 1 ? "s" : ""} selected</span>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={selectAll}
              disabled={allCreatorAddresses.length === 0}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Select all ({allCreatorAddresses.length})
            </button>
            {selectedAddresses.size > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : eligibleDelulus.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Megaphone className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">Every active delulu has at least one milestone set.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 w-10">
                      <RowCheckbox
                        checked={allPageSelected}
                        onChange={togglePageAll}
                      />
                    </th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ID</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Delulu</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ends</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">View</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((d) => {
                    const addr = d.creator ?? "";
                    const isChecked = selectedAddresses.has(addr);
                    const label = d.username
                      ? `@${d.username}`
                      : addr
                        ? formatAddress(addr as `0x${string}`)
                        : "—";
                    const preview = d.content
                      ? d.content.slice(0, 60) + (d.content.length > 60 ? "…" : "")
                      : "—";
                    const daysLeft = Math.ceil(
                      (d.resolutionDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                    );
                    return (
                      <tr
                        key={d.id}
                        onClick={() => toggleAddress(addr)}
                        className={cn(
                          "border-b border-border cursor-pointer transition-colors",
                          isChecked ? "bg-foreground/[0.03]" : "hover:bg-muted/30",
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <RowCheckbox checked={isChecked} onChange={() => toggleAddress(addr)} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            #{d.onChainId ?? d.id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="text-sm font-semibold text-foreground">{label}</span>
                        </td>
                        <td className="px-5 py-3.5 max-w-[220px]">
                          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {preview}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-muted-foreground">
                              {d.resolutionDeadline.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            {daysLeft <= 7 && daysLeft > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                {daysLeft}d left
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-5 py-3.5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={`/delulu/${d.onChainId ?? d.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
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

      <BroadcastSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        delulus={delulusForSheet}
        isLoading={isLoading}
      />
    </div>
  );
}
