"use client";

import { useState, useMemo } from "react";
import {
  useAdminDelulus,
  useDelulusWithoutMilestones,
} from "@/hooks/graph/useAdminDashboard";
import { BroadcastSheet } from "@/app/dashboard/broadcast-sheet";
import {
  Megaphone,
  Send,
  ExternalLink,
} from "lucide-react";
import { formatAddress } from "@/lib/utils";
import type { FormattedDelulu } from "@/lib/types";
import {
  AdminKpiStrip,
  AdminPagination,
  AdminPrimaryButton,
  AdminRowCheckbox,
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
  hasTableCellValue,
} from "@/components/dashboard/dashboard-ui";

const PAGE_SIZE = 20;

export default function AdminBroadcastsPage() {
  const { delulus: allDelulus, isLoading: loadingDelulus } = useAdminDelulus();
  const { delulusWithoutMilestones, isLoading: loadingMilestones } = useDelulusWithoutMilestones(allDelulus);

  const isLoading = loadingDelulus || loadingMilestones;

  const eligibleDelulus = useMemo<FormattedDelulu[]>(() => {
    const now = new Date();
    return delulusWithoutMilestones.filter((d) => d.resolutionDeadline > now);
  }, [delulusWithoutMilestones]);

  const allCreatorAddresses = useMemo(
    () => [...new Set(eligibleDelulus.map((d) => d.creator).filter(Boolean))],
    [eligibleDelulus],
  );

  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(eligibleDelulus.length / PAGE_SIZE));
  const paginated = eligibleDelulus.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const delulusForSheet = useMemo<FormattedDelulu[]>(() => {
    if (selectedAddresses.size === 0) return eligibleDelulus;
    return eligibleDelulus.filter((d) => selectedAddresses.has(d.creator));
  }, [eligibleDelulus, selectedAddresses]);

  const pageAddresses = useMemo(
    () => [...new Set(paginated.map((d) => d.creator).filter(Boolean))],
    [paginated],
  );
  const allPageSelected = pageAddresses.length > 0 && pageAddresses.every((a) => selectedAddresses.has(a));

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

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardPageHeader
        title="Broadcasts"
        action={
          <AdminPrimaryButton
            onClick={() => setSheetOpen(true)}
            disabled={isLoading || eligibleDelulus.length === 0}
            className="shrink-0 rounded-xl"
          >
            <Send className="h-4 w-4" />
            {selectedAddresses.size > 0
              ? `Send (${selectedAddresses.size})`
              : "Send"}
          </AdminPrimaryButton>
        }
      />

      {!isLoading && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <AdminKpiStrip icon={Megaphone}>
            <span className="text-sm font-bold text-foreground tabular-nums">{eligibleDelulus.length}</span>
            <span className="text-sm text-muted-foreground">
              eligible delulu{eligibleDelulus.length !== 1 ? "s" : ""}
            </span>
          </AdminKpiStrip>

          {selectedAddresses.size > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-delulu-blue-border bg-delulu-blue-light px-4 py-2.5">
              <div className="h-2 w-2 rounded-full bg-delulu-blue" />
              <span className="text-sm font-bold text-foreground tabular-nums">{selectedAddresses.size}</span>
              <span className="text-sm text-muted-foreground">
                creator{selectedAddresses.size !== 1 ? "s" : ""} selected
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={selectAll}
              disabled={allCreatorAddresses.length === 0}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Select all ({allCreatorAddresses.length})
            </button>
            {selectedAddresses.size > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <DashboardTableCard>
        {isLoading ? (
          <DashboardTableLoading />
        ) : eligibleDelulus.length === 0 ? (
          <DashboardTableEmptyState icon={Megaphone} title="All caught up" />
        ) : (
          <>
            <DashboardTableScroll minWidth="640px">
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell className="w-10">
                    <AdminRowCheckbox checked={allPageSelected} onChange={togglePageAll} />
                  </DashboardTableHeadCell>
                  <DashboardTableHeadCell>ID</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Creator</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Goal</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Ends</DashboardTableHeadCell>
                  <DashboardTableHeadCell align="right">View</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {paginated.map((d) => {
                  const addr = d.creator ?? "";
                  const isChecked = selectedAddresses.has(addr);
                  const label = d.username
                    ? `@${d.username}`
                    : addr
                      ? formatAddress(addr as `0x${string}`)
                      : null;
                  const preview = d.content
                    ? d.content.slice(0, 60) + (d.content.length > 60 ? "…" : "")
                    : null;
                  const daysLeft = Math.ceil(
                    (d.resolutionDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <DashboardTableRow
                      key={d.id}
                      onClick={() => toggleAddress(addr)}
                      selected={isChecked}
                    >
                      <DashboardTableCell onClick={(e) => e.stopPropagation()}>
                        <AdminRowCheckbox checked={isChecked} onChange={() => toggleAddress(addr)} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="text-xs font-mono font-semibold text-foreground">
                          #{d.onChainId ?? d.id}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {hasTableCellValue(label) ? (
                          <span className="font-semibold text-foreground">{label}</span>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell className="max-w-[220px]">
                        {hasTableCellValue(preview) ? (
                          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {preview}
                          </span>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">
                            {d.resolutionDeadline.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {daysLeft <= 7 && daysLeft > 0 ? (
                            <span className="text-[10px] font-bold text-delulu-blue">
                              {daysLeft}d left
                            </span>
                          ) : null}
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell
                        align="right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`/delulu/${d.onChainId ?? d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8e3] px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-delulu-blue-border hover:bg-delulu-blue-light hover:text-delulu-blue transition-colors"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
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

      <BroadcastSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        delulus={delulusForSheet}
        isLoading={isLoading}
      />
    </DashboardPage>
  );
}
