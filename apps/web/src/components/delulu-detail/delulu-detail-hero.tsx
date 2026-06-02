"use client";

import { MoreHorizontal } from "lucide-react";
import { formatAddress, formatGAmount } from "@/lib/utils";
import { getTokenSymbol } from "@/lib/token-amounts";
import { TokenBadge } from "@/components/token-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { FormattedDelulu } from "@/lib/types";

function creatorGradient(creator: string) {
  const hex = creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;
}

export interface DeluluDetailHeroProps {
  delulu: FormattedDelulu;
  title: string;
  description?: string;
  bannerImage: string;
  supportAmount: number;
  supportersCount: number;
  totalSupportUsd?: number | null;
  resolutionEndsLine?: { prefix: string; value: string } | null;
  marketToken?: string;
  creatorPfpUrl?: string | null;
  isCreator?: boolean;
  isHidden?: boolean;
  showCreatorActions?: boolean;
  onToggleCreatorActions?: () => void;
  creatorActionsRef?: React.Ref<HTMLDivElement>;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function DeluluDetailHero({
  delulu,
  title,
  description,
  bannerImage,
  supportAmount,
  supportersCount,
  totalSupportUsd,
  resolutionEndsLine,
  marketToken,
  creatorPfpUrl,
  isCreator,
  isHidden,
  showCreatorActions,
  onToggleCreatorActions,
  creatorActionsRef,
  onEdit,
  onDelete,
}: DeluluDetailHeroProps) {
  const displayName = delulu.username
    ? `@${delulu.username}`
    : formatAddress(delulu.creator);
  const tokenSymbol = getTokenSymbol(marketToken);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div
        className="relative flex min-h-[200px] flex-col justify-end overflow-hidden sm:min-h-[240px] lg:min-h-[280px]"
        style={{ background: creatorGradient(delulu.creator) }}
      >
        <img
          src={bannerImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

        {resolutionEndsLine && (
          <div className="absolute right-3 top-3">
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {resolutionEndsLine.prefix} {resolutionEndsLine.value}
            </span>
          </div>
        )}

        <div className="relative px-4 pb-12 pt-8 sm:px-5">
          <h1
            className="text-2xl font-black leading-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-snug"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}
          >
            {title}
          </h1>
        </div>
      </div>

      <div className="relative px-4 pb-5 sm:px-5">
        <div className="-mt-8 mb-3 flex items-end justify-between gap-3">
          <div className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full border-[3px] border-card shadow-md">
            <UserAvatar
              address={delulu.creator}
              username={delulu.username}
              pfpUrl={creatorPfpUrl ?? delulu.pfpUrl ?? null}
              size={46}
            />
          </div>
          {isCreator && (
            <div ref={creatorActionsRef} className="relative shrink-0">
              <button
                type="button"
                onClick={onToggleCreatorActions}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-secondary"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showCreatorActions && (
                <div className="absolute right-0 top-11 z-40 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="w-full px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="w-full border-t border-border px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isHidden && isCreator && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
            Hidden from feed — only you can see this
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-foreground">{displayName}</span>
          {marketToken && <TokenBadge tokenAddress={marketToken} size="sm" />}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>
            <span className="font-black text-foreground">
              {formatGAmount(supportAmount)}
            </span>{" "}
            {tokenSymbol} staked
            {totalSupportUsd && totalSupportUsd > 0 && (
              <span className="text-muted-foreground">
                {" "}
                · ${totalSupportUsd.toFixed(2)}
              </span>
            )}
          </span>
          <span>
            {supportersCount}{" "}
            {supportersCount === 1 ? "supporter" : "supporters"}
          </span>
        </div>

        {description ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {description}
          </p>
        ) : null}
      </div>
    </article>
  );
}
