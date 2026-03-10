"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import {  Copy,  } from "lucide-react";
import { FormattedDelulu } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FARCASTER_MINIAPP_BASE_URL, GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { TokenBadge } from "@/components/token-badge";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";

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
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label = "";
  if (hours > 0) {
    label = `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  } else if (minutes > 0) {
    label = `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  } else {
    label = `${seconds}s`;
  }

  return { label, secondsLeft: totalSeconds };
}

function GlowBadge(props: {
  variant: "emerald" | "yellow";
  children: ReactNode;
}) {
  const { variant, children } = props;
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest";
  const colors =
    variant === "emerald"
      ? "bg-emerald bg-black text-white "
      : "bg-black text-delulu-yellow border border-delulu-yellow";
  return <span className={cn(base, colors)}>{children}</span>;
}



function MilestoneSteps({ current, total }: { current: number; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: safeTotal }).map((_, idx) => {
        const step = idx + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              isDone
                ? "bg-emerald"
                : isActive
                  ? "bg-delulu-yellow"
                  : "bg-surface-elevated"
            )}
          />
        );
      })}
    </div>
  );
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

  const displayPfpUrl = delusion.pfpUrl || null;
  const isHash = (str: string) => {
    return str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str));
  };

  const headlineRaw = delusion.content && !isHash(delusion.content)
    ? delusion.content
    : "";
  const headline = headlineRaw.trim() || "YOUR DELULU HEADLINE";
  const headlineLength = headline.length;

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

  const getShareUrl = () => {
    return `${FARCASTER_MINIAPP_BASE_URL}/delulu/${delusion.id}`;
  };

  const getShareText = () => {
    return `Check out this delulu: ${headline}`;
  };

  const shareLink = async (
    platform: "whatsapp" | "twitter" | "native"
  ) => {
    const url = getShareUrl();
    const text = getShareText();

    if (platform === "native" && navigator.share) {
      try {
        await navigator.share({
          title: headline,
          text: text,
          url: url,
        });
        return true;
      } catch (err) {
        // User cancelled or error
        return false;
      }
    }

    if (platform === "whatsapp") {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `${text} ${url}`
      )}`;
      window.open(whatsappUrl, "_blank");
      return true;
    }

    if (platform === "twitter") {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, "_blank");
      return true;
    }

    return false;
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(!showShareMenu);
  };

  const handleShareWhatsApp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(false);
    await shareLink("whatsapp");
  };

  const handleShareTwitter = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(false);
    await shareLink("twitter");
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
    setShowShareMenu(false);
  };

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
        className="bg-surface-elevated rounded-2xl border border-border/60 overflow-hidden transition-colors duration-200 hover:bg-surface-dark/80"
        style={href ? { cursor: "pointer" } : {}}
      >
        {/* Header: avatar, name, handle, time */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-dark flex-shrink-0">
            <img
              src={avatarUrl}
              alt={displayUsername || formatAddress(delusion.creator)}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-semibold text-surface-dark-foreground truncate max-w-[120px]">
                {displayUsername ? displayUsername : formatAddress(delusion.creator)}
              </span>
              {displayUsername && (
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  @{displayUsername}
                </span>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                ends in {timeLeftLabel}
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

        {/* Tweet-style text + image */}
        <div className="px-4 pb-3">
          <p className="text-[15px] leading-snug text-surface-dark-foreground whitespace-pre-line">
            {headline}
          </p>
          {delusion.bgImageUrl && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border/40 bg-black/40">
              <img
                src={delusion.bgImageUrl}
                alt={headline || ""}
                className="w-full max-h-[260px] object-cover"
              />
            </div>
          )}
        </div>

        {/* Static milestones strip (design preview) */}
        <div className="px-4 pb-3 space-y-1.5">
          {/* Success rate */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              Success rate:{" "}
              <span className="font-semibold text-surface-dark-foreground">
                72%
              </span>
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-dark overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald"
                style={{ width: "72%" }}
              />
            </div>
          </div>

          {/* Current + next milestones */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-surface-dark-foreground truncate">
                Current: Ship v3 mainnet
              </p>
              <p className="text-[11px] text-muted-foreground">
                tipping live · 2h left
              </p>
            </div>
            <div className="min-w-0 text-right opacity-60">
              <p className="text-[11px] font-medium text-muted-foreground truncate">
                Next: First 1,000 users
              </p>
              <p className="text-[10px] text-muted-foreground">
                starts after current
              </p>
            </div>
          </div>
        </div>

        {/* Footer: stats + subtle CTA */}
        <div className="flex items-center justify-between gap-4 border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-surface-dark-foreground">
                {formattedTVL}
              </span>
              <span className="text-muted-foreground">staked</span>
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
            className="inline-flex items-center gap-1.5 rounded-full border border-delulu-yellow/70 bg-delulu-yellow/10 px-3 py-1.5 text-[11px] font-semibold text-delulu-yellow-foreground hover:bg-delulu-yellow/20 hover:scale-[1.01] transition-all"
          >
            <span className="text-sm">♥</span>
            Support goal
          </button>
        </div>
      </div>

      {/* <div
        className="flex items-center justify-end pt-1"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={handleShareClick}
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
            aria-label="More options"
          >
            <span className="flex flex-col items-center justify-between h-3">
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              <span className="w-1 h-1 rounded-full bg-gray-500" />
            </span>
          </button>

          {showShareMenu && (
            <div className="absolute bottom-10 right-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 p-3 w-[240px]">
              <p className="text-xs font-medium text-gray-500 mb-3 text-center">
                Share
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Share to WhatsApp"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  <span className="text-[10px] font-medium text-delulu-charcoal">
                    WhatsApp
                  </span>
                </button>
                <button
                  onClick={handleShareTwitter}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Share to X"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#000000">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span className="text-[10px] font-medium text-delulu-charcoal">
                    X
                  </span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copy Link"
                >
                  <Copy className="w-5 h-5 text-gray-500" />
                  <span className="text-[10px] font-medium text-delulu-charcoal">
                    Copy Link
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div> */}
      {!isLast && <div className="border-b border-gray-200 mt-2" />}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          className,
          "block h-auto"
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
        "block h-auto"
      )}
      onClick={onClick || undefined}
    >
      {cardContent}
    </div>
  );
}
