"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAdminDelulus } from "@/hooks/graph/useAdminDashboard";
import {
  BarChart3,
  Loader2,
  Search,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "active" | "resolved" | "cancelled";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "cancelled", label: "Cancelled" },
];

function StatusBadge({ isResolved, isCancelled }: { isResolved: boolean; isCancelled: boolean }) {
  if (isCancelled) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Cancelled
      </span>
    );
  }
  if (isResolved) {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[#35d07f]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a8f53]">
      Active
    </span>
  );
}

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

export default function AdminMarketsPage() {
  const { delulus, isLoading } = useAdminDelulus();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const now = new Date();
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
    <div className="w-full px-5 sm:px-7 py-6 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">All Markets</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every indexed delulu on the platform.
        </p>
      </div>

      {/* KPI strip */}
      {!isLoading && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground tabular-nums">{delulus.length}</span>
          <span className="text-sm text-muted-foreground">
            total market{delulus.length !== 1 ? "s" : ""}
          </span>
          {search || statusFilter !== "all" ? (
            <span className="text-sm text-muted-foreground">
              · <span className="font-bold text-foreground tabular-nums">{filtered.length}</span> matching
            </span>
          ) : null}
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by ID, creator, content…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <button
              key={f.id}
              type="button"
              onClick={() => handleStatus(f.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === f.id
                  ? "border-[#1a1a19] bg-[#1a1a19] text-white"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No markets found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ID</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creator</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Content</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Staking ends</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supporters</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">View</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((d) => {
                    const isExpired = d.stakingDeadline < new Date();
                    const label = d.username
                      ? `@${d.username}`
                      : formatAddress(d.creator as `0x${string}`);
                    const preview = d.content
                      ? d.content.slice(0, 55) + (d.content.length > 55 ? "…" : "")
                      : "—";
                    return (
                      <tr
                        key={d.id}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
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
                          <StatusBadge isResolved={d.isResolved} isCancelled={d.isCancelled} />
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={cn(
                              "text-xs",
                              !d.isResolved && !d.isCancelled && isExpired
                                ? "text-red-500 font-semibold"
                                : "text-muted-foreground",
                            )}
                          >
                            {d.stakingDeadline.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-foreground tabular-nums">
                          {d.totalSupporters ?? 0}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <Link
                            href={`/delulu/${d.onChainId ?? d.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
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
    </div>
  );
}
