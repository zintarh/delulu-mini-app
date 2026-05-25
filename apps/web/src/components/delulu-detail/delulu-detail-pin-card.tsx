"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Maximize2,
} from "lucide-react";
import { cn, formatAddress, formatGAmount } from "@/lib/utils";
import { TokenBadge } from "@/components/token-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DELULU_SOCIAL_UPDATED_EVENT,
  notifyDeluluSocialUpdated,
} from "@/lib/delulu-social-storage";
import type { FormattedDelulu } from "@/lib/types";
import { KNOWN_TOKEN_SYMBOLS } from "@/lib/constant";

function creatorGradient(creator: string) {
  const hex = creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(140deg, hsl(${h1},50%,20%) 0%, hsl(${h2},55%,12%) 100%)`;
}

function DeluluTippedSummary({
  supportAmount,
  totalSupportUsd,
  marketToken,
}: {
  supportAmount: number;
  totalSupportUsd?: number | null;
  marketToken?: string;
}) {
  const tokenLabel = marketToken
    ? (KNOWN_TOKEN_SYMBOLS[marketToken.toLowerCase()] ?? "G$")
    : "G$";

  return (
    <div className="mt-4 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold text-muted-foreground">
        Tipped so far
      </span>
      <span className="text-right text-sm font-black tabular-nums text-foreground">
        {formatGAmount(supportAmount)}{" "}
        <span className="text-xs font-semibold text-muted-foreground">
          {tokenLabel}
        </span>
        {totalSupportUsd && totalSupportUsd > 0 ? (
          <span className="ml-1 text-xs font-semibold text-muted-foreground">
            · ${totalSupportUsd.toFixed(2)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export interface DeluluDetailPinCardProps {
  delulu: FormattedDelulu;
  title: string;
  description?: string;
  bannerImage: string;
  supportAmount: number;
  supportersCount: number;
  totalSupportUsd?: number | null;
  marketToken?: string;
  creatorPfpUrl?: string | null;
  isCreator?: boolean;
  isHidden?: boolean;
  showCreatorActions?: boolean;
  onToggleCreatorActions?: () => void;
  creatorActionsRef?: React.Ref<HTMLDivElement>;
  onEdit?: () => void;
  onDelete?: () => void;
  shareSlot: React.ReactNode;
  showTip?: boolean;
  tipDisabled?: boolean;
  onTip?: () => void;
  onRequireAuth: () => void;
  userAddress?: string | null;
  username?: string | null;
  onCommentCountChange?: (count: number) => void;
}

export function DeluluDetailPinCard({
  delulu,
  title,
  description,
  bannerImage,
  supportAmount,
  supportersCount,
  totalSupportUsd,
  marketToken,
  creatorPfpUrl,
  isCreator,
  isHidden,
  showCreatorActions,
  onToggleCreatorActions,
  creatorActionsRef,
  onEdit,
  onDelete,
  shareSlot,
  showTip = true,
  tipDisabled = false,
  onTip,
  onRequireAuth,
  userAddress,
  username,
  onCommentCountChange,
}: DeluluDetailPinCardProps) {
  const [commentCount, setCommentCount] = useState(0);

  const refreshCommentCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/${delulu.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setCommentCount((data.comments ?? []).length);
      }
    } catch {
      // keep
    }
  }, [delulu.id]);

  useEffect(() => {
    void refreshCommentCount();
  }, [refreshCommentCount]);

  useEffect(() => {
    onCommentCountChange?.(commentCount);
  }, [commentCount, onCommentCountChange]);

  const handleTipClick = () => {
    if (tipDisabled) return;
    if (!userAddress) {
      onRequireAuth();
      return;
    }
    onTip?.();
  };
  const displayName = delulu.username
    ? delulu.username
    : formatAddress(delulu.creator);

  const userKey = userAddress?.toLowerCase() ?? null;
  const [hearts, setHearts] = useState(0);
  const [userReacted, setUserReacted] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const params = userKey ? `?userAddress=${encodeURIComponent(userKey)}` : "";
        const res = await fetch(`/api/social/${delulu.id}/likes${params}`);
        if (res.ok) {
          const data = await res.json();
          setHearts(data.count ?? 0);
          setUserReacted(data.userReacted ?? false);
        }
      } catch {
        // keep defaults
      }
    };
    void fetchLikes();
  }, [delulu.id, userKey]);

  useEffect(() => {
    const onSocial = (e: Event) => {
      const detail = (e as CustomEvent<{ deluluId?: number }>).detail;
      if (detail?.deluluId != null && detail.deluluId !== delulu.id) return;
      void refreshCommentCount();
      const fetchLikes = async () => {
        try {
          const params = userKey ? `?userAddress=${encodeURIComponent(userKey)}` : "";
          const res = await fetch(`/api/social/${delulu.id}/likes${params}`);
          if (res.ok) {
            const data = await res.json();
            setHearts(data.count ?? 0);
            setUserReacted(data.userReacted ?? false);
          }
        } catch {
          // keep
        }
      };
      void fetchLikes();
    };
    window.addEventListener(DELULU_SOCIAL_UPDATED_EVENT, onSocial);
    return () => window.removeEventListener(DELULU_SOCIAL_UPDATED_EVENT, onSocial);
  }, [delulu.id, userKey, refreshCommentCount]);

  const handleHeart = async () => {
    if (!userKey) {
      onRequireAuth();
      return;
    }
    try {
      const res = await fetch(`/api/social/${delulu.id}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: userKey }),
      });
      if (res.ok) {
        const data = await res.json();
        setHearts(data.count ?? 0);
        setUserReacted(data.userReacted ?? false);
        notifyDeluluSocialUpdated(delulu.id);
      }
    } catch {
      // keep
    }
  };

  const descLong = (description?.length ?? 0) > 220;
  const descPreview =
    descLong && !descExpanded
      ? `${description!.slice(0, 220)}…`
      : description;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col lg:min-h-[280px] lg:h-[min(38vh,340px)] lg:flex-row">
        {/* Media — narrower so the details column has more room */}
        <div
          className="relative min-h-[110px] w-full shrink-0 sm:min-h-[130px] lg:min-h-0 lg:w-[38%] xl:w-[36%]"
          style={{ background: creatorGradient(delulu.creator) }}
        >
          <img
            src={bannerImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

          <div className="absolute bottom-3 right-3 flex gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
              aria-label="Expand image"
              onClick={() => window.open(bannerImage, "_blank")}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content — reactions, tip, description */}
        <div className="flex min-w-0 flex-1 flex-col lg:w-[62%] xl:w-[64%]">
          <div className="flex flex-col gap-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleHeart()}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    userReacted
                      ? "text-red-500"
                      : "text-foreground hover:bg-secondary",
                  )}
                  aria-label={userReacted ? "Unlike" : "Like"}
                >
                  <Heart
                    className={cn("h-6 w-6", userReacted && "fill-current")}
                  />
                </button>
                {hearts > 0 && (
                  <span className="mr-0.5 text-sm font-bold tabular-nums text-foreground">
                    {hearts}
                  </span>
                )}

                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-secondary"
                  aria-label="Comments"
                  onClick={() => {
                    document
                      .getElementById("delulu-comments-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setTimeout(() => {
                      document.getElementById("delulu-comments-input")?.focus();
                    }, 400);
                  }}
                >
                  <MessageCircle className="h-6 w-6" />
                </button>
                {commentCount > 0 && (
                  <span className="mr-0.5 text-sm font-bold tabular-nums text-foreground">
                    {commentCount}
                  </span>
                )}

                {shareSlot}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {showTip ? (
                  <button
                    type="button"
                    onClick={handleTipClick}
                    disabled={tipDisabled}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-full px-4 text-sm font-black transition-all",
                      "bg-gradient-to-b from-[#f7f9a6] to-[#e8ec79] text-[#1b1b1b]",
                      "border border-[#d5da6f] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
                      "hover:brightness-105 active:scale-[0.98]",
                      tipDisabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    Tip
                  </button>
                ) : null}
                {isCreator && (
                  <div ref={creatorActionsRef} className="relative">
                    <button
                      type="button"
                      onClick={onToggleCreatorActions}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {showCreatorActions && (
                      <div className="absolute right-0 top-11 z-40 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                        <button
                          type="button"
                          onClick={onEdit}
                          className="w-full px-3 py-2.5 text-left text-sm font-semibold hover:bg-secondary"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={onDelete}
                          className="w-full border-t border-border px-3 py-2.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <UserAvatar
                address={delulu.creator}
                username={delulu.username}
                pfpUrl={creatorPfpUrl ?? delulu.pfpUrl ?? null}
                size={36}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {displayName}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    <span className="font-black text-foreground">
                      {formatGAmount(supportAmount)}
                    </span>{" "}
                    staked
                    {totalSupportUsd && totalSupportUsd > 0
                      ? ` · $${totalSupportUsd.toFixed(2)}`
                      : null}
                  </span>
                  <span>·</span>
                  <span>
                    {supportersCount}{" "}
                    {supportersCount === 1 ? "supporter" : "supporters"}
                  </span>
                  {marketToken ? (
                    <>
                      <span>·</span>
                      <TokenBadge tokenAddress={marketToken} size="sm" />
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {isHidden && isCreator ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700">
                Hidden from feed — only you can see this
              </p>
            ) : null}

            <div>
              <h1 className="text-lg font-black leading-snug text-foreground sm:text-xl">
                {title}
              </h1>
              {description ? (
                <div className="mt-2">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {descPreview}
                  </p>
                  {descLong ? (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((v) => !v)}
                      className="mt-1 text-sm font-semibold text-foreground hover:underline"
                    >
                      {descExpanded ? "See less" : "See more"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <DeluluTippedSummary
                supportAmount={supportAmount}
                totalSupportUsd={totalSupportUsd}
                marketToken={marketToken}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
