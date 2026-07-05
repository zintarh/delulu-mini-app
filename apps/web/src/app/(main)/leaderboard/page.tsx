"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { useMonthlyCampaignLeaderboard } from "@/hooks/graph/useMonthlyCampaignLeaderboard";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ExternalLink,
  Plus,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { HomeTop10Banner } from "@/components/home-top10-banner";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";

import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";

const PAGE_SIZE = 10;

type Tab = "monthly" | "global";

/** Dreamer leaderboard points — sourced from Delulu-v3.sol `userDeluluPoints`. */
const DREAMER_POINTS = {
  perVerifiedMilestone: 1000,
  earlyCompletionBonus: 500,
  streakBonus: 250,
  perTipToCreator: 100,
} as const;

const DREAMERS_CLIMB_TIPS = [
  `Verify milestones on your delulus (${DREAMER_POINTS.perVerifiedMilestone.toLocaleString()} pts each)`,
  `Early proof earns +${DREAMER_POINTS.earlyCompletionBonus.toLocaleString()}; back-to-back milestones +${DREAMER_POINTS.streakBonus.toLocaleString()}`,
  `Each tip on your delulu adds ${DREAMER_POINTS.perTipToCreator.toLocaleString()} pts to you as creator`,
] as const;

function formatAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-delulu-yellow-reserved text-[13px] font-black text-primary">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-bold text-foreground">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-[13px] font-bold text-muted-foreground">
        3
      </span>
    );
  }
  return (
    <span className="w-8 shrink-0 text-center text-sm font-medium tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

function YouBadge() {
  return (
    <span className="shrink-0 rounded-full bg-delulu-yellow-reserved/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
      You
    </span>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
      {children}
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden border-b border-border/50 bg-secondary/40 px-4 py-3 sm:flex sm:items-center sm:gap-3">
      {children}
    </div>
  );
}

function HeadCell({
  className,
  children,
  align = "left",
}: {
  className?: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SkeletonRows() {
  return (
    <TableShell>
      <div className="divide-y divide-border/40">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-4">
            <div className="h-8 w-8 shrink-0 rounded-full bg-secondary" />
            <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded-md bg-secondary" />
              <div className="h-2.5 w-1/3 rounded-md bg-secondary/80" />
            </div>
            <div className="h-3.5 w-12 shrink-0 rounded-md bg-secondary" />
          </div>
        ))}
      </div>
    </TableShell>
  );
}

function ErrorState({
  onRetry,
  error,
}: {
  onRetry: () => void;
  error?: Error | null;
}) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-destructive">Failed to load leaderboard</p>
      {error?.message && (
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{error.message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground hover:bg-secondary/80"
      >
        Try again
      </button>
    </div>
  );
}

function MonthlyEmptyState() {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/30 px-6 py-16 pb-20 text-center">
      <Trophy className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">No one has joined a campaign this month yet.</p>
      <Link
        href="/explore?tab=campaigns"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Join campaign
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function DreamersEmptyState({
  message,
  onCreateClick,
}: {
  message: string;
  onCreateClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/30 px-6 pt-14 pb-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-background">
        <Trophy className="h-7 w-7 text-muted-foreground/35" strokeWidth={1.5} />
      </div>
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create a Delulu
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Browse feed
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <ul className="mx-auto mt-10 max-w-xs space-y-2.5 text-left">
        {DREAMERS_CLIMB_TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-delulu-yellow-reserved" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  footer,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  footer?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[132px] flex-col rounded-2xl border border-border/60 p-5 pb-6",
        accent ? "bg-delulu-yellow-reserved/10 border-delulu-yellow-reserved/25" : "bg-secondary/50",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex-1">{value}</div>
      {detail && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>}
      {footer && <div className="mt-3 pt-1">{footer}</div>}
    </div>
  );
}

function LeaderboardStatsRow({
  activeTab,
  formattedGAmount,
  isLoadingGSupply,
  celoscanContractUrl,
  myRank,
  myPoints,
  isRankLoading,
  authenticated,
  totalDreamers,
  monthlyParticipantCount,
}: {
  activeTab: Tab;
  formattedGAmount: string | null;
  isLoadingGSupply: boolean;
  celoscanContractUrl: string;
  myRank: number | null;
  myPoints: number | null;
  isRankLoading: boolean;
  authenticated: boolean;
  totalDreamers: number | string | null;
  monthlyParticipantCount: number;
}) {
  return (
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Good Dollar"
        accent
        value={
          isLoadingGSupply ? (
            <div className="h-9 w-28 animate-pulse rounded-lg bg-secondary" />
          ) : formattedGAmount ? (
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background">
                <img src="/gooddollar-logo.png" alt="" className="h-7 w-7 object-contain" />
              </div>
              <p className="text-2xl font-black tabular-nums tracking-tight text-foreground lg:text-3xl">
                {formattedGAmount}
              </p>
            </div>
          ) : (
            <p className="text-2xl font-black text-muted-foreground">—</p>
          )
        }
        detail="Total G$ supply on Celo"
        footer={
          formattedGAmount ? (
            <Link
              href={celoscanContractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
            >
              View on Celoscan
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : null
        }
      />

      <StatCard
        label="Your position"
        value={
          !authenticated ? (
            <p className="text-xl font-bold text-foreground">—</p>
          ) : isRankLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-lg bg-secondary" />
          ) : myRank ? (
            <p className="text-2xl font-black tabular-nums text-foreground lg:text-3xl">#{myRank}</p>
          ) : (
            <p className="text-xl font-bold text-muted-foreground">Unranked</p>
          )
        }
        detail={
          !authenticated
            ? "Sign in to track your rank"
            : myPoints != null
              ? `${myPoints.toLocaleString()} dreamer points`
              : "Earn points by verifying milestones and receiving tips on your delulus"
        }
        footer={
          !authenticated ? (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
            >
              Sign in
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null
        }
      />

      <StatCard
        label={activeTab === "monthly" ? "This month" : "Global"}
        value={
          <p className="text-2xl font-black tabular-nums text-foreground lg:text-3xl">
            {activeTab === "monthly" ? monthlyParticipantCount : totalDreamers ?? "—"}
          </p>
        }
        detail={
          activeTab === "monthly"
            ? "Wallets earning campaign points this month"
            : "Wallets ranked by total points"
        }
        footer={
          activeTab === "monthly" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Resets next month
            </span>
          ) : null
        }
      />
    </div>
  );
}

function LeaderboardAside({
  activeTab,
  onCreateClick,
}: {
  activeTab: Tab;
  onCreateClick: () => void;
}) {
  return (
    <aside className="hidden space-y-4 lg:block">
      {activeTab === "global" && (
        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-5 pb-6">
          <h2 className="text-sm font-bold text-foreground">How to climb</h2>
          <ul className="mt-4 space-y-3">
            {DREAMERS_CLIMB_TIPS.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-delulu-yellow-reserved" />
                {tip}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onCreateClick}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create a Delulu
          </button>
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="rounded-2xl border border-border/60 bg-secondary/40 p-5 pb-6">
          <Link
            href="/explore?tab=campaigns"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Join campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-background p-5 pb-6">
        <h2 className="text-sm font-bold text-foreground">Explore</h2>
        <div className="mt-4 space-y-2">
          <Link
            href="/"
            className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Home feed
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/explore"
            className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Search delulus
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            href="/profile"
            className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Your profile
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

type DreamerEntry = {
  address: string;
  username: string | null;
  points: number;
  rank: number;
};

function DreamersPodium({
  entries,
  pfpMap,
}: {
  entries: DreamerEntry[];
  pfpMap: Record<string, string | null | undefined>;
}) {
  const top = entries.slice(0, 3);
  if (top.length < 3) return null;

  const order = [top[1], top[0], top[2]];

  return (
    <div className="mb-8 hidden gap-3 lg:grid lg:grid-cols-3">
      {order.map((entry, i) => {
        const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
        const isFirst = rank === 1;
        const name = entry.username ? `@${entry.username}` : formatAddr(entry.address);

        return (
          <div
            key={entry.address}
            className={cn(
              "flex flex-col items-center rounded-2xl border border-border/60 bg-secondary/50 px-5 pt-5 pb-9 text-center",
              isFirst && "lg:-mt-2 lg:border-delulu-yellow-reserved/30 lg:bg-delulu-yellow-reserved/10",
            )}
          >
            <RankBadge rank={rank} />
            <div className="mt-3">
              <UserAvatar
                address={entry.address}
                username={entry.username}
                pfpUrl={pfpMap[entry.address.toLowerCase()]}
                size={isFirst ? 56 : 48}
              />
            </div>
            <p className="mt-3 max-w-full truncate text-sm font-bold text-foreground">{name}</p>
            <p className="mt-3 text-2xl font-black tabular-nums text-foreground">{entry.points}</p>
            <p className="mt-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              points
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries, hasNextPage, isLoading, totalCount, error, refetch } =
    useMonthlyCampaignLeaderboard(page, address);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  const allAddresses = [
    ...entries.map((e) => e.wallet_address.toLowerCase()),
    ...(address ? [address.toLowerCase()] : []),
  ];
  const pfpMap = usePfps(allAddresses);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} error={error} />;
  if (entries.length === 0) {
    return <MonthlyEmptyState />;
  }

  return (
    <div>
      {page === 0 && (
        <DreamersPodium
          entries={entries.map((e) => ({
            address: e.wallet_address,
            username: e.username,
            points: e.points_total,
            rank: e.rank,
          }))}
          pfpMap={pfpMap}
        />
      )}

      <TableShell>
        <TableHead>
          <HeadCell className="w-8 shrink-0">#</HeadCell>
          <HeadCell className="w-10 shrink-0">{""}</HeadCell>
          <HeadCell className="min-w-0 flex-1">Dreamer</HeadCell>
          <HeadCell className="w-20 text-right">Points</HeadCell>
        </TableHead>

        <div className="divide-y divide-border/40">
          {entries.map((entry) => {
            const isMe =
              !!address && entry.wallet_address.toLowerCase() === address.toLowerCase();
            const name = entry.username ? `@${entry.username}` : formatAddr(entry.wallet_address);
            return (
              <div
                key={entry.wallet_address}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/60",
                  isMe && "bg-delulu-yellow-reserved/10",
                )}
              >
                <RankBadge rank={entry.rank} />
                <UserAvatar
                  address={entry.wallet_address}
                  username={entry.username}
                  pfpUrl={pfpMap[entry.wallet_address.toLowerCase()]}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {isMe && <YouBadge />}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatAddr(entry.wallet_address)}
                  </p>
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                  {entry.points_total.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </TableShell>

      <LeaderboardPagination
        page={page}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={totalCount ?? undefined}
        hasNextPage={hasNextPage}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

function DreamersLeaderboard({
  onCreateClick,
}: {
  onCreateClick: () => void;
}) {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const {
    entries,
    hasNextPage,
    isLoading,
    totalCount,
    myRankEntry,
    myPageEntry,
    error,
    refetch,
  } = useAllUsersLeaderboard(page, address);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  const allAddresses = [
    ...entries.map((e) => e.address.toLowerCase()),
    ...(address ? [address.toLowerCase()] : []),
  ];
  const pfpMap = usePfps(allAddresses);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} error={error} />;
  if (entries.length === 0) {
    return (
      <DreamersEmptyState
        message="No dreamers on the board yet."
        onCreateClick={onCreateClick}
      />
    );
  }

  const isOnCurrentPage =
    !!address &&
    entries.some((e) => e.address.toLowerCase() === address.toLowerCase());
  const showPinnedMe = address && myRankEntry && !isOnCurrentPage;

  const listEntries = entries.filter(
    (entry) =>
      !showPinnedMe || entry.address.toLowerCase() !== address!.toLowerCase(),
  );

  return (
    <div>
      {page === 0 && (
        <DreamersPodium
          entries={entries.map((e) => ({
            address: e.address,
            username: e.username,
            points: e.points,
            rank: e.rank,
          }))}
          pfpMap={pfpMap}
        />
      )}

      <TableShell>
        <TableHead>
          <HeadCell className="w-8 shrink-0">#</HeadCell>
          <HeadCell className="w-10 shrink-0">{""}</HeadCell>
          <HeadCell className="min-w-0 flex-1">Dreamer</HeadCell>
          <HeadCell className="w-20 text-right">Points</HeadCell>
        </TableHead>

        <div className="divide-y divide-border/40">
          {showPinnedMe && (
            <div className="flex items-center gap-3 bg-delulu-yellow-reserved/10 px-4 py-3.5">
              <RankBadge rank={myRankEntry!.rank} />
              <UserAvatar
                address={address!}
                username={myPageEntry?.username ?? null}
                pfpUrl={pfpMap[address!.toLowerCase()]}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {myPageEntry?.username
                      ? `@${myPageEntry.username}`
                      : formatAddr(address!)}
                  </p>
                  <YouBadge />
                </div>
                <p className="font-mono text-xs text-muted-foreground">{formatAddr(address!)}</p>
              </div>
              <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                {myRankEntry!.points}
              </span>
            </div>
          )}

          {listEntries.map((entry) => {
            const name = entry.username ? `@${entry.username}` : formatAddr(entry.address);
            return (
              <div
                key={entry.address}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/60"
              >
                <RankBadge rank={entry.rank} />
                <UserAvatar
                  address={entry.address}
                  username={entry.username}
                  pfpUrl={pfpMap[entry.address.toLowerCase()]}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatAddr(entry.address)}
                  </p>
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                  {entry.points > 0 ? entry.points : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </TableShell>

      <LeaderboardPagination
        page={page}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        total={totalCount}
        hasNextPage={hasNextPage}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

function LeaderboardTabs({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["monthly", "global"] as Tab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
            activeTab === tab
              ? "bg-foreground text-background"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {tab === "monthly" ? (
            <Trophy className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Users className="h-4 w-4" strokeWidth={2} />
          )}
          {tab === "monthly" ? "This month" : "Global"}
        </button>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("monthly");
  const { address, authenticated } = useAuth();
  const { navigateToCreate } = useNavigateToCreate();
  const handleCreateClick = () => void navigateToCreate();

  const chainId = useChainId();
  const deluluContractAddress = getDeluluContractAddress(chainId);
  const celoscanContractUrl = `https://celoscan.io/address/${deluluContractAddress}`;

  const subtitle =
    activeTab === "monthly"
      ? "Campaign points earned by everyone participating this month"
      : "All-time points, accumulated across everything";

  return (
    <MainPage>
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-4 lg:px-8 lg:py-5">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <h1 className="text-2xl font-black tracking-tight text-foreground lg:text-3xl">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-5">
            <LeaderboardTabs activeTab={activeTab} onChange={setActiveTab} />
          </div>
        </div>
      </header>

      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent
          activeTab={activeTab}
          handleCreateClick={handleCreateClick}
          chainId={chainId}
          celoscanContractUrl={celoscanContractUrl}
          authenticated={authenticated}
        />
      </Suspense>
    </MainPage>
  );
}

/** Inner component that fetches all data — wrapped in Suspense */
function LeaderboardContent({
  activeTab,
  handleCreateClick,
  chainId,
  celoscanContractUrl,
  authenticated,
}: {
  activeTab: Tab;
  handleCreateClick: () => void;
  chainId: number;
  celoscanContractUrl: string;
  authenticated: boolean;
}) {
  const { address } = useAuth();

  // These hooks are now inside the Suspense boundary, so the page renders without waiting
  const { totalSupply: gTotalSupply, isLoading: isLoadingGSupply } =
    useGoodDollarTotalSupply();
  const { myRankEntry, totalCount, isRankLoading } = useAllUsersLeaderboard(0, address);
  const { totalCount: monthlyParticipantCount } = useMonthlyCampaignLeaderboard(0, address);

  const formattedGAmount =
    typeof gTotalSupply === "number" ? formatGAmount(gTotalSupply) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10">
      <div className="mb-6">
        <HomeTop10Banner />
      </div>

      <LeaderboardStatsRow
        activeTab={activeTab}
        formattedGAmount={formattedGAmount}
        isLoadingGSupply={isLoadingGSupply}
        celoscanContractUrl={celoscanContractUrl}
        myRank={myRankEntry?.rank ?? null}
        myPoints={myRankEntry?.points ?? null}
        isRankLoading={isRankLoading}
        authenticated={authenticated}
        totalDreamers={totalCount}
        monthlyParticipantCount={monthlyParticipantCount ?? 0}
      />

      {activeTab === "monthly" ? (
        <div className="mb-6 lg:hidden">
          <Link
            href="/explore?tab=campaigns"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background"
          >
            Join campaign
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border/60 bg-secondary/40 p-5 pb-6 lg:hidden">
          <h2 className="text-sm font-bold text-foreground">How to climb</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Verify milestones on your delulus to earn dreamer points.
          </p>
          <button
            type="button"
            onClick={handleCreateClick}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Plus className="h-4 w-4" />
            Create a Delulu
          </button>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8">
        <div className="min-w-0">
          {activeTab === "monthly" ? (
            <MonthlyLeaderboard />
          ) : (
            <DreamersLeaderboard onCreateClick={handleCreateClick} />
          )}
        </div>
        <LeaderboardAside
          activeTab={activeTab}
          onCreateClick={handleCreateClick}
        />
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10">
      {/* Stats row skeleton */}
      <div className="mb-8 grid grid-cols-3 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/40 bg-secondary/30 p-4 animate-pulse"
          >
            <div className="h-3 w-16 rounded-md bg-secondary mb-3" />
            <div className="h-8 w-20 rounded-md bg-secondary mb-2" />
            <div className="h-2.5 w-12 rounded-md bg-secondary/60" />
          </div>
        ))}
      </div>
      {/* List skeleton */}
      <SkeletonRows />
    </div>
  );
}
