"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAdminDelulus } from "@/hooks/graph/useAdminDashboard";
import {
  Target,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import {
  AdminFilterPill,
  AdminKpiStrip,
  AdminPagination,
  AdminStatusBadge,
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

type StatusFilter = "all" | "active" | "resolved" | "cancelled";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "cancelled", label: "Cancelled" },
];

export default function AdminMarketsPage() {
  const { delulus, isLoading } = useAdminDelulus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return delulus.filter((d) => {
      if (statusFilter === "active" && (d.isResolved || d.isCancelled)) return false;
      if (statusFilter === "resolved" && !d.isResolved) return false;
      if (statusFilter === "cancelled" && !d.isCancelled) return false;
      if (!q) return true;
      const id = String(d.onChainId ?? d.id);
      const creator = d.creator.toLowerCase();
      const username = (d.username ?? "").toLowerCase();
      const content = (d.content ?? "").toLowerCase();
      return (
        id.includes(q) ||
        creator.includes(q) ||
        username.includes(q) ||
        content.includes(q)
      );
    });
  }, [delulus, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (s: StatusFilter) => { setStatusFilter(s); setPage(1); };

  return (
    <DashboardPage className="max-w-none px-5 sm:px-7">
      <DashboardPageHeader title="Goals" />

      {!isLoading && (
        <AdminKpiStrip icon={Target}>
          <span className="text-sm font-bold text-foreground tabular-nums">{delulus.length}</span>
          <span className="text-sm text-muted-foreground">goals</span>
          {search || statusFilter !== "all" ? (
            <span className="text-sm text-muted-foreground">
              · <span className="font-bold text-foreground tabular-nums">{filtered.length}</span> matching
            </span>
          ) : null}
        </AdminKpiStrip>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by ID, creator, content…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <AdminFilterPill
              key={f.id}
              active={statusFilter === f.id}
              onClick={() => handleStatus(f.id)}
            >
              {f.label}
            </AdminFilterPill>
          ))}
        </div>
      </div>

      <DashboardTableCard>
        {isLoading ? (
          <DashboardTableLoading />
        ) : filtered.length === 0 ? (
          <DashboardTableEmptyState icon={Target} title="No goals found" />
        ) : (
          <>
            <DashboardTableScroll minWidth="760px">
              <DashboardTableHead>
                <DashboardTableHeadRow>
                  <DashboardTableHeadCell>ID</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Creator</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Goal</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Status</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Staking ends</DashboardTableHeadCell>
                  <DashboardTableHeadCell>Supporters</DashboardTableHeadCell>
                  <DashboardTableHeadCell align="right">View</DashboardTableHeadCell>
                </DashboardTableHeadRow>
              </DashboardTableHead>
              <DashboardTableBody>
                {paginated.map((d) => {
                  const isExpired = d.stakingDeadline < new Date();
                  const label = d.username
                    ? `@${d.username}`
                    : formatAddress(d.creator as `0x${string}`);
                  const preview = d.content
                    ? d.content.slice(0, 55) + (d.content.length > 55 ? "…" : "")
                    : null;
                  return (
                    <DashboardTableRow key={d.id}>
                      <DashboardTableCell>
                        <span className="text-xs font-mono font-semibold text-foreground">
                          #{d.onChainId ?? d.id}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="font-semibold text-foreground">{label}</span>
                      </DashboardTableCell>
                      <DashboardTableCell className="max-w-[220px]">
                        {hasTableCellValue(preview) ? (
                          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {preview}
                          </span>
                        ) : null}
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <AdminStatusBadge isResolved={d.isResolved} isCancelled={d.isCancelled} />
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span
                          className={cn(
                            "text-xs",
                            !d.isResolved && !d.isCancelled && isExpired
                              ? "text-destructive font-semibold"
                              : "text-muted-foreground",
                          )}
                        >
                          {d.stakingDeadline.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        <span className="text-xs font-semibold tabular-nums text-foreground">
                          {d.totalSupporters ?? 0}
                        </span>
                      </DashboardTableCell>
                      <DashboardTableCell align="right">
                        <Link
                          href={`/delulu/${d.onChainId ?? d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8e3] px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-delulu-blue-border hover:bg-delulu-blue-light hover:text-delulu-blue transition-colors"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
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
    </DashboardPage>
  );
}
