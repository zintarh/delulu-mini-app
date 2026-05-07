"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  Loader2,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";

interface UserRow {
  address: string;
  username: string | null;
  email: string;
  pfp_url: string | null;
  referral_code: string | null;
  claim_count: number | null;
  created_at: string;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

type DatePreset = "all" | "today" | "yesterday" | "custom";

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "custom", label: "Pick date" },
];

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

export default function AdminUsersPage() {
  const { isLoading: isAdminLoading } = useIsAdmin();

  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("query", search.trim());
      if (datePreset === "today") params.set("date", "today");
      else if (datePreset === "yesterday") params.set("date", "yesterday");
      else if (datePreset === "custom" && customDate) params.set("date", customDate);
      params.set("page", String(page));

      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, datePreset, customDate, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handlePreset = (p: DatePreset) => { setDatePreset(p); setPage(1); };
  const handleCustomDate = (v: string) => { setCustomDate(v); setPage(1); };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handleDeleteUser = async (targetAddress: string) => {
    const confirmed = window.confirm(
      `Delete user ${formatAddress(targetAddress as `0x${string}`)}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingAddress(targetAddress);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users?address=${encodeURIComponent(targetAddress)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Delete failed: ${res.status}`);
      }
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeletingAddress(null);
    }
  };

  if (isAdminLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full px-5 sm:px-7 py-6 pb-12">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Users</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All registered profiles from Supabase.
        </p>
      </div>

      {/* KPI strip */}
      {data && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground tabular-nums">{data.total}</span>
          <span className="text-sm text-muted-foreground">
            registered user{data.total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by username or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted/40 py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePreset(preset.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                datePreset === preset.id
                  ? "border-[#111111] bg-[#111111] text-white dark:border-white dark:bg-white dark:text-[#111111]"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => handleCustomDate(e.target.value)}
            className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-14 text-center text-sm text-destructive">{error}</p>
        ) : !data || data.users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No users found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Address</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Username</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Referral</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Joined</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Claims</th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr
                      key={u.address}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatAddress(u.address as `0x${string}`)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyAddress(u.address)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy full address"
                          >
                            {copiedAddress === u.address ? (
                              <Check className="w-3.5 h-3.5 text-[#35d07f]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={`https://celoscan.io/address/${u.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="View on Celoscan"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">
                        {u.username ? (
                          <span className="font-semibold">@{u.username}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground max-w-[200px] truncate">
                        {u.email}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-muted-foreground">
                        {u.referral_code ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-foreground">
                        {u.claim_count ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.address)}
                          disabled={deletingAddress === u.address}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          {deletingAddress === u.address ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
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
