"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormattedDelulu } from "@/lib/types";
import { cn, formatGAmount } from "@/lib/utils";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { Plus, Flame, Clock, Bell, DollarSign } from "lucide-react";
import { useApolloClient } from "@apollo/client/react";
import { GET_DELULU_BY_ID, useGraphDelulu } from "@/hooks/graph/useGraphDelulu";
import { useAuth } from "@/hooks/use-auth";
import { isDeluluCreator } from "@/lib/delulu-utils";
import {
  getMilestoneEndTimeMs,
  getMilestoneDurationDays,
  getMilestoneLabel,
  getDeluluCreatedAtMs,
  shouldShowBuyButton,
} from "@/lib/milestone-utils";
import type { FeedMilestone } from "@/hooks/graph/useAllDelulus";
import { resolveIPFSContent } from "@/lib/graph/ipfs-cache";
import { UserAvatar } from "@/components/ui/user-avatar";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}


function formatTimeLeft(target: Date) {
  const now = Date.now();
  const targetMs = target.getTime();
  const diffMs = targetMs - now;
  if (diffMs <= 0) {
    return { label: "Ended", secondsLeft: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label = "";

  if (days > 0) {
    const remHours = hours % 24;
    label = remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  } else if (hours > 0) {
    const remMinutes = minutes % 60;
    label = remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  } else if (minutes > 0) {
    label = `${minutes}m`;
  } else {
    label = "<1m";
  }

  return { label, secondsLeft: totalSeconds };
}

function formatTimeAgo(nowMs: number, pastMs: number): string {
  const diffMs = nowMs - pastMs;
  if (diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatTimeLeftDayHour(nowMs: number, targetMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "Ended";
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  return `${hours}h`;
}

interface DeluluCardProps {
  delusion: FormattedDelulu;
  onClick?: () => void;
  href?: string;
  onStake?: () => void;
  className?: string;
  isLast?: boolean;
  nowMs?: number;
  disableMilestoneQuery?: boolean;
  disableUsernameLookup?: boolean;
  feedMilestones?: FeedMilestone[];
  totalMilestoneCount?: number;
  creatorPfpUrl?: string | null | undefined;
}

export function DeluluCard({
  delusion,
  onClick,
  href,
  onStake,
  className = "",
  isLast = false,
  nowMs,
  disableMilestoneQuery = false,
  disableUsernameLookup = false,
  feedMilestones,
  totalMilestoneCount,
  creatorPfpUrl,
}: DeluluCardProps) {
  const totalStake = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const creatorSeed = delusion.creatorStake ?? 0;
  const userBuys = delusion.totalSupportCollected ?? 0;
  const combinedMarketTotal = creatorSeed + userBuys;
  const tvlValue = combinedMarketTotal > 0 ? combinedMarketTotal : totalStake;
  const creatorAddress = disableUsernameLookup
    ? undefined
    : (delusion.creator as `0x${string}`);
  const { username: contractUsername } = useUsernameByAddress(creatorAddress);
  const displayUsername = contractUsername || delusion.username || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  // creatorPfpUrl comes from Supabase (most reliable). delusion.pfpUrl is from IPFS
  // metadata — may be stale but used as a fallback for users who set a pfp at creation time.
  const resolvedPfpUrl = creatorPfpUrl !== undefined
    ? creatorPfpUrl  // undefined = still loading, pass through as-is
    : (delusion.pfpUrl ?? null);

  const { milestones, isLoading: isMilestonesLoading } = useGraphDelulu(
    disableMilestoneQuery ? null : delusion.id,
  );
  const effectiveMilestones = feedMilestones ?? milestones;
  const effectiveMilestonesLoading = disableMilestoneQuery
    ? false
    : isMilestonesLoading;

  const { address } = useAuth();
  const isCreator = isDeluluCreator(address, delusion);
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof nowMs === "number") return;
    const id = setInterval(() => setLocalNow(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setLocalNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nowMs]);
  const now = typeof nowMs === "number" ? nowMs : localNow;

  const isGoodDollar =
    delusion.tokenAddress?.toLowerCase() ===
    GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();

  const isHash = (str: string) => {
    return (
      str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str))
    );
  };

  const headlineRaw =
    delusion.content && !isHash(delusion.content) ? delusion.content : "";
  const headline = headlineRaw.trim() || "YOUR DELULU HEADLINE";

  const tvl = tvlValue;
  const formattedGAmount = formatGAmount(tvl);

  const { label: timeLeftLabel } = formatTimeLeft(delusion.resolutionDeadline);

  type MilestonePreviewStatus = "past" | "current" | "future";

  const { previewMilestones, passedCount, totalCount, successPct, streakCount } =
    useMemo(() => {
      type PreviewItem = {
        label: string;
        status: MilestonePreviewStatus;
        timeLeft?: string;
        durationDays?: number | null;
        pastLabel?: string;
        endTimeMs?: number;
        isSubmitted?: boolean;
      };
      const empty = {
        previewMilestones: [] as PreviewItem[],
        passedCount: 0,
        totalCount: 0,
        successPct: 0,
        streakCount: 0,
      };
      if (
        effectiveMilestonesLoading ||
        !effectiveMilestones ||
        effectiveMilestones.length === 0
      ) {
        return empty;
      }

      const sorted = [...effectiveMilestones].sort(
        (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
      );

      // Consecutive verified milestones from the start — drives streak badge
      let streakCount = 0;
      for (const m of sorted) {
        if (m.isVerified) streakCount++;
        else break;
      }

      const total = totalMilestoneCount ?? sorted.length;
      const completedCount = effectiveMilestones.filter(
        (m) => m.isVerified,
      ).length;
      const success =
        total > 0 ? Math.round((completedCount / total) * 100) : 0;

      const deluluCreatedAtMs = getDeluluCreatedAtMs(
        {
          createdAt: delusion.createdAt,
          stakingDeadline: delusion.stakingDeadline,
        },
        now,
      );

      const endTimesMs: number[] = [];
      let prevEnd: number | null = null;
      for (const m of sorted) {
        const endMs = getMilestoneEndTimeMs(m, prevEnd, deluluCreatedAtMs);
        endTimesMs.push(endMs);
        prevEnd = endMs;
      }

      const currentIndex = endTimesMs.findIndex((endMs) => endMs > now);
      const passed = currentIndex === -1 ? total : currentIndex;

      if (currentIndex === -1) {
        const start = Math.max(0, sorted.length - 3);
        const list = sorted.slice(start).map((m, i) => {
          const idx = start + i;
          const endMs = endTimesMs[idx];
          const pastLabel = m.isVerified
            ? "Completed"
            : m.isSubmitted
              ? "Review"
              : "Expired";
          return {
            label: getMilestoneLabel(m, 50),
            status: "past" as MilestonePreviewStatus,
            durationDays: getMilestoneDurationDays(m, endMs),
            pastLabel,
            endTimeMs: undefined,
            isSubmitted: m.isSubmitted,
          };
        });
        return {
          previewMilestones: list,
          passedCount: passed,
          totalCount: total,
          successPct: success,
          streakCount,
        };
      }

      const indices: number[] = [];
      if (currentIndex > 0) {
        indices.push(currentIndex - 1, currentIndex);
        if (currentIndex + 1 < sorted.length) indices.push(currentIndex + 1);
      } else {
        indices.push(currentIndex);
        if (currentIndex + 1 < sorted.length) indices.push(currentIndex + 1);
        if (currentIndex + 2 < sorted.length) indices.push(currentIndex + 2);
      }
      const unique = Array.from(new Set(indices)).slice(0, 3);

      const list = unique.map((idx) => {
        const m = sorted[idx];
        const endMs = endTimesMs[idx];
        let status: MilestonePreviewStatus =
          idx < currentIndex
            ? "past"
            : idx === currentIndex
              ? "current"
              : "future";

        let pastLabel: string | undefined;
        if (status === "past") {
          pastLabel = m.isVerified
            ? "Completed"
            : m.isSubmitted
              ? "Review"
              : "Expired";
        }

        return {
          label: getMilestoneLabel(m, 50),
          status,
          durationDays:
            status === "past" ? getMilestoneDurationDays(m, endMs) : null,
          pastLabel,
          endTimeMs: status === "current" ? endMs : undefined,
          isSubmitted: m.isSubmitted,
        };
      });
      return {
        previewMilestones: list,
        passedCount: passed,
        totalCount: total,
        successPct: success,
        streakCount,
      };
    }, [
      effectiveMilestones,
      effectiveMilestonesLoading,
      now,
      // Use timestamp numbers, not Date object references, so Apollo re-fetches
      // that return the same data don't cause spurious recomputes.
      delusion.createdAt?.getTime() ?? 0,
      delusion.stakingDeadline?.getTime() ?? 0,
      totalMilestoneCount,
    ]);


  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node)
      ) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  const handleMouseEnter = () => {
    if (!href) return;
    router.prefetch(href);
    // Warm detail-page GraphQL + IPFS so first navigation feels instant.
    apolloClient
      .query({
        query: GET_DELULU_BY_ID,
        variables: { id: String(delusion.id) },
        fetchPolicy: "cache-first",
      })
      .catch(() => {});
    if (delusion.contentHash) {
      resolveIPFSContent(delusion.contentHash).catch(() => {});
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // ── Card visual values ──
  const currentMilestone = previewMilestones.find((m) => m.status === "current") ?? null;
  const lastMilestone = previewMilestones[previewMilestones.length - 1] ?? null;
  const resolutionMs = delusion.resolutionDeadline.getTime();
  const isEnded = resolutionMs > 0 && resolutionMs <= now;
  const timeRemaining = !isEnded ? formatTimeLeftDayHour(now, resolutionMs) : null;
  // "Hot" when ≥ 5 believers — signals social proof without knowing pool distribution
  const isHot = !isEnded && (delusion.totalSupporters ?? 0) >= 5;

  const showSupportButton =
    !isEnded &&
    !isCreator &&
    shouldShowBuyButton(effectiveMilestones, now, {
      createdAt: delusion.createdAt,
      stakingDeadline: delusion.stakingDeadline,
    });

  // ── Urgency level — drives border colour, glow and pill copy ──
  const msLeft = resolutionMs - now;
  const hoursLeft = msLeft / (1000 * 60 * 60);
  const urgency: "ended" | "critical" | "warning" | "normal" = isEnded
    ? "ended"
    : hoursLeft < 24
    ? "critical"
    : hoursLeft < 72
    ? "warning"
    : "normal";

  // Deterministic gradient from creator address — each creator always gets the same colour pair
  const addrHex = delusion.creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(addrHex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  const cardGradient = `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;

  // Avatar progress ring — 52px avatar, SVG bleeds 4px each side → 60×60, r=26
  const ringR = 26;
  const ringCircumference = 2 * Math.PI * ringR; // ≈ 163.36

  const cardContent = (
    // Outer card: no overflow-hidden so the avatar can float over the header
    <div
      onClick={href ? undefined : handleCardClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "rounded-2xl bg-card shadow-sm",
        "transition-all duration-200",
        "hover:shadow-xl hover:-translate-y-0.5",
        urgency === "ended" && "opacity-80",
        href && "cursor-pointer active:scale-[0.99]",
      )}
    >
      {/* ── Hero header: goal text overlaid on the gradient/image ── */}
      <div
        className="relative rounded-t-2xl overflow-hidden flex flex-col justify-end"
        style={{ background: cardGradient, minHeight: 130 }}
      >
        {/* Creator bg image */}
        {delusion.bgImageUrl && (
          <img
            src={delusion.bgImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Scrim — makes white headline text readable over any image/gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20 pointer-events-none" />

        {/* Hot badge — top left, only when social proof threshold is met */}
        {isHot && (
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[9px] font-bold backdrop-blur-sm bg-orange-500/25 text-orange-300 border border-orange-400/30">
              <Flame className="w-2 h-2" />
              Hot
            </span>
          </div>
        )}

        {/* Status / urgency pill — top right */}
        <div className="absolute top-2.5 right-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide backdrop-blur-sm",
              urgency === "critical" && "bg-rose-500/30 text-rose-300 border border-rose-400/40",
              urgency === "warning"  && "bg-amber-500/25 text-amber-300 border border-amber-400/35",
              urgency === "ended"    && "bg-black/40 text-white/50",
              urgency === "normal"   && "bg-delulu-green/20 text-delulu-green border border-delulu-green/35",
            )}
          >
            {urgency === "critical" && <Clock className="w-2 h-2" />}
            {urgency === "warning"  && <Bell className="w-2 h-2" />}
            {urgency === "ended" ? "Ended" : urgency === "critical" ? "Ending" : "Active"}
          </span>
        </div>

        {/* Headline — the first thing eyes land on */}
        <div className="relative px-4 pb-10 pt-10">
          <p
            className="text-white font-bold text-[19px] leading-snug line-clamp-3"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
          >
            {headline}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4">
        {/* Avatar — negative margin pulls it up to overlap the header */}
        <div className="-mt-7 mb-2 flex items-end justify-between">
          <div className="relative w-[52px] h-[52px] shrink-0">
            {/* Avatar image with card-coloured border creating the "floating" cutout */}
            <div className="w-[52px] h-[52px] rounded-full border-[3px] border-card shadow-md overflow-hidden">
              <UserAvatar
                address={delusion.creator}
                username={displayUsername}
                pfpUrl={resolvedPfpUrl}
                size={46}
              />
            </div>
            {/* Milestone completion arc */}
            {totalCount > 0 && (
              <svg
                className="absolute pointer-events-none -rotate-90"
                style={{ inset: "-4px", width: 60, height: 60 }}
                viewBox="0 0 60 60"
              >
                <circle
                  cx="30" cy="30" r={ringR}
                  fill="none" strokeWidth="2.5"
                  className="stroke-border/30"
                />
                {successPct > 0 && (
                  <circle
                    cx="30" cy="30" r={ringR}
                    fill="none" strokeWidth="2.5"
                    strokeLinecap="round"
                    className="stroke-delulu-green transition-all duration-700"
                    strokeDasharray={`${(successPct / 100) * ringCircumference} ${ringCircumference}`}
                  />
                )}
              </svg>
            )}
            {/* Streak badge — shows on corner when ≥ 2 consecutive verified milestones */}
            {streakCount >= 2 && (
              <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-card border border-border/60 rounded-full px-1.5 py-0.5 shadow-sm">
                <Flame className="w-2.5 h-2.5 text-orange-400" />
                <span className="text-[9px] font-black leading-none text-foreground">{streakCount}</span>
              </div>
            )}
          </div>

        </div>

        {/* Creator name + created-at + buy button on same row */}
        <div className="flex items-center gap-1.5 mb-3 min-w-0">
          <span className="text-[12px] font-semibold text-muted-foreground truncate leading-tight">
            {creatorLabel}
          </span>
          {delusion.createdAt && delusion.createdAt.getTime() > 0 && (
            <>
              <span className="shrink-0 text-muted-foreground/40 text-[11px]">·</span>
              <span className="shrink-0 text-[11px] text-muted-foreground/60">
                {formatTimeAgo(now, delusion.createdAt.getTime())}
              </span>
            </>
          )}
          {showSupportButton && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/delulu/${delusion.id}?action=buy`);
              }}
              className="ml-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-foreground/80 text-[11px] font-semibold shadow-sm hover:bg-muted hover:text-foreground active:scale-95 transition-all"
            >
              <DollarSign className="w-3 h-3" />
              Buy
            </button>
          )}
        </div>

        {/* ── Milestone list ── */}
        {totalCount > 0 ? (
          <div className="pb-4 space-y-0">
            {previewMilestones.map((m, i) => {
              const isCurrent = m.status === "current";
              const isCompleted = m.status === "past" && m.pastLabel === "Completed";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5",
                    !isCurrent && "opacity-40",
                  )}
                >
                  {/* Dot */}
                  <div
                    className={cn(
                      "shrink-0 rounded-full",
                      isCurrent
                        ? "w-2 h-2 bg-delulu-green shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]"
                        : isCompleted
                        ? "w-1.5 h-1.5 bg-delulu-green"
                        : "w-1.5 h-1.5 bg-border",
                    )}
                  />
                  {/* Label */}
                  <span
                    className={cn(
                      "flex-1 text-xs truncate",
                      isCurrent ? "text-foreground font-medium" : "text-foreground/70",
                    )}
                  >
                    {m.isSubmitted && isCurrent ? `In review · ${m.label}` : m.label}
                  </span>
                  {/* Right tag */}
                  {isCurrent && m.endTimeMs != null ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatTimeLeftDayHour(now, m.endTimeMs)}
                    </span>
                  ) : m.status === "past" && m.pastLabel ? (
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-semibold",
                        isCompleted ? "text-delulu-green" : "text-muted-foreground",
                      )}
                    >
                      {m.pastLabel}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : isCreator ? (
          <div className="pb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(href || `/delulu/${delusion.id}`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add milestone
            </button>
          </div>
        ) : (
          <div className="pb-4" />
        )}
      </div>

      {/* ── Stats bar ── */}
      <div className="flex items-stretch border-t border-border/40 divide-x divide-border/40">
        {/* Pool */}
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-sm font-black tabular-nums text-foreground leading-none">
            {formattedGAmount}
            {isGoodDollar && (
              <span className="text-[10px] font-semibold text-muted-foreground ml-0.5">
                G$
              </span>
            )}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
            Pool
          </span>
        </div>

        {/* Steps */}
        {totalCount > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
            <span className="text-sm font-black tabular-nums text-foreground leading-none">
              {passedCount}
              <span className="text-xs font-normal text-muted-foreground">
                /{totalCount}
              </span>
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Steps
            </span>
          </div>
        )}

        {/* Believers count */}
        {delusion.totalSupporters != null && delusion.totalSupporters > 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-3 gap-1">
            <span className="text-sm font-black tabular-nums text-foreground">
              {delusion.totalSupporters}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Believers
            </span>
          </div>
        )}

        {/* Time left — coloured by urgency */}
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span
            className={cn(
              "text-sm font-black tabular-nums leading-none",
              urgency === "critical" && "text-rose-400",
              urgency === "warning"  && "text-amber-400",
              urgency === "ended"    && "text-muted-foreground",
              urgency === "normal"   && "text-foreground",
            )}
          >
            {timeRemaining ?? "Done"}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
            {isEnded ? "Status" : "Left"}
          </span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "block h-auto mb-4")}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleMouseEnter}
        prefetch={true}
        scroll={true}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(className, "block h-auto mb-4")}
      onClick={onClick || undefined}
    >
      {cardContent}
    </div>
  );
}
