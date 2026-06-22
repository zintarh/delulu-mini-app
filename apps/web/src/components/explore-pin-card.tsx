"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormattedDelulu } from "@/lib/types";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import { cn, formatGAmount } from "@/lib/utils";
import {
  formatUsdEquivalent,
  getTokenSymbol,
} from "@/lib/token-amounts";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getPinCardAspectClassFromId } from "@/lib/pin-card-aspect";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDurationMs(ms: number): string {
  if (ms <= 0) return "";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (totalHours > 0) return `${totalHours}h`;
  const mins = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${mins}m`;
}

function isContentHash(str: string): boolean {
  return (
    str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str))
  );
}

function resolveHeadline(content: string | undefined): {
  text: string;
  pending: boolean;
} {
  const raw = content?.trim() ?? "";
  if (!raw || isContentHash(raw)) {
    return { text: "", pending: true };
  }
  return { text: raw, pending: false };
}

export interface ExplorePinCardProps {
  delusion: FormattedDelulu;
  href: string;
  className?: string;
  nowMs?: number;
  creatorPfpUrl?: string | null | undefined;
  imagePriority?: boolean;
}

export function ExplorePinCard({
  delusion,
  href,
  className,
  nowMs,
  creatorPfpUrl,
  imagePriority = false,
}: ExplorePinCardProps) {
  const router = useRouter();
  const legacyStakeTotal = delusion.totalBelieverStake + delusion.totalDoubterStake;
  const totalReceived = delusion.totalSupportCollected ?? 0;
  const fallbackReceived = (delusion.creatorStake ?? 0) + legacyStakeTotal;
  const tvlValue = totalReceived > 0 ? totalReceived : fallbackReceived;
  const tokenSymbol = getTokenSymbol(delusion.tokenAddress);
  const displayUsername = delusion.username ?? null;
  const creatorLabel = displayUsername
    ? `@${displayUsername}`
    : formatAddress(delusion.creator);
  const resolvedPfpUrl = creatorPfpUrl !== undefined ? creatorPfpUrl : (delusion.pfpUrl ?? null);

  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    if (typeof nowMs === "number") return;
    const id = setInterval(() => setLocalNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [nowMs]);
  const now = typeof nowMs === "number" ? nowMs : localNow;

  const { text: headline, pending: headlinePending } = resolveHeadline(
    delusion.content,
  );
  const { usd: gDollarUsdPrice } = useGoodDollarPrice();
  const formattedGAmount = formatGAmount(tvlValue);
  const supportUsdLabel = formatUsdEquivalent(
    tvlValue,
    delusion.tokenAddress,
    gDollarUsdPrice,
  );
  const supportersCount = delusion.totalSupporters ?? 0;

  const resolutionMs = delusion.resolutionDeadline.getTime();
  const isEnded = resolutionMs > 0 && resolutionMs <= now;
  const endedDurationLabel = useMemo(() => {
    if (!isEnded) return null;
    const startMs = delusion.createdAt?.getTime() ?? 0;
    if (startMs <= 0 || resolutionMs <= startMs) return null;
    return formatDurationMs(resolutionMs - startMs);
  }, [isEnded, delusion.createdAt, resolutionMs]);
  const coverImageSrc = normalizeDeluluImageSrc(delusion.bgImageUrl);
  const coverSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
  const coverLoadProps = imagePriority
    ? { priority: true as const }
    : { loading: "lazy" as const };

  const pinAspectClass = useMemo(
    () => getPinCardAspectClassFromId(delusion.onChainId, delusion.id),
    [delusion.onChainId, delusion.id],
  );

  const addrHex = delusion.creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(addrHex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  const cardGradient = `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;

  const handleWarm = () => {
    router.prefetch(href);
  };

  return (
    <article className={cn("group/pin mb-10 break-inside-avoid", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[20px] bg-muted",
          pinAspectClass,
        )}
        style={{ background: cardGradient }}
      >
        <Link
          href={href}
          onMouseEnter={handleWarm}
          onTouchStart={handleWarm}
          className="absolute inset-0 z-0 block"
          prefetch
          aria-label={
            headlinePending
              ? `Delulu by ${creatorLabel}`
              : `${headline} by ${creatorLabel}`
          }
        />

        {coverImageSrc ? (
          <Image
            src={coverImageSrc}
            alt=""
            fill
            sizes={coverSizes}
            className="object-cover transition-transform duration-500 ease-out group-hover/pin:scale-[1.03]"
            {...coverLoadProps}
            unoptimized={coverImageSrc.startsWith("data:")}
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/45" />

        {endedDurationLabel ? (
          <span className="pointer-events-none absolute left-3 top-3 z-[2] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-md">
            {endedDurationLabel}
          </span>
        ) : null}

        {tvlValue > 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[2] max-w-[calc(100%-1.5rem)]">
            <span className="inline-block rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tabular-nums text-delulu-charcoal shadow-sm backdrop-blur-sm">
              {supportUsdLabel
                ? `≈ $${supportUsdLabel}`
                : `${formattedGAmount} ${tokenSymbol}`}
            </span>
          </div>
        ) : null}
      </div>

      <div className="px-0.5 pt-2.5">
        <Link
          href={href}
          onMouseEnter={handleWarm}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-delulu-blue/40"
        >
          {headlinePending ? (
            <div className="space-y-1.5" aria-hidden>
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <h3
              className="line-clamp-2 text-base font-bold leading-snug tracking-tight text-foreground transition-colors group-hover/pin:text-delulu-charcoal/80 sm:text-lg"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              {headline}
            </h3>
          )}
        </Link>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-border/50">
            <UserAvatar
              address={delusion.creator}
              username={displayUsername}
              pfpUrl={resolvedPfpUrl}
              size={32}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground/90">
              {creatorLabel}
            </p>
            {supportersCount > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {supportersCount}{" "}
                {supportersCount === 1 ? "supporter" : "supporters"}
              </p>
            ) : tvlValue > 0 ? (
              <p className="truncate text-xs text-muted-foreground">
                {supportUsdLabel
                  ? `${formattedGAmount} ${tokenSymbol} tipped`
                  : "Be the first to tip"}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                New delulu
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
