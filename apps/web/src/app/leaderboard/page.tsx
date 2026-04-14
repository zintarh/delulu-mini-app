"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useChainId } from "wagmi";
import { useAccount } from "wagmi";
import { useDeluluLeaderboard } from "@/hooks/graph/useDeluluLeaderboard";
import { useAllUsersLeaderboard } from "@/hooks/graph/useAllUsersLeaderboard";
import { useGoodDollarTotalSupply } from "@/hooks/use-gooddollar-total-supply";
import { getDeluluContractAddress } from "@/lib/constant";
import { cn, formatGAmount, formatGAmountInt } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Trophy, Users } from "lucide-react";
import type { DeluluLeaderboardEntry } from "@/hooks/graph/useDeluluLeaderboard";
import type { UserLeaderboardEntry } from "@/hooks/graph/useAllUsersLeaderboard";

const PAGE_SIZE = 10;

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

const RANK_STYLES: Record<number, { badge: string; row: string }> = {
  1: { badge: "bg-[#fcff52] text-black shadow-[0_0_10px_rgba(252,255,82,0.4)]", row: "bg-[#fcff52]/5" },
  2: { badge: "bg-zinc-600 text-white", row: "" },
  3: { badge: "bg-[#35d07f]/30 text-[#35d07f]", row: "bg-[#35d07f]/5" },
};

function rankStyle(rank: number) {
  return RANK_STYLES[rank] ?? { badge: "bg-muted/60 text-muted-foreground", row: "" };
}

function formatAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function formatCampaignName(entry: DeluluLeaderboardEntry) {
  if (entry.creatorUsername) return `@${entry.creatorUsername}`;
  return formatAddr(entry.creatorAddress);
}

function formatTitle(entry: DeluluLeaderboardEntry) {
  const text = entry.title ?? `Delulu #${entry.onChainId}`;
  return text.length > 40 ? text.slice(0, 40) + "…" : text;
}

function UserAvatar({ address, username, pfpUrl }: { address: string; username: string | null; pfpUrl?: string | null }) {
  const seed = encodeURIComponent(username ? `@${username}` : address);
  const src = pfpUrl || `${DEFAULT_AVATAR_BASE}${seed}`;
  return (
    <img
      src={src}
      alt={username ?? address}
      className="w-8 h-8 rounded-full bg-muted shrink-0 object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = `${DEFAULT_AVATAR_BASE}${seed}`;
      }}
    />
  );
}

// ── Campaign tab ────────────────────────────────────────────────────────────

function CampaignLeaderboard() {
  const [page, setPage] = useState(0);
  const { address } = useAccount();
  const { entries, allEntries, hasNextPage, isLoading, error, refetch } = useDeluluLeaderboard(PAGE_SIZE, page);
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  // Find user's best entry across all fetched entries (sorted by UB desc)
  const myEntry = address
    ? allEntries.find((e) => e.creatorAddress.toLowerCase() === address.toLowerCase()) ?? null
    : null;
  const myRank = myEntry ? allEntries.indexOf(myEntry) + 1 : null;
  const showPinnedMe = myEntry && myRank;

  if (isLoading) return <SkeletonRows />;

  if (error) return <ErrorState onRetry={refetch} error={error} />;

  if (entries.length === 0) return (
    <EmptyState message="No entries yet — create a Delulu and be first!" />
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
          <div className="w-7 shrink-0" />
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Creator</span>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="w-10 sm:w-12 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">G$</span>
            <span className="w-10 sm:w-12 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shares</span>
            <span className="w-6 sm:w-8 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">UB</span>
          </div>
        </div>

        {/* Pinned "you" row at top of table when not on current page */}
        {showPinnedMe && (
          <Link
            href={`/delulu/${myEntry!.id}`}
            className="flex items-center gap-3 px-4 py-3.5 bg-[#fcff52]/8 border-b-2 border-[#fcff52]/20 hover:bg-[#fcff52]/10 transition-colors"
          >
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", rankStyle(myRank!).badge)}>
              {myRank}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug truncate">
                {formatTitle(myEntry!)}
                <span className="ml-1.5 text-[10px] font-black text-[#fcff52] align-middle">you</span>
              </p>
              <p className="text-xs text-muted-foreground truncate">{formatCampaignName(myEntry!)}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">{formatGAmountInt(myEntry!.totalG)}</span>
              <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">{myEntry!.shareSupply}</span>
              <span className="w-6 sm:w-8 text-right text-xs sm:text-sm font-bold text-[#fcff52] tabular-nums">{myEntry!.uniqueBuyerCount}</span>
            </div>
          </Link>
        )}

        {entries.filter((entry) =>
          !showPinnedMe || entry.creatorAddress.toLowerCase() !== address!.toLowerCase()
        ).map((entry, idx) => {
          const rank = rangeStart + idx;
          const { badge, row } = rankStyle(rank);
          return (
            <Link
              key={entry.id}
              href={`/delulu/${entry.id}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors",
                row,
              )}
            >
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", badge)}>
                {rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug truncate">
                  {formatTitle(entry)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {formatCampaignName(entry)}
                  <span className="mx-1 opacity-40">·</span>
                  <span className="opacity-50">#{entry.onChainId}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">{formatGAmountInt(entry.totalG)}</span>
                <span className="w-10 sm:w-12 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">{entry.shareSupply}</span>
                <span className="w-6 sm:w-8 text-right text-xs sm:text-sm font-bold text-[#fcff52] tabular-nums">{entry.uniqueBuyerCount}</span>
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
  const { address } = useAccount();
  const { entries, hasNextPage, hasPrevPage, isLoading, totalCount, isRankLoading, myRankEntry, myPageEntry, error, refetch } =
    useAllUsersLeaderboard(page, address);

  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + entries.length;

  // Batch-fetch pfp URLs from the profile API for all addresses on this page
  const [pfpMap, setPfpMap] = useState<Record<string, string | null>>({});
  const lastBatchKeyRef = useRef("");

  useEffect(() => {
    if (entries.length === 0) return;
    const addresses = entries.map((e) => e.address.toLowerCase());
    if (address) addresses.push(address.toLowerCase());
    const unique = Array.from(new Set(addresses));
    unique.sort();
    const batchKey = unique.join(",");
    if (batchKey === lastBatchKeyRef.current) return;
    lastBatchKeyRef.current = batchKey;
    let cancelled = false;
    fetch(`/api/profile?addresses=${encodeURIComponent(batchKey)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((payload) => {
        if (cancelled || !payload?.profiles) return;
        setPfpMap((prev) => ({ ...prev, ...payload.profiles }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [entries, address]);

  if (isLoading && entries.length === 0) return <SkeletonRows />;

  if (error) return <ErrorState onRetry={refetch} error={error} />;

  if (entries.length === 0) return (
    <EmptyState message="No dreamers indexed yet." />
  );

  const showPinnedMe = address && myRankEntry;

  return (
    <div className="space-y-4">
      {/* Total count pill */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {isRankLoading ? (
            <span className="inline-block w-16 h-4 bg-muted rounded animate-pulse" />
          ) : (
            <><span className="font-bold text-foreground">{totalCount ?? "…"}</span> dreamers indexed</>
          )}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
          <div className="w-7 shrink-0" />
          <div className="w-8 shrink-0" />
          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dreamer</span>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="hidden sm:block w-16 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Delulus</span>
            <span className="w-12 sm:w-14 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">UB</span>
            <span className="w-12 sm:w-14 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pts</span>
          </div>
        </div>

        {/* Pinned "you" row at top when not on current page */}
        {showPinnedMe && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#fcff52]/8 border-b-2 border-[#fcff52]/20">
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", rankStyle(myRankEntry!.rank).badge)}>
              {myRankEntry!.rank}
            </div>
            <UserAvatar address={address!} username={myPageEntry?.username ?? null} pfpUrl={pfpMap[address!.toLowerCase()]} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {myPageEntry?.username ? `@${myPageEntry.username}` : formatAddr(address!)}
                <span className="ml-1.5 text-[10px] font-black text-[#fcff52] align-middle">you</span>
              </p>
              <p className="text-[11px] text-muted-foreground/60 font-mono">{formatAddr(address!)}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <span className="hidden sm:block w-16 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                {myPageEntry?.deluluCount ?? "—"}
              </span>
              <span className="w-12 sm:w-14 text-right text-xs sm:text-sm font-bold text-[#fcff52] tabular-nums">
                {myPageEntry?.totalUniqueBuyers ?? 0}
              </span>
              <span className="w-12 sm:w-14 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                {myRankEntry!.points}
              </span>
            </div>
          </div>
        )}

        {entries.filter((entry) =>
          !showPinnedMe || entry.address.toLowerCase() !== address!.toLowerCase()
        ).map((entry) => {
          const { badge, row } = rankStyle(entry.rank);
          const name = entry.username ? `@${entry.username}` : formatAddr(entry.address);
          return (
            <div
              key={entry.address}
              className={cn("flex items-center gap-3 px-4 py-3 transition-colors", row)}
            >
              {/* Rank */}
              <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0", badge)}>
                {entry.rank}
              </div>

              {/* Avatar */}
              <UserAvatar address={entry.address} username={entry.username} pfpUrl={pfpMap[entry.address.toLowerCase()]} />

              {/* Name + address */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug truncate">
                  {name}
                </p>
                <p className="text-[11px] text-muted-foreground/60 truncate font-mono">{formatAddr(entry.address)}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <span className="hidden sm:block w-16 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                  {entry.deluluCount > 0 ? entry.deluluCount : <span className="text-muted-foreground/40">—</span>}
                </span>
                <span className="w-12 sm:w-14 text-right text-xs sm:text-sm font-bold text-[#fcff52] tabular-nums">
                  {entry.totalUniqueBuyers > 0 ? entry.totalUniqueBuyers : <span className="text-muted-foreground/30 font-normal">0</span>}
                </span>
                <span className="w-12 sm:w-14 text-right text-xs sm:text-sm font-bold text-foreground tabular-nums">
                  {entry.points > 0 ? entry.points : <span className="text-muted-foreground/30 font-normal">0</span>}
                </span>
              </div>
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
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function ErrorState({ onRetry, error }: { onRetry: () => void; error?: Error | null }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <p className="font-semibold text-destructive mb-1">Failed to load</p>
      {error?.message && (
        <p className="text-xs text-muted-foreground mb-2 font-mono break-all">{error.message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 text-sm font-semibold border border-border rounded-lg bg-background hover:bg-muted transition-colors mt-2"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-24">
      <Trophy className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-20" />
      <p className="text-sm text-muted-foreground">{message}</p>
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
    <div className="flex justify-between items-center pt-1 text-xs text-muted-foreground">
      <button
        type="button"
        disabled={page === 0}
        onClick={onPrev}
        className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted font-semibold transition-colors"
      >
        ← Prev
      </button>
      <span className="font-medium tabular-nums">
        {rangeStart}–{rangeEnd}
        {total != null ? ` of ${total}` : hasNextPage ? "+" : ""}
      </span>
      <button
        type="button"
        disabled={!hasNextPage}
        onClick={onNext}
        className="px-4 py-2 rounded-lg border border-border bg-card disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted font-semibold transition-colors"
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
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-[#fcff52]/4 blur-[140px]" />
      </div>

      <div className="relative max-w-2xl sm:max-w-3xl mx-auto px-4 pt-8 pb-20">
        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          {formattedGAmount && !isLoadingGSupply && (
            <Link
              href={celoscanContractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              <img src="/gooddollar-logo.png" alt="G$" className="w-3.5 h-3.5 object-contain" />
              <span className="font-bold text-foreground">{formattedGAmount}</span>
              <span className="text-muted-foreground hidden sm:inline">circulating</span>
              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
            </Link>
          )}
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#fcff52]/10 border-2 border-[#fcff52]/20 mb-4">
            <Trophy className="w-7 h-7 text-[#fcff52]" />
          </div>
          <h1
            className="text-4xl sm:text-5xl font-black text-foreground"
            style={{ fontFamily: "var(--font-gloria), cursive" }}
          >
            Leaderboard
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("dreamers")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "dreamers"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Dreamers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("campaign")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === "campaign"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            Weekly Campaign
          </button>
        </div>

        {/* Tab subtitle */}
        {activeTab === "campaign" && (
          <p className="text-muted-foreground text-xs mb-5 text-center">
            Ranked by unique buyers (UB) · Active campaign
          </p>
        )}

        {/* Content */}
        {activeTab === "campaign" ? <CampaignLeaderboard /> : <DreamersLeaderboard />}
      </div>
    </div>
  );
}
