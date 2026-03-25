"use client";

import { useState, useRef, useEffect, useMemo,  } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormattedDelulu } from "@/lib/types";
import { cn, formatGAmount } from "@/lib/utils";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { UsersIcon, Plus, Check, Clock } from "lucide-react";
import { useApolloClient } from "@apollo/client/react";
import { GET_DELULU_BY_ID, useGraphDelulu } from "@/hooks/graph/useGraphDelulu";
import { useAccount } from "wagmi";
import { isDeluluCreator } from "@/lib/delulu-utils";
import {
  getMilestoneEndTimeMs,
  getMilestoneDurationDays,
  formatMilestoneCountdown,
  getMilestoneLabel,
  getDeluluCreatedAtMs,
  shouldShowBuyButton,
} from "@/lib/milestone-utils";
import type { FeedMilestone } from "@/hooks/graph/useAllDelulus";
import { resolveIPFSContent } from "@/lib/graph/ipfs-cache";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

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
}: DeluluCardProps) {
  const totalStake = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const tvlValue = delusion.totalSupportCollected ?? totalStake;
  const creatorAddress = disableUsernameLookup
    ? undefined
    : (delusion.creator as `0x${string}`);
  const { username: contractUsername } = useUsernameByAddress(creatorAddress);
  const displayUsername = contractUsername || delusion.username || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  const fallbackAvatarUrl = `${DEFAULT_AVATAR_BASE}${encodeURIComponent(
    creatorLabel,
  )}`;
  const avatarUrl = delusion.pfpUrl || fallbackAvatarUrl;

  const { milestones, isLoading: isMilestonesLoading } = useGraphDelulu(
    disableMilestoneQuery ? null : delusion.id,
  );
  const effectiveMilestones = feedMilestones ?? milestones;
  const effectiveMilestonesLoading = disableMilestoneQuery
    ? false
    : isMilestonesLoading;

  const { address } = useAccount();
  const isCreator = isDeluluCreator(address, delusion);
  const router = useRouter();
  const apolloClient = useApolloClient();

  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof nowMs === "number") return;
    const id = setInterval(() => setLocalNow(Date.now()), 30000);
    return () => clearInterval(id);
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

  const { previewMilestones, passedCount, totalCount, successPct } =
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
      const total = sorted.length;
      const completedCount = effectiveMilestones.filter(
        (m) => m.isVerified,
      ).length;
      const success =
        total > 0 ? Math.round((completedCount / total) * 100) : 0;

      const nowMs = now;
      const deluluCreatedAtMs = getDeluluCreatedAtMs(
        {
          createdAt: delusion.createdAt,
          stakingDeadline: delusion.stakingDeadline,
        },
        nowMs,
      );

      const endTimesMs: number[] = [];
      let prevEnd: number | null = null;
      for (const m of sorted) {
        const endMs = getMilestoneEndTimeMs(m, prevEnd, deluluCreatedAtMs);
        endTimesMs.push(endMs);
        prevEnd = endMs;
      }

      const currentIndex = endTimesMs.findIndex((endMs) => endMs > nowMs);
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
      };
    }, [
      milestones,
      effectiveMilestones,
      effectiveMilestonesLoading,
      now,
      delusion.createdAt,
      delusion.stakingDeadline,
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

  const cardContent = (
    <>
      <div
        onClick={href ? undefined : handleCardClick}
        onMouseEnter={handleMouseEnter}
        className={cn(
          "rounded-2xl overflow-hidden transition-all duration-300",
          "bg-card/95 border border-border shadow-sm",
          "hover:border-emerald/30 hover:shadow-md hover:shadow-emerald/5",
          href && "cursor-pointer active:scale-[0.99]",
        )}
        style={href ? { cursor: "pointer" } : {}}
      >
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-emerald/50 ring-offset-2 ring-offset-background shadow-inner">
            <img
              src={avatarUrl}
              alt={displayUsername || formatAddress(delusion.creator)}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-semibold mb-0.5">
              {displayUsername
                ? `@${displayUsername}`
                : formatAddress(delusion.creator)}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{timeLeftLabel === "Ended" ? "Ended" : "Active"}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 bg-secondary border border-border/50 rounded-full px-2 py-1">
            <span className="text-base font-black tabular-nums text-foreground">
              {formattedGAmount}
            </span>
            {isGoodDollar && (
              <span className="text-xs font-semibold text-muted-foreground">
                G$
              </span>
            )}
          </div>
        </div>

        <div className="px-4 pb-3">
          <p className="text-[17px] leading-relaxed text-foreground whitespace-pre-line font-semibold">
            {headline}
          </p>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {totalCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground font-medium">
                  Milestones
                </span>
                <span className="tabular-nums text-muted-foreground font-semibold">
                  {passedCount}/{totalCount}
                  {successPct > 0 && successPct < 100 && (
                    <span className="t font-normal"> · {successPct}%</span>
                  )}
                </span>
              </div>
            </div>
          )}
          {previewMilestones.length === 0 ? (
            isCreator ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(href || `/delulu/${delusion.id}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border bg-muted/50 hover:bg-muted text-sm font-medium text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add step
              </button> 
            ) : null
          ) : (
            <div className="space-y-1">
              {previewMilestones.map((m) => {
                const isPast = m.status === "past";
                const isPastFailed = isPast && m.pastLabel === "";
                const isInReview = isPast && m.pastLabel === "Review";
                const isCurrentUnderReview =
                  m.status === "current" && m.isSubmitted;
                const isCompleted = isPast && m.pastLabel === "Completed";
                const base =
                  "flex items-center justify-between rounded-xl py-1.5 text-sm transition-colors";

                const variant =
                  m.status === "current"
                    ? ""
                    : m.status === "past"
                      ? "bg-muted/40 border-border/40 text-muted-foreground"
                      : "bg-muted/30 border-border/30 text-muted-foreground";

                return (
                  <div
                    key={`${m.label}-${m.status}`}
                    className={cn(base, variant)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isCompleted ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald/20 text-emerald">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      ) : isInReview || isCurrentUnderReview ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full shrink-0",
                            m.status === "current"
                              ? "bg-emerald shadow-[0_0_6px_rgba(52,211,153,0.5)]"
                              : m.status === "past"
                                ? "bg-muted-foreground/50"
                                : "bg-border",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "truncate",
                          m.status === "current" && "font-medium",
                        )}
                      >
                        {m.status === "current" ? "Now: " : null}
                        {m.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-xs tabular-nums font-medium",
                          isPastFailed && "text-destructive",
                          isInReview && "text-amber-600 dark:text-amber-400",
                          m.status === "current" &&
                            m.isSubmitted &&
                            "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {m.status === "past"
                          ? (m.pastLabel ?? "Done")
                          : m.status === "future"
                            ? "Upcoming"
                            : m.status === "current" && m.isSubmitted
                              ? `Review · ${m.endTimeMs != null ? formatTimeLeftDayHour(now, m.endTimeMs) : "—"}`
                              : m.endTimeMs != null
                                ? formatMilestoneCountdown(now, m.endTimeMs)
                                : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* <div className="flex items-center justify-between gap-4 border-t border-border/50 bg-muted/30 px-4 py-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            {delusion.totalSupporters != null && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                <UsersIcon className="h-3 w-3 text-emerald/80" />
                <span>{delusion.totalSupporters}</span>
              </span>
            )}
          </div>
        </div> */}
      </div>
    </>
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
