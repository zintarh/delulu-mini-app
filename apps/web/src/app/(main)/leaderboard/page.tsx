"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useEarnedTotalsByAddresses } from "@/hooks/use-earned-totals";
import { cn } from "@/lib/utils";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { LeaderboardPagination } from "@/components/leaderboard-pagination";
import { Flame, Lulu, Segmented, Trophy as TrophyArt, gameButtonClass } from "@/components/ds";
import { boardWindow, fortnightWindow, weekWindow, type BoardWindow } from "@/lib/leaderboard/windows";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn, ngnWorthShowing } from "@/lib/earn/format";
import { ACTIVE_POT } from "@/lib/pool/tickets";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatCompact } from "@/lib/levels";
import Link from "next/link";

const PAGE_SIZE = 10;

type Tab = BoardWindow;

type Entry = { address: string; username: string | null; points: number; rank: number; streak?: number; daysKept?: number };

/** Days in a row — what we reward. Shown next to points so consistency is visible, not just volume. */
function StreakFlame({ days, className }: { days?: number; className?: string }) {
  if (!days || days < 2) return null;
  return (
    <span
      className={cn("label-mono inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-orange", className)}
      aria-label={`${days} days in a row`}
      title={`${days} days in a row`}
    >
      <Flame size={14} />
      {days}
    </span>
  );
}

/** No username yet: a plain "Player", never a wallet address. */
const displayName = (e: { username: string | null }) => (e.username ? `@${e.username}` : "Player");

/** Earned (stored in $) as naira, only when it's a real amount — "$0.04 earned" reads as nothing. */
function useEarnedLabel() {
  const facts = useEarnFacts();
  return (usd: number) => (facts && usd > 0 ? ngnWorthShowing(usd * facts.ngnPerUsd) : null);
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
  const earned = useEarnedLabel()(earnedUsd);
  const second = [entry.daysKept ? `${entry.daysKept} ${entry.daysKept === 1 ? "day" : "days"} kept` : null, earned ? `${earned} earned` : null].filter(Boolean).join(" · ");
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
        {isMe ? "You" : displayName(entry)}
      </span>
      <StreakFlame days={entry.streak} />
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="label-mono text-xs font-semibold text-ink">
          {entry.points > 0 ? `${compact ? formatCompact(entry.points) : entry.points.toLocaleString()} pts` : "—"}
        </span>
        {second ? <span className="label-mono text-[10px] text-green-edge">{second}</span> : null}
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
  const earnedLabel = useEarnedLabel();
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
              style={{ background: (MEDALS[e.rank] ?? MEDALS[3])[0], boxShadow: `0 2px 0 ${(MEDALS[e.rank] ?? MEDALS[3])[1]}` }}
            >
              {e.rank}
            </span>
          </span>
          <span className="mt-1.5 max-w-full truncate text-sm font-bold">{displayName(e)}</span>
          <span className="label-mono flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {formatCompact(e.points)}
            <StreakFlame days={e.streak} className="text-[10px]" />
          </span>
          {earnedLabel(earnedByAddress[e.address.toLowerCase()] ?? 0) ? (
            <span className="label-mono text-[9px] text-muted-foreground/80">{earnedLabel(earnedByAddress[e.address.toLowerCase()] ?? 0)}</span>
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

/** The weekly pool, plus when this ranking resets. */
function BoardBanner({ win }: { win: BoardWindow }) {
  const facts = useEarnFacts();
  const range = boardWindow(win);
  const daysLeft = Math.max(0, Math.ceil((range.endMs - Date.now()) / 86_400_000));
  const ends = daysLeft <= 1 ? "ends today" : `${daysLeft} days left`;
  const ngn = facts ? fmtNgn(ACTIVE_POT.weeklyG * facts.gdUsd * facts.ngnPerUsd) : null;
  if (win !== "week") {
    const round = fortnightWindow();
    return (
      <div className="relative mt-4 overflow-hidden rounded-[22px] border-2 border-ink bg-ink p-4 text-white shadow-[0_4px_0_#000]">
        <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-yellow/35 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="animate-bounce-in">
            <TrophyArt size={48} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-bold text-white/70">Round {round.index} · shared every week</p>
            <p className="m-0 font-display text-[28px] font-extrabold leading-none text-yellow">
              ${ACTIVE_POT.weeklyUsd}
              <span className="ml-2 text-[16px] text-white/85">{ACTIVE_POT.weeklyG.toLocaleString("en-US")} G$</span>
              {ngn ? <span className="ml-2 text-[16px] text-white/85">≈ {ngn}</span> : null}
            </p>
            <p className="label-mono m-0 mt-1 text-[10px] text-white/60">Everyone who shows up all 7 days shares it · ranking {ends}</p>
          </div>
        </div>
      </div>
    );
  }
  const w = weekWindow();
  const endDay = new Date(w.endMs - 1).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[22px] border-2 border-line bg-white p-3.5 shadow-edge-sm">
      <span className="animate-bounce-in">
        <TrophyArt size={40} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[16px] font-extrabold">Week {w.index} · ${ACTIVE_POT.weeklyUsd} shared · {ACTIVE_POT.weeklyG.toLocaleString("en-US")} G$</p>
        <p className="label-mono m-0 mt-0.5 text-[10px] text-muted-foreground">
          Everyone who shows up all 7 days shares it · until {endDay} · {ends}
        </p>
      </div>
    </div>
  );
}

function Board({ win }: { win: BoardWindow }) {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries, hasNextPage, isLoading, totalCount, myRankEntry, myPageEntry, error, refetch } = useAllUsersLeaderboard(page, address, undefined, win);
  const me = address?.toLowerCase();
  const pfpMap = usePfps([...entries.map((e) => e.address.toLowerCase()), ...(me ? [me] : [])]);
  const { totalsByAddress: earnedByAddress } = useEarnedTotalsByAddresses([...entries.map((e) => e.address), ...(me ? [me] : [])]);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (entries.length === 0) return <EmptyState message="It just started — your next photo puts you on the board." />;

  const isOnCurrentPage = !!me && entries.some((e) => e.address.toLowerCase() === me);
  const pinnedMe: Entry | null =
    me && myRankEntry && !isOnCurrentPage
      ? { address: address!, username: myPageEntry?.username ?? null, points: Number(myRankEntry.points) || 0, rank: myRankEntry.rank }
      : null;
  // Only for the real top 3: right after "Previous", the old page's rows are still showing until page 1 loads.
  const showPodium = page === 0 && entries.length >= 3 && entries[0].rank === 1;
  const rows = entries.filter((e) => !showPodium || e.rank > 3);

  return (
    <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isLoading}>
      {showPodium ? <Podium top={entries.slice(0, 3)} pfpMap={pfpMap} earnedByAddress={earnedByAddress} /> : null}
      <div className="flex flex-col gap-1 pt-1.5">
        {rows.map((e) => (
          <Row key={e.address} entry={e} isMe={e.address.toLowerCase() === me} pfp={pfpMap[e.address.toLowerCase()]} compact earnedUsd={earnedByAddress[e.address.toLowerCase()] ?? 0} />
        ))}
        {pinnedMe ? <Row entry={pinnedMe} isMe pfp={pfpMap[me!]} compact earnedUsd={earnedByAddress[me!] ?? 0} /> : null}
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

/** Leaderboard: this week and the last 2 weeks — both scored by stake (bigger stake, more points). */
export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("fortnight");

  return (
    <MainPage>
      <PageBackHeader title="Leaderboard" />
      <div className="mx-auto max-w-3xl px-5 pb-8 pt-4 xl:max-w-3xl">
        <Segmented<Tab>
          ariaLabel="Leaderboard"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "week", label: "This week" },
            { value: "fortnight", label: "2 weeks" },
          ]}
        />
        <BoardBanner win={activeTab} />
        <Suspense fallback={<SkeletonRows />}>
          <Board key={activeTab} win={activeTab} />
        </Suspense>
      </div>
    </MainPage>
  );
}
