"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import {
  Loader2,
  Search,
  LayoutDashboard,
  ArrowLeft,
  Moon,
  Sun,
  LogIn,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn, formatAddress } from "@/lib/utils";
import { useTheme } from "@/contexts/theme-context";
import { useAdminOpsSession } from "@/hooks/use-admin-ops-session";

interface UserRow {
  address: string;
  username: string | null;
  email: string;
  pfp_url: string | null;
  referral_code: string | null;
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
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
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
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p as number)}
                className={cn(
                  "min-w-[28px] rounded-md border px-2 py-1 text-xs font-bold transition-colors",
                  page === p
                    ? "border-foreground bg-foreground text-background"
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
          className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1.5 text-foreground disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { address, isConnected } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const {
    configured: isOpsConfigured,
    authenticated: isOpsAuthenticated,
    email: opsEmail,
    isLoading: isOpsLoading,
  } = useAdminOpsSession();
  const [showLoginSheet, setShowLoginSheet] = useState(false);

  const [usernameSearch, setUsernameSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDate, setCustomDate] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAdminAccess = isOpsAuthenticated || (isConnected && isAdmin);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (usernameSearch.trim()) params.set("username", usernameSearch.trim());
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
  }, [usernameSearch, datePreset, customDate, page]);

  useEffect(() => {
    if (hasAdminAccess) fetchUsers();
  }, [hasAdminAccess, fetchUsers]);

  // Reset page when filters change
  const handleUsernameChange = (v: string) => {
    setUsernameSearch(v);
    setPage(1);
  };
  const handlePreset = (p: DatePreset) => {
    setDatePreset(p);
    setPage(1);
  };
  const handleCustomDate = (v: string) => {
    setCustomDate(v);
    setPage(1);
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  if (isAdminLoading || isOpsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground px-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-border bg-muted">
          <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-black">Access denied</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          {isOpsConfigured
            ? "Login with Ops credentials or use the contract-owner wallet."
            : !isConnected
              ? "Connect your wallet to continue."
              : "This page is restricted to the contract owner."}
        </p>
        <div className="flex items-center gap-2">
          {isOpsConfigured && (
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-foreground text-background px-4 py-2 text-sm font-bold shadow-neo-sm"
            >
              <LogIn className="w-4 h-4" />
              Login as Ops
            </Link>
          )}
          {!isConnected && (
            <button
              type="button"
              onClick={() => setShowLoginSheet(true)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-neo-sm hover:bg-muted transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Connect wallet
            </button>
          )}
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2 text-sm font-bold text-foreground shadow-neo-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Link>
        </div>
        <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-muted/20 text-foreground">
      {/* Header */}
      <header className="shrink-0 z-20 border-b-2 border-border bg-card/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-secondary px-3 py-2 text-sm font-bold",
                "text-foreground shadow-neo-sm hover:shadow-neo active:scale-[0.98] transition-all",
              )}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border bg-muted shrink-0">
                <Users className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
                  Admin
                </p>
                <p className="text-sm font-black truncate">Users</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isOpsAuthenticated && (
              <>
                <span className="hidden md:inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                  Ops: {opsEmail}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/admin/auth/logout", { method: "POST" });
                    window.location.href = "/admin/login";
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Logout ops
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center p-2 rounded-lg border-2 border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-neo-sm"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            {isConnected && address && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex rounded-lg border-2 border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">{formatAddress(address)}</span>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center p-2 rounded-lg border-2 border-border bg-card text-foreground hover:bg-muted transition-colors shadow-neo-sm"
                  aria-label="Profile"
                >
                  <User className="w-5 h-5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-6xl mx-auto w-full px-4 py-6 pb-10">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Users
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All registered profiles from Supabase.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
            {/* Username search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder="Filter by username…"
                value={usernameSearch}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full rounded-lg border-2 border-border bg-input py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {usernameSearch && (
                <button
                  type="button"
                  onClick={() => handleUsernameChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date preset pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePreset(preset.id)}
                  className={cn(
                    "rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-colors",
                    datePreset === preset.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom date picker */}
            {datePreset === "custom" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => handleCustomDate(e.target.value)}
                className="rounded-lg border-2 border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border-2 border-border bg-card shadow-neo">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              </div>
            ) : error ? (
              <p className="py-14 text-center text-sm text-destructive">{error}</p>
            ) : !data || data.users.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">
                No users found.
              </p>
            ) : (
              <>
                {/* Count */}
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    {data.total} user{data.total !== 1 ? "s" : ""}
                    {(usernameSearch || datePreset !== "all") && " matching filters"}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/60">
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Address
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Username
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Email
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Referral code
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((u) => (
                        <tr
                          key={u.address}
                          className="border-b border-border hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {formatAddress(u.address as `0x${string}`)}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {u.username ? (
                              <span className="font-semibold">@{u.username}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground max-w-[220px] truncate">
                            {u.email}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {u.referral_code ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
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
      </main>

      <ConnectorSelectionSheet open={showLoginSheet} onOpenChange={setShowLoginSheet} />
    </div>
  );
}
