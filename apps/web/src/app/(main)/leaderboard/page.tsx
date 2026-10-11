"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMonthlyCampaignLeaderboard } from "@/hooks/graph/useMonthlyCampaignLeaderboard";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useEarnedTotalsByAddresses, formatEarnedUsdt } from "@/hooks/use-earned-totals";
import { cn } from "@/lib/utils";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";
import { Lulu, Segmented, Trophy as TrophyArt, gameButtonClass } from "@/components/ds";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatCompact } from "@/lib/levels";
import Link from "next/link";

const PAGE_SIZE = 10;

type Tab = "monthly" | "global";

type Entry = { address: string; username: string | null; points: number; rank: number };

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
  return (
    <span className="w-[30px] shrink-0 text-center font-display text-[22px] font-extrabold uppercase leading-[0.88] tabular-nums">
      {rank}
    </span>
  );
}

/** One leaderboard row (design: Leaderboard.dc.html). */
function Row({
  entry,
  isMe,
  pfp,
  compact,
  earnedUsd,
}: {
  entry: Entry;
  isMe: boolean;
  pfp: string | null | undefined;
  compact: boolean;
  earnedUsd: number;
}) {
  return (
    <div
      className={cn(
        "flex animate-rise items-center gap-3 rounded-2xl px-3 py-2",
        isMe && "border-2 border-yellow-line bg-yellow-soft shadow-edge-yellow-line",
      )}
    >
      <RankBadge rank={entry.rank} />
      <UserAvatar address={entry.address} username={entry.username} pfpUrl={pfp} size={38} />
      <span className="min-w-0 flex-1 truncate font-bold">
        {isMe ? "You" : entry.username ? `@${entry.username}` : formatAddr(entry.address)}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="label-mono text-xs font-semibold text-ink">
          {entry.points > 0 ? `${compact ? formatCompact(entry.points) : entry.points.toLocaleString()} pts` : "—"}
        </span>
        {earnedUsd > 0 ? (
          <span className="label-mono text-[10px] text-muted-foreground">{formatEarnedUsdt(earnedUsd)} earned</span>
        ) : null}
      </span>
    </div>
  );
}

/** Top three on a podium (2 · 1 · 3), shown on the first page. */
function Podium({
  top,
  pfpMap,
  earnedByAddress,
}: {
  top: Entry[];
  pfpMap: Record<string, string | null | undefined>;
  earnedByAddress: Record<string, number>;
}) {
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights: Record<number, number> = { 1: 80, 2: 56, 3: 40 };
  return (
    <div className="flex items-end gap-2.5 px-2 pt-3.5">
      {order.map((e) => (
        <div key={e.address} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
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
          <span className="label-mono text-[10px] text-muted-foreground">{formatCompact(e.points)}</span>
          {(earnedByAddress[e.address.toLowerCase()] ?? 0) > 0 ? (
            <span className="label-mono text-[9px] text-muted-foreground/80">
              {formatEarnedUsdt(earnedByAddress[e.address.toLowerCase()])}
            </span>
          ) : null}
          <div
            className="w-full rounded-t-[14px] shadow-[inset_0_-6px_0_rgba(0,0,0,0.08)]"
            style={{ height: heights[e.rank], background: MEDALS[e.rank][0] }}
          />
        </div>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1 pt-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-3 py-2">
          <div className="h-[30px] w-[30px] shrink-0 rounded-full bg-line" />
          <div className="h-[38px] w-[38px] shrink-0 rounded-full bg-line" />
          <div className="h-3.5 flex-1 rounded-md bg-line" />
          <div className="h-3 w-14 shrink-0 rounded-md bg-line" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <Lulu size={64} mood="worried" />
      <p className="mt-3 text-sm font-semibold text-muted-foreground">Couldn&apos;t load the leaderboard.</p>
      <button type="button" onClick={onRetry} className={gameButtonClass({ variant: "line", size: "sm", className: "mt-4" })}>
        Try again
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <Lulu size={64} mood="dream" />
      <p className="mt-3 text-sm font-semibold text-muted-foreground">{message}</p>
      <Link href="/explore" className={gameButtonClass({ size: "sm", className: "mt-4" })}>
        Browse campaigns
      </Link>
    </div>
  );
}

function MonthlyLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries: raw, hasNextPage, isLoading, totalCount, error, refetch } = useMonthlyCampaignLeaderboard(page, address);
  const entries: Entry[] = raw.map((e) => ({ address: e.wallet_address, username: e.username, points: e.points_total, rank: e.rank }));
  const pfpMap = usePfps(entries.map((e) => e.address.toLowerCase()));
  const { totalsByAddress: earnedByAddress } = useEarnedTotalsByAddresses(entries.map((e) => e.address));

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (entries.length === 0) return <EmptyState message="No one has joined a campaign this month yet." />;

  const me = address?.toLowerCase();
  return (
    <div>
      <div className="flex items-center gap-3 pt-[18px]">
        <span className="animate-bounce-in">
          <TrophyArt size={44} />
        </span>
        <div>
          <div className="text-lg font-extrabold">This month</div>
          <div className="label-mono mt-[3px] text-[10px] text-muted-foreground">Campaign points · resets monthly</div>
        </div>
      </div>
      <div className="flex flex-col gap-1 pt-3">
        {entries.map((e) => (
          <Row
            key={e.address}
            entry={e}
            isMe={e.address.toLowerCase() === me}
            pfp={pfpMap[e.address.toLowerCase()]}
            compact={false}
            earnedUsd={earnedByAddress[e.address.toLowerCase()] ?? 0}
          />
        ))}
      </div>
      <LeaderboardPagination
        page={page}
        rangeStart={page * PAGE_SIZE + 1}
        rangeEnd={page * PAGE_SIZE + entries.length}
        total={totalCount ?? undefined}
        hasNextPage={hasNextPage}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

function GlobalLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries, hasNextPage, isLoading, totalCount, myRankEntry, myPageEntry, error, refetch } = useAllUsersLeaderboard(page, address);
  const me = address?.toLowerCase();
  const pfpMap = usePfps([...entries.map((e) => e.address.toLowerCase()), ...(me ? [me] : [])]);
  const { totalsByAddress: earnedByAddress } = useEarnedTotalsByAddresses([
    ...entries.map((e) => e.address),
    ...(me ? [me] : []),
  ]);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (entries.length === 0) return <EmptyState message="No one on the board yet." />;

  const isOnCurrentPage = !!me && entries.some((e) => e.address.toLowerCase() === me);
  const pinnedMe: Entry | null =
    me && myRankEntry && !isOnCurrentPage
      ? { address: address!, username: myPageEntry?.username ?? null, points: Number(myRankEntry.points) || 0, rank: myRankEntry.rank }
      : null;
  const showPodium = page === 0 && entries.length >= 3;
  const rows = entries.filter((e) => !showPodium || e.rank > 3);

  return (
    <div>
      <div className="label-mono pt-3.5 text-[10px] text-muted-foreground">All time · every player · total points</div>
      {showPodium ? <Podium top={entries.slice(0, 3)} pfpMap={pfpMap} earnedByAddress={earnedByAddress} /> : null}
      <div className="flex flex-col gap-1 pt-1.5">
        {rows.map((e) => (
          <Row
            key={e.address}
            entry={e}
            isMe={e.address.toLowerCase() === me}
            pfp={pfpMap[e.address.toLowerCase()]}
            compact
            earnedUsd={earnedByAddress[e.address.toLowerCase()] ?? 0}
          />
        ))}
        {pinnedMe ? (
          <Row entry={pinnedMe} isMe pfp={pfpMap[me!]} compact earnedUsd={earnedByAddress[me!] ?? 0} />
        ) : null}
      </div>
      <LeaderboardPagination
        page={page}
        rangeStart={page * PAGE_SIZE + 1}
        rangeEnd={page * PAGE_SIZE + entries.length}
        total={totalCount}
        hasNextPage={hasNextPage}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

/** Leaderboard (design: docs/redesign/screens/Leaderboard.dc.html). */
export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("monthly");

  return (
    <MainPage>
      <PageBackHeader title="Leaderboard" />
      <div className="mx-auto max-w-xl px-5 pb-8 pt-4">
        <Segmented<Tab>
          ariaLabel="Leaderboard"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "monthly", label: "This month" },
            { value: "global", label: "Global" },
          ]}
        />
        <Suspense fallback={<SkeletonRows />}>{activeTab === "monthly" ? <MonthlyLeaderboard /> : <GlobalLeaderboard />}</Suspense>
      </div>
    </MainPage>
  );
}
