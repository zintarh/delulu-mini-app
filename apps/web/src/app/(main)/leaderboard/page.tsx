"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useNavigateToCreate } from "@/hooks/use-navigate-to-create";
import { useMonthlyCampaignLeaderboard } from "@/hooks/graph/useMonthlyCampaignLeaderboard";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useEarnedTotalsByAddresses } from "@/hooks/use-earned-totals";
import { cn } from "@/lib/utils";
import { formatEarnedUsdt } from "@/hooks/use-earned-totals";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Sparkles,
  Trophy,
} from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";
import { Segmented, Trophy as TrophyArt } from "@/components/ds";

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

const MEDALS: Record<number, [string, string]> = {
  1: ["#F6C324", "#C99A0A"],
  2: ["#D9D9D4", "#AFAFA8"],
  3: ["#F2B48A", "#C98352"],
};

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank];
  if (medal) {
    return (
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold text-ink"
        style={{ background: medal[0], boxShadow: `0 3px 0 ${medal[1]}` }}
      >
        {rank}
      </span>
    );
  }
  return <span className="w-[30px] shrink-0 text-center font-display text-[22px] font-extrabold tabular-nums">{rank}</span>;
}

/** Top three on a podium (2 · 1 · 3), shown on the first page. */
function Podium({
  top,
  pfpMap,
}: {
  top: { address: string; username: string | null; points: number; rank: number }[];
  pfpMap: Record<string, string | null | undefined>;
}) {
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights: Record<number, number> = { 1: 90, 2: 64, 3: 48 };
  return (
    <div className="mb-3 flex items-end gap-2.5 px-2 pt-2">
      {order.map((e) => (
        <div key={e.address} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="relative animate-bounce-in">
            <UserAvatar address={e.address} username={e.username} pfpUrl={pfpMap[e.address.toLowerCase()]} size={e.rank === 1 ? 60 : 50} />
            <span
              className="absolute -bottom-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white font-display text-xs font-extrabold"
              style={{ background: MEDALS[e.rank][0], boxShadow: `0 2px 0 ${MEDALS[e.rank][1]}` }}
            >
              {e.rank}
            </span>
          </span>
          <span className="mt-1.5 max-w-full truncate text-sm font-bold">{e.username ? `@${e.username}` : formatAddr(e.address)}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{e.points.toLocaleString()} pts</span>
          <div
            className="w-full rounded-t-[14px] shadow-[inset_0_-6px_0_rgba(0,0,0,0.08)]"
            style={{ height: heights[e.rank], background: MEDALS[e.rank][0] }}
          />
        </div>
      ))}
    </div>
  );
}

function YouBadge() {
  return (
    <span className="shrink-0 rounded-full bg-yellow px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink">
      You
    </span>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border-2 border-line bg-white p-1.5 shadow-edge">{children}</div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden px-3 pb-1 pt-2 sm:flex sm:items-center sm:gap-3">{children}</div>
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
      <div className="flex flex-col gap-0.5">
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
        href="/explore"
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
          href="/home"
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
  const { totalsByAddress: claimedMap } = useEarnedTotalsByAddresses(allAddresses);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} error={error} />;
  if (entries.length === 0) {
    return <MonthlyEmptyState />;
  }

  const showPodium = page === 0 && entries.length >= 3;
  const podium = entries.slice(0, 3).map((e) => ({
    address: e.wallet_address,
    username: e.username,
    points: e.points_total,
    rank: e.rank,
  }));

  return (
    <div>
      {showPodium ? <Podium top={podium} pfpMap={pfpMap} /> : null}
      <TableShell>
        <TableHead>
          <HeadCell className="w-8 shrink-0">#</HeadCell>
          <HeadCell className="w-10 shrink-0">{""}</HeadCell>
          <HeadCell className="min-w-0 flex-1">Dreamer</HeadCell>
          <HeadCell className="w-16 text-right">Points</HeadCell>
          <HeadCell className="w-20 text-right">Earned</HeadCell>
        </TableHead>

        <div className="flex flex-col gap-0.5">
          {entries.filter((e) => !showPodium || e.rank > 3).map((entry) => {
            const isMe =
              !!address && entry.wallet_address.toLowerCase() === address.toLowerCase();
            const name = entry.username ? `@${entry.username}` : formatAddr(entry.wallet_address);
            const totalClaimed = claimedMap[entry.wallet_address.toLowerCase()] ?? 0;
            return (
              <div
                key={entry.wallet_address}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-paper",
                  isMe && "border-2 border-yellow-line bg-yellow-soft shadow-edge-yellow-line",
                )}
              >
                <RankBadge rank={entry.rank} />
                <UserAvatar
                  address={entry.wallet_address}
                  username={entry.username}
                  pfpUrl={pfpMap[entry.wallet_address.toLowerCase()]}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {isMe && <YouBadge />}
                  </div>
                  <p className="hidden font-mono text-xs text-muted-foreground sm:block">
                    {formatAddr(entry.wallet_address)}
                  </p>
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                  {entry.points_total.toLocaleString()}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground sm:block">
                  {formatEarnedUsdt(totalClaimed)}
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
  const { totalsByAddress: claimedMap } = useEarnedTotalsByAddresses(allAddresses);

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

  const showPodium = page === 0 && entries.length >= 3;
  const listEntries = entries
    .filter((entry) => !showPinnedMe || entry.address.toLowerCase() !== address!.toLowerCase())
    .filter((entry) => !showPodium || entry.rank > 3);

  return (
    <div>
      {showPodium ? <Podium top={entries.slice(0, 3)} pfpMap={pfpMap} /> : null}
      <TableShell>
        <TableHead>
          <HeadCell className="w-8 shrink-0">#</HeadCell>
          <HeadCell className="w-10 shrink-0">{""}</HeadCell>
          <HeadCell className="min-w-0 flex-1">Dreamer</HeadCell>
          <HeadCell className="w-16 text-right">Points</HeadCell>
          <HeadCell className="w-20 text-right">Earned</HeadCell>
        </TableHead>

        <div className="flex flex-col gap-0.5">
          {showPinnedMe && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-yellow-line bg-yellow-soft px-3 py-2.5 shadow-edge-yellow-line">
              <RankBadge rank={myRankEntry!.rank} />
              <UserAvatar
                address={address!}
                username={myPageEntry?.username ?? null}
                pfpUrl={pfpMap[address!.toLowerCase()]}
                size={38}
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
                <p className="hidden font-mono text-xs text-muted-foreground sm:block">{formatAddr(address!)}</p>
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                {myRankEntry!.points}
              </span>
              <span className="hidden w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground sm:block">
                {formatEarnedUsdt(
                  claimedMap[address!.toLowerCase()] ?? 0,
                )}
              </span>
            </div>
          )}

          {listEntries.map((entry) => {
            const name = entry.username ? `@${entry.username}` : formatAddr(entry.address);
            const totalClaimed = claimedMap[entry.address.toLowerCase()] ?? 0;
            return (
              <div
                key={entry.address}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-paper"
              >
                <RankBadge rank={entry.rank} />
                <UserAvatar
                  address={entry.address}
                  username={entry.username}
                  pfpUrl={pfpMap[entry.address.toLowerCase()]}
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  <p className="hidden font-mono text-xs text-muted-foreground sm:block">
                    {formatAddr(entry.address)}
                  </p>
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                  {entry.points > 0 ? entry.points : "—"}
                </span>
                <span className="hidden w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground sm:block">
                  {formatEarnedUsdt(totalClaimed)}
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

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("monthly");
  const { navigateToCreate } = useNavigateToCreate();
  const handleCreateClick = () => void navigateToCreate();

  return (
    <MainPage>
      <div className="mx-auto max-w-2xl px-5 pb-8 pt-2 lg:pt-6">
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            aria-label="Back"
            className="press-edge flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
          </Link>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Leaderboard</h1>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <TrophyArt size={52} />
          <div>
            <div className="text-lg font-extrabold">{activeTab === "monthly" ? "This month" : "All time"}</div>
            <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">
              {activeTab === "monthly" ? "Campaign points this month" : "Every player · total points"}
            </div>
          </div>
        </div>

        <Segmented<Tab>
          className="mt-4"
          ariaLabel="Leaderboard"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "monthly", label: "This month" },
            { value: "global", label: "All time" },
          ]}
        />

        <div className="mt-5">
          <Suspense fallback={<SkeletonRows />}>
            {activeTab === "monthly" ? <MonthlyLeaderboard /> : <DreamersLeaderboard onCreateClick={handleCreateClick} />}
          </Suspense>
        </div>
      </div>
    </MainPage>
  );
}
