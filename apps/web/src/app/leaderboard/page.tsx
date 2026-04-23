"use client";

import { useState } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useAuth } from "@/hooks/use-auth";
import { useDeluluLeaderboard } from "@/hooks/graph/useDeluluLeaderboard";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount, formatGAmountInt } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Trophy, Users } from "lucide-react";
import type { DeluluLeaderboardEntry } from "@/hooks/graph/useDeluluLeaderboard";
import { usePfps } from "@/hooks/use-profile-pfp";
import { UserAvatar } from "@/components/ui/user-avatar";

const PAGE_SIZE = 10;

function formatAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function formatCampaignName(entry: DeluluLeaderboardEntry) {
  if (entry.creatorUsername) return `@${entry.creatorUsername}`;
  return formatAddr(entry.creatorAddress);
}

function formatTitle(entry: DeluluLeaderboardEntry) {
  const text = entry.title ?? `Delulu #${entry.onChainId}`;
  return text.length > 38 ? text.slice(0, 38) + "…" : text;
}

// ── Rank medal ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-7 h-7 rounded-full bg-[#fcff52] flex items-center justify-center shadow-[0_0_10px_rgba(252,255,82,0.4)] shrink-0">
      <span className="text-xs font-bold text-black" style={{ fontFamily: "'Clash Display', sans-serif" }}>1</span>
    </div>
  );
  if (rank === 2) return (
    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-zinc-200" style={{ fontFamily: "'Clash Display', sans-serif" }}>2</span>
    </div>
  );
  if (rank === 3) return (
    <div className="w-7 h-7 rounded-full bg-[#35d07f]/20 border border-[#35d07f]/30 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-[#35d07f]" style={{ fontFamily: "'Clash Display', sans-serif" }}>3</span>
    </div>
  );
  return (
    <div className="w-7 h-7 flex items-center justify-center shrink-0">
      <span className="text-xs text-muted-foreground/40 tabular-nums" style={{ fontFamily: "'Clash Display', sans-serif" }}>{rank}</span>
    </div>
  );
}

// ── Campaign tab ─────────────────────────────────────────────────────────────

function CampaignLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries, allEntries, hasNextPage, isLoading, error, refetch } = useDeluluLeaderboard(PAGE_SIZE, page);
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  const myEntry = address
    ? allEntries.find((e) => e.creatorAddress.toLowerCase() === address.toLowerCase()) ?? null
    : null;
  const myRank = myEntry ? allEntries.indexOf(myEntry) + 1 : null;
  const isOnCurrentPage = !!address && entries.some(
    (e) => e.creatorAddress.toLowerCase() === address.toLowerCase()
  );
  const showPinnedMe = myEntry && myRank && !isOnCurrentPage;

  if (isLoading) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} error={error} />;
  if (entries.length === 0) return <EmptyState message="No campaigns this week yet — create a Delulu and lead the board!" />;

  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="flex items-center gap-2.5 px-3 pb-1.5">
        <div className="w-7 shrink-0" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>Creator</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="w-11 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>G$</span>
          <span className="w-10 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 hidden sm:block" style={{ fontFamily: "var(--font-manrope)" }}>Shares</span>
          <span className="w-7 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>UB</span>
        </div>
      </div>

      <div className="space-y-1">
        {/* Pinned "you" row */}
        {showPinnedMe && (
          <Link
            href={`/delulu/${myEntry!.id}`}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#fcff52]/8 border border-[#fcff52]/20 hover:bg-[#fcff52]/12 transition-colors"
          >
            <RankBadge rank={myRank!} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground leading-snug truncate" style={{ fontFamily: "var(--font-manrope)" }}>
                  {formatTitle(myEntry!)}
                </p>
                <span className="shrink-0 text-[9px] font-bold text-[#fcff52] bg-[#fcff52]/15 px-1.5 py-0.5 rounded-full tracking-wide">YOU</span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 truncate" style={{ fontFamily: "var(--font-manrope)" }}>{formatCampaignName(myEntry!)}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="w-11 text-right text-xs font-semibold text-foreground tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>{formatGAmountInt(myEntry!.totalG)}</span>
              <span className="w-10 text-right text-xs font-semibold text-foreground tabular-nums hidden sm:block" style={{ fontFamily: "var(--font-manrope)" }}>{myEntry!.shareSupply}</span>
              <span className="w-7 text-right text-xs font-semibold text-[#fcff52] tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>{myEntry!.uniqueBuyerCount}</span>
            </div>
          </Link>
        )}

        {entries.filter((entry) =>
          !showPinnedMe || entry.creatorAddress.toLowerCase() !== address!.toLowerCase()
        ).map((entry, idx) => {
          const rank = rangeStart + idx;
          return (
            <Link
              key={entry.id}
              href={`/delulu/${entry.id}`}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors group",
                rank === 1
                  ? "bg-[#fcff52]/5 hover:bg-[#fcff52]/8 border border-[#fcff52]/10"
                  : "bg-card/30 hover:bg-card/70 border border-border/30",
              )}
            >
              <RankBadge rank={rank} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug truncate" style={{ fontFamily: "var(--font-manrope)" }}>
                  {formatTitle(entry)}
                </p>
                <p className="text-[11px] text-muted-foreground/50 truncate" style={{ fontFamily: "var(--font-manrope)" }}>
                  {formatCampaignName(entry)}<span className="mx-1 opacity-30">·</span><span className="opacity-40">#{entry.onChainId}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="w-11 text-right text-xs font-semibold text-foreground tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>{formatGAmountInt(entry.totalG)}</span>
                <span className="w-10 text-right text-xs font-semibold text-foreground tabular-nums hidden sm:block" style={{ fontFamily: "var(--font-manrope)" }}>{entry.shareSupply}</span>
                <span className="w-7 text-right text-xs font-semibold text-[#fcff52] tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>{entry.uniqueBuyerCount}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        page={page}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        hasNextPage={hasNextPage}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

// ── Dreamers tab ─────────────────────────────────────────────────────────────

function DreamersLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAuth();
  const { entries, hasNextPage, isLoading, totalCount, isRankLoading, myRankEntry, myPageEntry, error, refetch } =
    useAllUsersLeaderboard(page, address);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  const allAddresses = [
    ...entries.map((e) => e.address.toLowerCase()),
    ...(address ? [address.toLowerCase()] : []),
  ];
  const pfpMap = usePfps(allAddresses);

  if (isLoading && entries.length === 0) return <SkeletonRows />;
  if (error) return <ErrorState onRetry={refetch} error={error} />;
  if (entries.length === 0) return <EmptyState message="No dreamers yet." />;

  const isOnCurrentPage = !!address && entries.some(
    (e) => e.address.toLowerCase() === address.toLowerCase()
  );
  const showPinnedMe = address && myRankEntry && !isOnCurrentPage;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-2 pb-1">
        <Users className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/60" style={{ fontFamily: "var(--font-manrope)" }}>
          {isRankLoading ? (
            <span className="inline-block w-12 h-3 bg-muted rounded animate-pulse" />
          ) : (
            <><span className="font-bold text-foreground/80">{totalCount ?? "…"}</span> dreamers</>
          )}
        </span>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2.5 px-3 pb-1.5">
        <div className="w-7 shrink-0" />
        <div className="w-8 shrink-0" />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>Dreamer</span>
        <span className="w-14 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>Points</span>
      </div>

      <div className="space-y-1">
        {/* Pinned "you" row */}
        {showPinnedMe && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#fcff52]/8 border border-[#fcff52]/20">
            <RankBadge rank={myRankEntry!.rank} />
            <UserAvatar address={address!} username={myPageEntry?.username ?? null} pfpUrl={pfpMap[address!.toLowerCase()]} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-foreground truncate" style={{ fontFamily: "var(--font-manrope)" }}>
                  {myPageEntry?.username ? `@${myPageEntry.username}` : formatAddr(address!)}
                </p>
                <span className="shrink-0 text-[9px] font-bold text-[#fcff52] bg-[#fcff52]/15 px-1.5 py-0.5 rounded-full tracking-wide">YOU</span>
              </div>
              <p className="text-[11px] text-muted-foreground/40 font-mono">{formatAddr(address!)}</p>
            </div>
            <span className="w-14 text-right text-xs font-semibold text-foreground tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>
              {myRankEntry!.points}
            </span>
          </div>
        )}

        {entries.filter((entry) =>
          !showPinnedMe || entry.address.toLowerCase() !== address!.toLowerCase()
        ).map((entry) => {
          const name = entry.username ? `@${entry.username}` : formatAddr(entry.address);
          return (
            <div
              key={entry.address}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors",
                entry.rank === 1
                  ? "bg-[#fcff52]/5 border border-[#fcff52]/10"
                  : "bg-card/30 hover:bg-card/70 border border-border/30",
              )}
            >
              <RankBadge rank={entry.rank} />
              <UserAvatar address={entry.address} username={entry.username} pfpUrl={pfpMap[entry.address.toLowerCase()]} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug truncate" style={{ fontFamily: "var(--font-manrope)" }}>
                  {name}
                </p>
                <p className="text-[11px] text-muted-foreground/40 font-mono">{formatAddr(entry.address)}</p>
              </div>
              <span className="w-14 text-right text-xs font-semibold tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>
                {entry.points > 0
                  ? <span className="text-foreground">{entry.points}</span>
                  : <span className="text-muted-foreground/30">0</span>}
              </span>
            </div>
          );
        })}
      </div>

      <Pagination
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

// ── Shared helpers ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2 pt-12">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className={cn("h-[62px] rounded-2xl bg-muted/30 animate-pulse", i === 0 && "opacity-80")} />
      ))}
    </div>
  );
}

function ErrorState({ onRetry, error }: { onRetry: () => void; error?: Error | null }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <p className="font-semibold text-destructive mb-1 text-sm" style={{ fontFamily: "var(--font-manrope)" }}>Failed to load</p>
      {error?.message && (
        <p className="text-xs text-muted-foreground/60 mb-4 font-mono break-all">{error.message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="px-5 py-2 text-sm font-semibold border border-border rounded-xl bg-background hover:bg-muted transition-colors"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-24">
      <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-10" />
      <p className="text-sm text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>{message}</p>
    </div>
  );
}

function Pagination({
  page,
  rangeStart,
  rangeEnd,
  total,
  hasNextPage,
  onPrev,
  onNext,
}: {
  page: number;
  rangeStart: number;
  rangeEnd: number;
  total?: number | string | null;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex justify-between items-center pt-2">
      <button
        type="button"
        disabled={page === 0}
        onClick={onPrev}
        className="px-4 py-2 rounded-xl border border-border/60 bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted/60 text-xs font-semibold transition-colors"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        ← Prev
      </button>
      <span className="text-xs text-muted-foreground/50 tabular-nums" style={{ fontFamily: "var(--font-manrope)" }}>
        {rangeStart}–{rangeEnd}{total != null ? ` of ${total}` : hasNextPage ? "+" : ""}
      </span>
      <button
        type="button"
        disabled={!hasNextPage}
        onClick={onNext}
        className="px-4 py-2 rounded-xl border border-border/60 bg-card/60 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted/60 text-xs font-semibold transition-colors"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        Next →
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = "campaign" | "dreamers";

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dreamers");

  const chainId = useChainId();
  const deluluContractAddress = getDeluluContractAddress(chainId);
  const celoscanContractUrl = `https://celoscan.io/address/${deluluContractAddress}`;

  const { totalSupply: gTotalSupply, isLoading: isLoadingGSupply } = useGoodDollarTotalSupply();
  const formattedGAmount = typeof gTotalSupply === "number" ? formatGAmount(gTotalSupply) : null;

  return (
    <div className="h-screen overflow-y-auto scrollbar-hide bg-background relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full bg-[#fcff52]/3 blur-[120px]" />
      </div>

      <div className="relative max-w-lg sm:max-w-2xl lg:max-w-3xl mx-auto px-4 pt-8 pb-24">

        {/* Top nav */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          {formattedGAmount && !isLoadingGSupply && (
            <Link
              href={celoscanContractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-xs hover:bg-card transition-colors"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              <img src="/gooddollar-logo.png" alt="G$" className="w-3.5 h-3.5 object-contain" />
              <span className="font-bold text-foreground">{formattedGAmount}</span>
              <span className="text-muted-foreground/60 hidden sm:inline">G$ in pool</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/40" />
            </Link>
          )}
        </div>

        {/* Hero */}
        <div className="mb-8 text-center">
          <h1
            className="text-3xl leading-none font-semibold text-foreground tracking-tight"
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Leaderboard
          </h1>
          <p className="mt-2 text-xs text-muted-foreground/50" style={{ fontFamily: "var(--font-manrope)" }}>
            {activeTab === "campaign" ? "Delulu Monday · resets every 7 days" : "Top dreamers by points earned"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/20 border border-border/40 mb-6">
          {(["dreamers", "campaign"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {tab === "dreamers" ? <Users className="w-3 h-3" /> : <Trophy className="w-3 h-3" />}
              {tab === "dreamers" ? "Dreamers" : "Delulu Monday"}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "campaign" ? <CampaignLeaderboard /> : <DreamersLeaderboard />}
      </div>
    </div>
  );
}
