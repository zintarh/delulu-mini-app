"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useApolloClient } from "@apollo/client/react";
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
  Trophy,
  ArrowLeft,
  Moon,
  Sun,
  LogIn,
  User,
} from "lucide-react";
import { CreateChallengeSheet } from "@/components/create-challenge-sheet";
import { cn, formatGAmount, formatAddress } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import type { FormattedDelulu } from "@/lib/types";
import { useTheme } from "@/contexts/theme-context";

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
              className="rounded-md border-2 border-border bg-delulu-yellow-reserved px-2.5 py-1 text-[11px] font-bold text-foreground shadow-neo-sm hover:shadow-neo active:scale-[0.98] transition-all"
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
  const { address, isConnected } = useAccount();
  const { theme, toggleTheme } = useTheme();
  const apolloClient = useApolloClient();
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

  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [search, setSearch] = useState("");
  const [resolveTarget, setResolveTarget] = useState<FormattedDelulu | null>(
    null,
  );
  const [milestoneSheet, setMilestoneSheet] = useState<{
    row: PendingMilestoneRow | null;
    mode: "verify" | "reject" | null;
  }>({ row: null, mode: null });
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] =
    useState(false);

  const filteredDelulus = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return delulus;
    return delulus.filter((d) => {
      const idMatch = String(d.id).includes(q);
      const creator = (d.creator ?? "").toLowerCase();
      const content = (d.content ?? "").toLowerCase();
      const un = (d.username ?? "").toLowerCase();
      return (
        idMatch || creator.includes(q) || content.includes(q) || un.includes(q)
      );
    });
  }, [delulus, search]);

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

  const tableShell =
    "overflow-hidden rounded-xl border-2 border-border bg-card shadow-neo";

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <header className="shrink-0 z-20 border-b-2 border-border bg-card/90 backdrop-blur-md">
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border bg-muted shrink-0">
                <LayoutDashboard className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
                  Console
                </p>
                <p className="text-sm font-black truncate">Admin</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setShowCreateChallengeSheet(true)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border-2 border-border bg-delulu-yellow-reserved px-3 py-2 text-xs sm:text-sm font-bold text-foreground shadow-neo-sm",
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
              title="Toggle theme"
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
        <div className="max-w-6xl mx-auto w-full px-4 py-6 pb-10">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              Milestone verification, market resolution, and indexed delulus.
            </p>
          </div>

          <section className="mb-10 grid gap-3 sm:grid-cols-3">
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

          <section className="mb-12">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">
                Milestone verification
              </h2>
            </div>
            <div className={tableShell}>
              {loadingMilestones ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                </div>
              ) : pendingMilestones.length === 0 ? (
                <p className="py-14 text-center text-sm text-muted-foreground">
                  No milestones waiting for verification.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/60">
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Delulu
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Ms #
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Proof
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Deadline
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingMilestones.map((row) => (
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
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {row.deadline.getTime() > 0
                              ? row.deadline.toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setMilestoneSheet({
                                    row,
                                    mode: "verify",
                                  })
                                }
                                className="rounded-md border-2 border-border bg-delulu-green px-2.5 py-1 text-[11px] font-bold text-white shadow-neo-sm hover:opacity-90 active:scale-[0.98] transition-all"
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setMilestoneSheet({
                                    row,
                                    mode: "reject",
                                  })
                                }
                                className="rounded-md border-2 border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/15 active:scale-[0.98] transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-foreground">All delulus</h2>
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search by id, creator, content…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border-2 border-border bg-input py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/60">
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          #
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Creator
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          TVL
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDelulus.map((d) => (
                        <DeluluRow
                          key={d.id}
                          delulu={d}
                          onResolve={setResolveTarget}
                          allowResolve
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
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
