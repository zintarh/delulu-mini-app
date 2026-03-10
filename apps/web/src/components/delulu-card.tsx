"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { FormattedDelulu } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { HeartIcon } from "lucide-react";
import { useGraphDelulu } from "@/hooks/graph/useGraphDelulu";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

function formatTimeLeft(target: Date) {
  const diffMs = target.getTime() - Date.now();
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
    label =
      remHours > 0
        ? `${days}d ${remHours}h`
        : `${days}d`;
  } else if (hours > 0) {
    const remMinutes = minutes % 60;
    label =
      remMinutes > 0
        ? `${hours}h ${remMinutes}m`
        : `${hours}h`;
  } else if (minutes > 0) {
    label = `${minutes}m`;
  } else {
    label = "<1m";
  }

  return { label, secondsLeft: totalSeconds };
}





interface DeluluCardProps {
  delusion: FormattedDelulu;
  onClick?: () => void;
  href?: string;
  onStake?: () => void;
  className?: string;
  isLast?: boolean;
}

export function DeluluCard({
  delusion,
  onClick,
  href,
  onStake,
  className = "",
  isLast = false,
}: DeluluCardProps) {
  const totalStake = delusion.totalBelieverStake + delusion.totalDoubterStake;
  // Prefer totalSupportCollected (v2 support-only markets). Fall back to legacy stake sum.
  const tvlValue = delusion.totalSupportCollected ?? totalStake;
  const creatorAddress = delusion.creator as `0x${string}`;
  const { username: contractUsername } = useUsernameByAddress(creatorAddress);
  const displayUsername = contractUsername || delusion.username || null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  const fallbackAvatarUrl = `${DEFAULT_AVATAR_BASE}${encodeURIComponent(
    creatorLabel
  )}`;
  const avatarUrl = delusion.pfpUrl || fallbackAvatarUrl;

  // Load real milestones for this delulu to drive the milestone preview
  const { milestones, isLoading: isMilestonesLoading } = useGraphDelulu(
    delusion.id
  );

  const { usd: gDollarUsdPrice } = useGoodDollarPrice();
  const isGoodDollar =
    delusion.tokenAddress?.toLowerCase() ===
    GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
  const approxUsdValue =
    isGoodDollar && gDollarUsdPrice && tvlValue > 0
      ? tvlValue * gDollarUsdPrice
      : delusion.tokenAddress &&
        delusion.tokenAddress.toLowerCase() !==
        GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()
        ? tvlValue // USDm or other stable-like token ~ 1:1
        : null;

  const isHash = (str: string) => {
    return str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str));
  };

  const headlineRaw = delusion.content && !isHash(delusion.content)
    ? delusion.content
    : "";
  const headline = headlineRaw.trim() || "YOUR DELULU HEADLINE";

  const tvl = tvlValue;
  const formattedTVL =
    tvl > 0 ? (tvl < 0.01 ? tvl.toFixed(4) : tvl.toFixed(2)) : "0.00";
  const formattedUsd =
    approxUsdValue && approxUsdValue > 0
      ? approxUsdValue < 0.01
        ? approxUsdValue.toFixed(4)
        : approxUsdValue.toFixed(2)
      : null;

  const { label: timeLeftLabel } = formatTimeLeft(
    delusion.resolutionDeadline
  );

  type MilestonePreviewStatus = "past" | "current" | "future";

  // Derive milestone preview from on-chain / subgraph data when available
  const previewMilestones = (() => {
    if (isMilestonesLoading || !milestones || milestones.length === 0) {
      return [] as {
        label: string;
        status: MilestonePreviewStatus;
        timeLeft?: string;
      }[];
    }

    // Sort milestones by milestoneId ascending
    const sorted = [...milestones].sort(
      (a, b) => Number(a.milestoneId) - Number(b.milestoneId)
    );

    // Find "current" milestone: first where isVerified is false
    const currentIndex = sorted.findIndex((m) => !m.isVerified);

    // Helper to build display label from milestoneURI with truncation
    const makeLabel = (m: (typeof sorted)[number]) => {
      const raw =
        (m.milestoneURI && m.milestoneURI.length > 0
          ? m.milestoneURI
          : `Milestone ${Number(m.milestoneId) + 1 || 1}`) || "";
      return raw.length > 50 ? `${raw.slice(0, 47)}…` : raw;
    };

    // No "current" (all verified): show up to last 3 as past
    if (currentIndex === -1) {
      const start = Math.max(0, sorted.length - 3);
      return sorted.slice(start).map((m) => ({
        label: makeLabel(m),
        status: "past" as MilestonePreviewStatus,
      }));
    }

    const indices: number[] = [];

    const nextIndex =
      currentIndex + 1 < sorted.length ? currentIndex + 1 : -1;

    if (currentIndex > 0) {
      // There is at least one past milestone:
      // Past = latest before current, Current = current, Future = next (if any)
      const pastIndex = currentIndex - 1;
      indices.push(pastIndex, currentIndex);
      if (nextIndex !== -1) {
        indices.push(nextIndex);
      }
    } else {
      // No completed milestone before current:
      // Show current + next two upcoming (if present)
      indices.push(currentIndex);
      if (nextIndex !== -1) indices.push(nextIndex);
      if (currentIndex + 2 < sorted.length) {
        indices.push(currentIndex + 2);
      }
    }

    const unique = Array.from(new Set(indices)).slice(0, 3);

    return unique.map((idx) => {
      const m = sorted[idx];
      let status: MilestonePreviewStatus;
      if (idx < currentIndex) {
        status = "past";
      } else if (idx === currentIndex) {
        status = "current";
      } else {
        status = "future";
      }

      let timeLeft: string | undefined;
      if (status === "current") {
        const { label, secondsLeft } = formatTimeLeft(m.deadline);
        timeLeft = secondsLeft > 0 ? label : undefined;
      }

      return {
        label: makeLabel(m),
        status,
        timeLeft,
      };
    });
  })();

  const completedCount =
    milestones && milestones.length > 0
      ? milestones.filter((m) => m.isVerified).length
      : 0;
  const totalCount = milestones && milestones.length > 0 ? milestones.length : 0;
  const successPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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




  const handleStake = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStake) {
      onStake();
    } else if (onClick) {
      onClick();
    }
  };

  // Apollo cache already stores data from list queries
  const handleMouseEnter = () => { };

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
        className="bg-secondary rounded-2xl border border-border/70 overflow-hidden transition-colors duration-200"
        style={href ? { cursor: "pointer" } : {}}
      >
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-dark flex-shrink-0 ring-2 ring-emerald/70 ring-offset-2 ring-offset-surface-elevated">
            <img
              src={avatarUrl}
              alt={displayUsername || formatAddress(delusion.creator)}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-semibold text-foreground truncate max-w-[120px]">
                {displayUsername ? displayUsername : formatAddress(delusion.creator)}
              </span>
              {displayUsername && (
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  @{displayUsername}
                </span>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {timeLeftLabel === "Ended"
                  ? "ended"
                  : `ends in ${timeLeftLabel}`}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {delusion.tokenAddress && (
                <TokenBadge tokenAddress={delusion.tokenAddress} size="sm" />
              )}
              {formattedUsd && (
                <span className="truncate">
                  ≈ ${formattedUsd} total support
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <p className="text-[15px] leading-snug text-foreground whitespace-pre-line font-semibold">
            {headline}
          </p>
        </div>

        <div className="px-4 pb-4 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="uppercase tracking-[0.12em] text-muted-foreground">
              Milestones
            </span>
            {totalCount > 0 && (
              <span>
                {completedCount}/{totalCount} completed ·{" "}
                <span className="font-semibold text-foreground">
                  {successPct}% success
                </span>
              </span>
            )}
          </div>
          {previewMilestones.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No milestones added yet
            </p>
          ) : (
            <div className="space-y-2">
              {previewMilestones.map((m) => {
                const base =
                  "flex items-center justify-between rounded-xl px-3.5 py-2.5 border-2 text-[12px]";
                const variant =
                  m.status === "current"
                    ? "bg-card text-foreground border-emerald shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                    : m.status === "past"
                      ? "bg-muted border-border/50 text-foreground opacity-50 line-through"
                      : "bg-muted/50 border-border/50 text-muted-foreground";

                return (
                  <div key={m.label} className={cn(base, variant)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          m.status === "current"
                            ? "bg-emerald"
                            : m.status === "past"
                              ? "bg-emerald"
                              : "bg-border"
                        )}
                      />
                      <span className="truncate">{m.label}</span>
                    </div>
                    <span className="text-[11px]">
                      {m.status === "past"
                        ? "Completed"
                        : m.status === "future"
                        ? "Coming Soon"
                        : (m as any).timeLeft ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border/40 bg-surface-dark/60 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">

            </span>
            {delusion.totalSupporters != null && (
              <span className="flex items-center gap-1">
                <span className="font-semibold text-surface-dark-foreground">
                  {delusion.totalSupporters}
                </span>
                <span className="text-muted-foreground">supporters</span>
              </span>
            )}
          </div>
          <button
            onClick={handleStake}
            className="support-pulse inline-flex items-center gap-1.5 rounded-full bg-delulu-yellow px-3.5 py-1.5 text-[11px] font-semibold text-delulu-charcoal shadow-[0_0_0_1px_rgba(0,0,0,0.85)] hover:shadow-[0_0_0_2px_rgba(0,0,0,0.95)] hover:brightness-105 hover:-translate-y-[0.5px] transition-all relative overflow-hidden"
          >
            <span className="relative z-[1] flex items-center gap-1.5">
              <HeartIcon className="w-4 h-4" />
            </span>
          </button>
        </div>
      </div>


    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          className,
          "block h-auto mb-4"
        )}
        prefetch={false}
        scroll={true}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        className,
        "block h-auto mb-4"
      )}
      onClick={onClick || undefined}
    >
      {cardContent}
    </div>
  );
}
