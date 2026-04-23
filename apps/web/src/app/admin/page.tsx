"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useApolloClient } from "@apollo/client/react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import {
  useAdminDelulus,
  usePendingMilestones,
  type PendingMilestoneRow,
} from "@/hooks/graph/useAdminDashboard";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { ResolveDeluluModal } from "@/components/resolve-delulu-modal";
import { MilestoneActionSheet } from "@/app/admin/milestone-action-sheet";
import {
  Loader2,
  ExternalLink,
  Search,
  LayoutDashboard,
  BarChart3,
  Activity,
  Home,
  ShieldCheck,
  Trophy,
  ArrowLeft,
  Moon,
  Sun,
  LogIn,
  User,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { CreateChallengeSheet } from "@/components/create-challenge-sheet";
import { cn, formatGAmount, formatAddress } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import type { FormattedDelulu } from "@/lib/types";
import { useTheme } from "@/contexts/theme-context";

const PAGE_SIZE = 10;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-border bg-card px-5 py-4 shadow-neo-sm">
      <div className="absolute left-0 top-0 h-0.5 w-full bg-primary opacity-90" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground font-medium">{hint}</p>
      )}
    </div>
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
              <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p as number)}
                className={cn(
                  "min-w-[28px] rounded-md border px-2 py-1 text-xs font-bold transition-colors",
                  page === p
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                {p}
              </button>
            )
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

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-border bg-input py-2 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function DeluluRow({
  delulu,
  onResolve,
  allowResolve,
}: {
  delulu: FormattedDelulu;
  onResolve: (d: FormattedDelulu) => void;
  allowResolve: boolean;
}) {
  const { username } = useUsernameByAddress(
    delulu.creator as `0x${string}` | undefined,
  );
  const now = new Date();
  const stakingEnded = delulu.stakingDeadline && delulu.stakingDeadline <= now;
  const canResolve =
    allowResolve && stakingEnded && !delulu.isResolved && !delulu.isCancelled;

  const creatorLabel = username
    ? `@${username}`
    : delulu.creator
      ? formatAddress(delulu.creator as `0x${string}`)
      : "—";

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3 text-sm font-mono text-muted-foreground tabular-nums">
        #{delulu.id}
      </td>
      <td className="px-4 py-3 text-sm text-foreground">{creatorLabel}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            delulu.isResolved
              ? "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-600/25 dark:text-emerald-300 dark:ring-emerald-500/35"
              : delulu.isCancelled
                ? "bg-destructive/10 text-destructive ring-1 ring-destructive/25"
                : "bg-sky-500/10 text-sky-800 ring-1 ring-sky-600/20 dark:text-sky-300 dark:ring-sky-500/30",
          )}
        >
          {delulu.isResolved
            ? "Resolved"
            : delulu.isCancelled
              ? "Cancelled"
              : "Active"}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-semibold tabular-nums text-foreground">
        <span className="inline-flex items-center gap-2">
          {formatGAmount(delulu.totalStake ?? 0)}
          {delulu.tokenAddress && (
            <TokenBadge
              tokenAddress={delulu.tokenAddress}
              size="sm"
              showText={false}
            />
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/delulu/${delulu.id}`}
            className="inline-flex items-center gap-1 rounded-md border-2 border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground shadow-neo-sm hover:shadow-neo-sm active:scale-[0.98] transition-all"
          >
            <ExternalLink className="w-3 h-3 opacity-70" />
            View
          </Link>
          {canResolve ? (
            <button
              type="button"
              onClick={() => onResolve(delulu)}
              className="rounded-md border-2 border-border bg-delulu-yellow-reserved px-2.5 py-1 text-[11px] font-bold text-delulu-charcoal shadow-neo-sm hover:shadow-neo active:scale-[0.98] transition-all"
            >
              Resolve
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminDashboardPage() {
  const { address, isConnected } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const apolloClient = useApolloClient();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const {
    delulus,
    isLoading: loadingDelulus,
    refetch: refetchDelulus,
  } = useAdminDelulus();
  const {
    milestones: pendingMilestones,
    isLoading: loadingMilestones,
    refetch: refetchMilestones,
  } = usePendingMilestones();

  const [activeTab, setActiveTab] = useState<"milestones" | "delulus">("milestones");
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [deluluSearch, setDeluluSearch] = useState("");
  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [deluluPage, setDeluluPage] = useState(1);
  const [milestonePage, setMilestonePage] = useState(1);
  const [resolveTarget, setResolveTarget] = useState<FormattedDelulu | null>(null);
  const [milestoneSheet, setMilestoneSheet] = useState<{
    row: PendingMilestoneRow | null;
    mode: "verify" | "reject" | null;
  }>({ row: null, mode: null });
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] = useState(false);

  const filteredDelulus = useMemo(() => {
    const q = deluluSearch.trim().toLowerCase();
    if (!q) return delulus;
    return delulus.filter((d) => {
      const idMatch = String(d.id).includes(q);
      const creator = (d.creator ?? "").toLowerCase();
      const content = (d.content ?? "").toLowerCase();
      const un = (d.username ?? "").toLowerCase();
      return idMatch || creator.includes(q) || content.includes(q) || un.includes(q);
    });
  }, [delulus, deluluSearch]);

  const filteredMilestones = useMemo(() => {
    const q = milestoneSearch.trim().toLowerCase();
    if (!q) return pendingMilestones;
    return pendingMilestones.filter((m) => {
      const deluluId = String(m.delulu.onChainId || m.delulu.id).toLowerCase();
      const username = (m.delulu.creator?.username ?? "").toLowerCase();
      const proof = (m.proofLink ?? "").toLowerCase();
      return deluluId.includes(q) || username.includes(q) || proof.includes(q);
    });
  }, [pendingMilestones, milestoneSearch]);

  // Paginated slices
  const deluluTotalPages = Math.max(1, Math.ceil(filteredDelulus.length / PAGE_SIZE));
  const pagedDelulus = filteredDelulus.slice((deluluPage - 1) * PAGE_SIZE, deluluPage * PAGE_SIZE);

  const milestoneTotalPages = Math.max(1, Math.ceil(filteredMilestones.length / PAGE_SIZE));
  const pagedMilestones = filteredMilestones.slice((milestonePage - 1) * PAGE_SIZE, milestonePage * PAGE_SIZE);

  const stats = useMemo(() => {
    const now = new Date();
    const endedUnresolved = delulus.filter(
      (d) =>
        d.stakingDeadline &&
        d.stakingDeadline <= now &&
        !d.isResolved &&
        !d.isCancelled,
    ).length;
    return {
      total: delulus.length,
      pendingMilestones: pendingMilestones.length,
      endedUnresolved,
    };
  }, [delulus, pendingMilestones]);

  const refreshAfterMilestone = async () => {
    await Promise.all([refetchDelulus(), refetchMilestones()]);
  };

  const onResolveSuccess = async () => {
    if (resolveTarget) {
      await refetchDelulus();
      await refetchDeluluData(apolloClient, resolveTarget.id);
    }
  };

  const tableShell = "overflow-hidden rounded-xl border-2 border-border bg-card shadow-neo";
  const canModerate = Boolean(isConnected && isAdmin);

  if (isAdminLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const tabs = [
    {
      id: "milestones" as const,
      label: "Milestones",
      badge: stats.pendingMilestones,
    },
    {
      id: "delulus" as const,
      label: "Delulus",
      badge: stats.total,
    },
  ];

  return (
    <div className="h-screen flex flex-col bg-muted/20 text-foreground">
      <header className="shrink-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto w-full px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href="/"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-secondary px-3 py-2 text-sm font-bold",
                "text-foreground shadow-neo-sm hover:shadow-neo active:scale-[0.98] transition-all",
              )}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted shrink-0">
                <LayoutDashboard className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
                  Operations
                </p>
                <p className="text-sm font-black truncate">Admin Dashboard</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/admin/users"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-secondary px-3 py-2 text-xs sm:text-sm font-bold text-foreground shadow-neo-sm",
                "hover:shadow-neo active:scale-[0.98] transition-all",
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Users</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowCreateChallengeSheet(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-delulu-yellow-reserved px-3 py-2 text-xs sm:text-sm font-bold text-delulu-charcoal shadow-neo-sm",
                "hover:shadow-neo active:scale-[0.98] transition-all",
              )}
            >
              <Trophy className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Create challenge</span>
              <span className="sm:hidden">Challenge</span>
            </button>

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

            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex rounded-lg border-2 border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">
                    {formatAddress(address)}
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center p-2 rounded-lg border-2 border-border bg-card text-foreground hover:bg-muted transition-colors shadow-neo-sm"
                  aria-label="Profile"
                >
                  <User className="w-5 h-5" />
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginSheet(true)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-card px-3 py-2 text-sm font-bold",
                  "text-foreground shadow-neo-sm hover:bg-muted transition-colors",
                )}
              >
                <LogIn className="w-4 h-4" />
                Connect
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto w-full px-4 py-6 pb-10 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-border bg-card p-3">
              <p className="px-2 pb-2 text-[11px] uppercase tracking-widest text-muted-foreground font-bold">Workspace</p>
              <div className="space-y-1">
                <Link href="/admin" className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold">
                  <LayoutDashboard className="w-4 h-4" /> Overview
                </Link>
                <button
                  type="button"
                  onClick={() => setActiveTab("milestones")}
                  className="w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" /> Milestones
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("delulus")}
                  className="w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" /> Delulus
                </button>
                <Link href="/admin/users" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors">
                  <Users className="w-4 h-4" /> Users
                </Link>
                <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted/70 transition-colors">
                  <Home className="w-4 h-4" /> Back to app
                </Link>
              </div>
            </div>
          </aside>

          <div>
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Milestone verification, market resolution, and indexed delulus in one workspace.
            </p>
          </div>

          {/* Stats */}
          <section className="mb-8 grid gap-3 sm:grid-cols-3">
            <StatCard label="Delulus indexed" value={stats.total} />
            <StatCard
              label="Milestones awaiting verify"
              value={stats.pendingMilestones}
              hint="Submitted, not yet verified"
            />
            <StatCard
              label="Ended · unresolved"
              value={stats.endedUnresolved}
              hint="Past staking deadline"
            />
          </section>

          <section className="mb-8 columns-1 md:columns-2 xl:columns-3 gap-3 [column-fill:_balance]">
            <div className="break-inside-avoid mb-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action readiness</p>
              <p className="mt-2 text-2xl font-black">{canModerate ? "Admin Wallet Connected" : "Read-only Mode"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {canModerate
                  ? "Resolve and verify actions are enabled."
                  : "Connect the contract owner wallet to unlock verify/resolve buttons."}
              </p>
            </div>
            <div className="break-inside-avoid mb-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Health pulse</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs"><span>Pending milestones</span><span className="font-semibold">{stats.pendingMilestones}</span></div>
                <div className="flex items-center justify-between text-xs"><span>Ended unresolved</span><span className="font-semibold">{stats.endedUnresolved}</span></div>
                <div className="flex items-center justify-between text-xs"><span>Total indexed</span><span className="font-semibold">{stats.total}</span></div>
              </div>
            </div>
            <div className="break-inside-avoid mb-3 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ops activity</p>
              <p className="mt-2 text-sm text-muted-foreground">Track moderation throughput and queue health.</p>
              <div className="mt-3 h-16 rounded-xl bg-muted/50 grid place-items-center">
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="mb-6 flex items-center gap-1 border-b-2 border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-colors",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums min-w-[18px]",
                    activeTab === tab.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.badge}
                </span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-foreground rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Milestones Tab */}
          {activeTab === "milestones" && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                    Milestone verification
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredMilestones.length} pending
                    {milestoneSearch && ` · filtered from ${pendingMilestones.length}`}
                  </p>
                </div>
                <SearchInput
                  value={milestoneSearch}
                  onChange={(v) => { setMilestoneSearch(v); setMilestonePage(1); }}
                  placeholder="Search by delulu, user, proof…"
                />
              </div>
              <div className={tableShell}>
                {loadingMilestones ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                  </div>
                ) : filteredMilestones.length === 0 ? (
                  <p className="py-14 text-center text-sm text-muted-foreground">
                    {milestoneSearch ? "No milestones match your search." : "No milestones waiting for verification."}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left">
                        <thead>
                          <tr className="border-b-2 border-border bg-muted/60">
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Delulu</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Ms #</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Proof</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Deadline</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedMilestones.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-border hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <Link
                                  href={`/delulu/${row.delulu.onChainId || row.delulu.id}`}
                                  className="text-sm font-bold text-foreground underline-offset-2 hover:underline"
                                >
                                  #{row.delulu.onChainId || row.delulu.id}
                                </Link>
                                {row.delulu.creator?.username && (
                                  <p className="text-xs text-muted-foreground">
                                    @{row.delulu.creator.username}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                                {row.milestoneId}
                              </td>
                              <td className="px-4 py-3 max-w-[200px]">
                                {row.proofLink ? (
                                  <a
                                    href={row.proofLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-foreground underline break-all line-clamp-2 hover:text-muted-foreground"
                                  >
                                    {row.proofLink}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {row.deadline.getTime() > 0
                                  ? row.deadline.toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex gap-2">
                                  {canModerate && row.proofLink && row.deadline <= new Date() && (
                                    <button
                                      type="button"
                                      onClick={() => setMilestoneSheet({ row, mode: "verify" })}
                                      className="rounded-md border-2 border-border bg-delulu-green px-2.5 py-1 text-[11px] font-bold text-white shadow-neo-sm hover:opacity-90 active:scale-[0.98] transition-all"
                                    >
                                      Verify
                                    </button>
                                  )}
                                  {canModerate ? (
                                    <button
                                      type="button"
                                      onClick={() => setMilestoneSheet({ row, mode: "reject" })}
                                      className="rounded-md border-2 border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/15 active:scale-[0.98] transition-all"
                                    >
                                      Reject
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Admin wallet required</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={milestonePage}
                      totalPages={milestoneTotalPages}
                      onPage={setMilestonePage}
                    />
                  </>
                )}
              </div>
            </section>
          )}

          {/* Delulus Tab */}
          {activeTab === "delulus" && (
            <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">All delulus</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredDelulus.length} total
                    {deluluSearch && ` · filtered from ${delulus.length}`}
                  </p>
                </div>
                <SearchInput
                  value={deluluSearch}
                  onChange={(v) => { setDeluluSearch(v); setDeluluPage(1); }}
                  placeholder="Search by id, creator, content…"
                />
              </div>
              <div className={tableShell}>
                {loadingDelulus ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                  </div>
                ) : filteredDelulus.length === 0 ? (
                  <p className="py-14 text-center text-sm text-muted-foreground">
                    No delulus match your search.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left">
                        <thead>
                          <tr className="border-b-2 border-border bg-muted/60">
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">#</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Creator</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">TVL</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedDelulus.map((d) => (
                            <DeluluRow
                              key={d.id}
                              delulu={d}
                              onResolve={setResolveTarget}
                              allowResolve={canModerate}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      page={deluluPage}
                      totalPages={deluluTotalPages}
                      onPage={setDeluluPage}
                    />
                  </>
                )}
              </div>
            </section>
          )}
          </div>
        </div>
      </main>

      <ConnectorSelectionSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
      />

      <ResolveDeluluModal
        open={resolveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResolveTarget(null);
        }}
        delulu={resolveTarget}
        onSuccess={onResolveSuccess}
      />

      <MilestoneActionSheet
        open={milestoneSheet.row !== null && milestoneSheet.mode !== null}
        onOpenChange={(open) => {
          if (!open) setMilestoneSheet({ row: null, mode: null });
        }}
        row={milestoneSheet.row}
        mode={milestoneSheet.mode}
        onSuccess={refreshAfterMilestone}
      />

      <CreateChallengeSheet
        open={showCreateChallengeSheet}
        onOpenChange={setShowCreateChallengeSheet}
      />
    </div>
  );
}
