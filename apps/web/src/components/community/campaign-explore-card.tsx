"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Clock, Sparkles, Trophy } from "lucide-react";
import { Stamp, Trophy as TrophyArt } from "@/components/ds";
import { cn } from "@/lib/utils";
import { isCampaignFunded, isCampaignExpired, getEffectiveDisplayEndsAt } from "@/lib/community/campaign-types";
import { AvatarStack, type AvatarStackParticipant } from "@/components/ui/avatar-stack";
import { compactStake, getForfeitTerms } from "@/lib/community/campaign-forfeit";
import { useImageAccent } from "@/hooks/use-image-accent";

export type ActiveMilestoneData = {
  milestone_id: number;
  label: string;
  deadline: string | null;
  start_time?: string | null;
  is_overdue?: boolean;
};

export type CampaignExploreCardData = {
  id: string;
  title: string;
  description?: string | null;
  proposedPoolAmount: number;
  durationDays: number;
  coverImageUrl: string | null;
  displayEndsAt: string | null;
  createdAt?: string | null;
  status: string;
  participantCount: number;
  participantAvatars?: AvatarStackParticipant[];
  milestoneCount: number;
  canJoin?: boolean;
  isOnChain?: boolean;
  isJoined: boolean;
  isFreeToJoin?: boolean;
  joinToken?: string;
  joinAmount?: number;
  forfeitPct?: number;
  proofInstructions?: string | null;
  proofCadence?: string;
  prizeWinnerCount?: number;
  telegramLink?: string | null;
  community: { name: string; slug: string } | null;
  activeMilestone?: ActiveMilestoneData | null;
};

function daysLeft(effectiveEndsAt: string | null) {
  if (!effectiveEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(effectiveEndsAt).getTime() - Date.now()) / 86400000));
}

export function CampaignExploreCard({
  campaign,
  className,
  compact = false,
}: {
  campaign: CampaignExploreCardData;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  joining?: boolean;
  /** @deprecated no longer rendered — join now happens on the campaign detail page */
  onJoin?: () => void;
  onSubmitMilestone?: () => void;
  proofBusy?: boolean;
  className?: string;
  /** Shorter home-rail cards so three fit in the viewport. */
  compact?: boolean;
}) {
  const href = `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
  const funded = isCampaignFunded(campaign.status);
  const effectiveEndsAt = getEffectiveDisplayEndsAt({
    display_ends_at: campaign.displayEndsAt,
    created_at: campaign.createdAt,
    duration_days: campaign.durationDays,
  });
  const isClosed = isCampaignExpired({
    display_ends_at: campaign.displayEndsAt,
    created_at: campaign.createdAt,
    duration_days: campaign.durationDays,
  });
  const poolAmount = campaign.proposedPoolAmount;
  const hasPool = funded && poolAmount > 0;
  const left = daysLeft(effectiveEndsAt);
  const stakeLabel =
    campaign.isFreeToJoin === false && (campaign.joinAmount ?? 0) > 0
      ? `Join · Stake ${(campaign.joinAmount ?? 0).toLocaleString("en-US")} ${campaign.joinToken ?? "G$"}`
      : "Join free";

  const endsLabel = isClosed
    ? "Ended"
    : left == null
      ? `${campaign.durationDays}d`
      : left === 0
        ? "Today"
        : `${left}d`;

  return (
    <Link
      href={href}
      className={cn(
        "press-edge group block overflow-hidden rounded-3xl border-2 border-line bg-white text-ink no-underline shadow-edge",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-blue-soft", compact ? "h-20" : "h-[120px]")}>
        {campaign.coverImageUrl ? (
          <Image
            src={campaign.coverImageUrl}
            alt=""
            fill
            className={cn("object-cover transition-transform duration-300 group-hover:scale-105", isClosed && "grayscale")}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-end pr-5">
            <TrophyArt size={compact ? 44 : 64} />
          </div>
        )}
        {campaign.isJoined ? (
          <span className="absolute left-3 top-3">
            <Stamp tone="kept" className="text-[10px]">
              <Check className="h-3 w-3" strokeWidth={3} />
              Joined
            </Stamp>
          </span>
        ) : null}
        {funded && poolAmount > 0 ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow px-2.5 py-1 text-[11px] font-extrabold text-ink shadow-[0_2px_0_#c99a0a]">
            <Trophy className="h-3 w-3" strokeWidth={2.6} />
            {poolAmount.toLocaleString()} G$ prize
          </span>
        ) : null}
      </div>

      <div className={cn(compact ? "p-3" : "p-4")}>
        {campaign.community?.name ? (
          <div className="label-mono truncate text-[10px] text-blue">{campaign.community.name}</div>
        ) : null}
        <h3 className={cn("mt-1 font-bold leading-snug", compact ? "line-clamp-1 text-[15px]" : "line-clamp-2 text-[19px]")}>
          {campaign.title}
        </h3>

        <div className={cn("grid gap-2", hasPool ? "grid-cols-3" : "grid-cols-2", compact ? "mt-2" : "mt-4")}>
          {hasPool ? (
            <div>
              <div className="font-display text-2xl font-extrabold leading-none">{poolAmount.toLocaleString()}</div>
              <div className="label-mono mt-1 text-[9px] text-muted-foreground">G$ pool</div>
            </div>
          ) : null}
          <div>
            <div className="flex items-center gap-1 font-display text-2xl font-extrabold leading-none">
              {campaign.participantAvatars && campaign.participantAvatars.length > 0 && !compact ? (
                <AvatarStack participants={campaign.participantAvatars} total={campaign.participantCount} size={18} />
              ) : (
                campaign.participantCount
              )}
            </div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">Joined</div>
          </div>
          <div>
            <div
              className={cn(
                "font-display text-2xl font-extrabold leading-none",
                !isClosed && left != null && left <= 3 && "text-orange",
              )}
            >
              {endsLabel}
            </div>
            <div className="label-mono mt-1 text-[9px] text-muted-foreground">{isClosed ? "Status" : "Left"}</div>
          </div>
        </div>

        {!isClosed && !compact ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="rounded-full bg-yellow-soft px-3 py-1 text-xs font-bold">{stakeLabel}</span>
            <span className="text-sm font-bold text-muted-foreground transition-colors group-hover:text-ink">View →</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function CampaignExploreCardSkeleton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative animate-pulse overflow-hidden rounded-3xl border-2 border-line bg-white",
        compact ? "h-[170px]" : "h-[300px]",
        className,
      )}
    >
      <div className="absolute right-3 top-3 h-6 w-16 rounded-full bg-background/60" />
      <div className={cn("absolute inset-x-0 bottom-0", compact ? "px-3 pb-3.5 pt-2.5 lg:p-3" : "p-4 sm:p-5")}>
        <div className="h-5 w-3/4 rounded-lg bg-background/60" />
        <div className="mt-2.5 h-4 w-1/2 rounded-lg bg-background/60" />
      </div>
    </div>
  );
}

function campaignTiming(campaign: CampaignExploreCardData) {
  const timing = {
    display_ends_at: campaign.displayEndsAt,
    created_at: campaign.createdAt,
    duration_days: campaign.durationDays,
  };
  const endsAt = getEffectiveDisplayEndsAt(timing);
  const closed = isCampaignExpired(timing);
  const left = daysLeft(endsAt);
  const elapsed =
    left == null || campaign.durationDays <= 0 ? 0 : 1 - Math.min(1, left / campaign.durationDays);
  return { closed, left, elapsed };
}

export function campaignHref(campaign: CampaignExploreCardData) {
  return `/communities/${campaign.community?.slug ?? ""}/campaigns/${campaign.id}`;
}

export function campaignDaysLeft(campaign: CampaignExploreCardData): number | null {
  const { closed, left } = campaignTiming(campaign);
  return closed ? null : left;
}

export function isCampaignOpen(campaign: CampaignExploreCardData): boolean {
  return !campaignTiming(campaign).closed;
}

function compactAmount(n: number) {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString("en-US");
}

/**
 * Grid for lists of CampaignPhotoCard (Explore, search): one column on phones,
 * two from tablet up, so cards stay the same size and density as on Home.
 */
export const CAMPAIGN_CARD_GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2";

/** Bold colour blocks for campaigns without a cover photo — picked per campaign so a row varies. */
const PHOTO_FALLBACK_TINTS = ["bg-yellow", "bg-[#f7c6d9]", "bg-[#bfe6cf]", "bg-[#fdf1c7]"];

function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PHOTO_FALLBACK_TINTS[Math.abs(h) % PHOTO_FALLBACK_TINTS.length];
}

/**
 * Home campaign card, styled like a fitness-app challenge: full-bleed cover,
 * big uppercase title, and a stat strip that leads with what it costs to join
 * and what a missed milestone costs (the campaign's own %). A time-left bar
 * runs along the bottom edge. No cover → a bold colour block with the trophy.
 */
export function CampaignPhotoCard({ campaign, className }: { campaign: CampaignExploreCardData; className?: string }) {
  const { closed, left, elapsed } = campaignTiming(campaign);
  const pool = isCampaignFunded(campaign.status) ? campaign.proposedPoolAmount : 0;
  const terms = getForfeitTerms(campaign);
  const stake = campaign.isFreeToJoin === false ? (campaign.joinAmount ?? 0) : 0;
  const token = campaign.joinToken ?? "G$";
  const hasImage = Boolean(campaign.coverImageUrl);
  const endsToday = !closed && left === 0;
  const when = closed ? "Ended" : endsToday ? "Ends today" : `${left ?? campaign.durationDays} days left`;
  const cadence = campaign.proofCadence === "weekly" ? "Weekly" : "Daily";
  const onDark = hasImage;

  const stats: { value: ReactNode; label: string; warn?: boolean }[] = [
    stake > 0
      ? { value: compactStake(stake), label: `${token} to join` }
      : { value: "Free", label: "To join" },
    terms
      ? { value: `${terms.pct}%`, label: "Lost per miss", warn: true }
      : { value: campaign.milestoneCount || "—", label: "Proofs" },
    {
      value:
        campaign.participantAvatars && campaign.participantAvatars.length > 0 ? (
          <AvatarStack participants={campaign.participantAvatars} total={campaign.participantCount} size={22} max={3} />
        ) : (
          campaign.participantCount
        ),
      label: "Joined",
    },
  ];

  return (
    <Link
      href={campaignHref(campaign)}
      className={cn(
        "press-edge group relative block aspect-[4/5] animate-rise overflow-hidden rounded-3xl border-2 border-line text-ink no-underline shadow-edge",
        hasImage ? "bg-ink" : tintFor(campaign.id),
        className,
      )}
    >
      {hasImage ? (
        <>
          <Image
            src={campaign.coverImageUrl!}
            alt=""
            fill
            sizes="(max-width: 640px) 80vw, 340px"
            className={cn("object-cover transition-transform duration-500 group-hover:scale-105", closed && "grayscale")}
            unoptimized
          />
          {/* Scrim so white text reads on any photo. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" aria-hidden />
        </>
      ) : (
        <span className="absolute -right-6 top-10 rotate-[8deg] opacity-90" aria-hidden>
          <TrophyArt size={170} />
        </span>
      )}

      {/* Tags */}
      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <span
          className={cn(
            "label-mono rounded-full px-2.5 py-1 text-[10px] font-semibold",
            onDark ? "bg-black/45 text-white backdrop-blur-sm" : "bg-white/80 text-ink",
          )}
        >
          {campaign.durationDays}-day · {cadence}
        </span>
        {campaign.isJoined ? (
          <Stamp tone="kept" className="bg-white text-[10px]">
            <Check className="h-3 w-3" strokeWidth={3} />
            Joined
          </Stamp>
        ) : pool > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow px-2.5 py-1 text-[11px] font-extrabold text-ink shadow-[0_2px_0_#c99a0a]">
            <Trophy className="h-3 w-3" strokeWidth={2.6} />
            {compactAmount(pool)} G$ prize
          </span>
        ) : null}
      </div>

      <div className={cn("absolute inset-x-4 bottom-5", onDark ? "text-white" : "text-ink")}>
        <h3
          className={cn(
            "m-0 line-clamp-2 font-display text-[30px] font-extrabold uppercase leading-[0.92] tracking-[-0.01em] [text-wrap:balance]",
            onDark && "[text-shadow:0_2px_12px_rgba(0,0,0,0.5)]",
          )}
        >
          {campaign.title}
        </h3>

        <div
          className={cn(
            "mt-4 grid grid-cols-3 divide-x border-t pt-3",
            onDark ? "divide-white/20 border-white/20" : "divide-ink/15 border-ink/15",
          )}
        >
          {stats.map((s, i) => (
            <div key={s.label} className={cn("min-w-0", i > 0 && "pl-3")}>
              <div
                className={cn(
                  "flex h-[26px] items-center truncate font-display text-[26px] font-extrabold uppercase leading-none tabular-nums",
                  s.warn && (onDark ? "text-[#ffb38a]" : "text-orange"),
                )}
              >
                {s.value}
              </div>
              <div className={cn("label-mono mt-1 truncate text-[9px]", onDark ? "text-white/70" : "text-ink/60")}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className={cn("label-mono mt-3 text-[10px]", endsToday ? (onDark ? "text-[#ffb38a]" : "text-orange") : onDark ? "text-white/75" : "text-ink/60")}>
          {when}
        </div>
      </div>

      {/* Time-left bar along the bottom edge */}
      <div className={cn("absolute inset-x-0 bottom-0 h-1.5", onDark ? "bg-white/15" : "bg-ink/10")} aria-hidden>
        <div
          className={cn("h-full", endsToday ? "bg-orange" : "bg-yellow")}
          style={{ width: `${Math.round((closed ? 1 : elapsed) * 100)}%` }}
        />
      </div>
    </Link>
  );
}

export function CampaignPhotoCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("aspect-[4/5] animate-pulse rounded-3xl border-2 border-line bg-white", className)} />;
}

/**
 * Explore card (design: challenge-app "Race" / "For good" cards): a wide,
 * full-bleed cover with a status chip on top, a white title with a faint
 * money line under it, then who's in ("You + 4 others" once you've joined).
 * The % lost per miss lives in the join modal, not here. No cover → a dark
 * ink panel with the trophy so it still reads as a campaign.
 */
export function CampaignBannerCard({ campaign, className }: { campaign: CampaignExploreCardData; className?: string }) {
  const { closed, left } = campaignTiming(campaign);
  const pool = isCampaignFunded(campaign.status) ? campaign.proposedPoolAmount : 0;
  const stake = campaign.isFreeToJoin === false ? (campaign.joinAmount ?? 0) : 0;
  const token = campaign.joinToken ?? "G$";
  const hasImage = Boolean(campaign.coverImageUrl);
  const accent = useImageAccent(campaign.coverImageUrl);
  // No milestones yet = set up but not running; the campaign page can't take joins until it has them.
  const startingSoon = !closed && campaign.milestoneCount === 0;
  const endsToday = !closed && !startingSoon && left === 0;
  const status = closed
    ? "Finished"
    : startingSoon
      ? "Starting soon"
      : endsToday
        ? "Ends today"
        : `Ends in ${left ?? campaign.durationDays} day${(left ?? campaign.durationDays) === 1 ? "" : "s"}`;
  // "Starting soon" keeps its yellow; every other status pill takes the photo's colour.
  const tint = startingSoon ? null : accent;
  const joined = campaign.participantCount;
  const avatars = campaign.participantAvatars ?? [];
  const others = Math.max(0, joined - (campaign.isJoined ? 1 : 0));
  const peopleLine = campaign.isJoined
    ? others > 0
      ? `You + ${others.toLocaleString()} other${others === 1 ? "" : "s"}`
      : "Just you so far"
    : `+${joined.toLocaleString()} ${joined === 1 ? "person" : "people"}`;

  return (
    <Link
      href={campaignHref(campaign)}
      className={cn(
        // min-h: chip + 2-line title + money line + people row must fit on a phone-width card.
        // min-w-0: aspect-ratio + min-h would otherwise force a 384px minimum width and spill
        // into the neighbouring grid column / past a narrow phone's swipe slot.
        "group relative block aspect-[16/11] min-h-[264px] min-w-0 animate-rise overflow-hidden rounded-[32px] text-white no-underline",
        "shadow-[0_14px_30px_-12px_rgba(22,22,21,0.45)] transition-transform active:scale-[0.98]",
        hasImage ? "bg-ink" : "bg-gradient-to-br from-ink-3 via-ink-2 to-ink",
        className,
      )}
    >
      {hasImage ? (
        <Image
          src={campaign.coverImageUrl!}
          alt=""
          fill
          sizes="(max-width: 640px) 90vw, 400px"
          className={cn("object-cover transition-transform duration-500 group-hover:scale-105", closed && "grayscale")}
          unoptimized
        />
      ) : (
        <span className="absolute -right-4 -top-2 rotate-[10deg] opacity-90" aria-hidden>
          <TrophyArt size={150} />
        </span>
      )}
      {/* Scrim: light at the top for the chip, strong at the bottom for the text. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/5" aria-hidden />

      <div className="absolute inset-x-5 top-5 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-colors duration-500",
            startingSoon ? "bg-yellow text-ink" : "bg-white text-ink",
            endsToday && !tint && "text-orange",
          )}
          // Tinted from the cover so each card's pill matches its photo (falls back to white).
          style={tint ? { backgroundColor: tint.bg, color: tint.fg } : undefined}
        >
          {startingSoon ? <Sparkles className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Clock className="h-3.5 w-3.5" strokeWidth={2.6} />}
          {status}
        </span>
        {pool > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow px-3 py-1.5 text-[12px] font-extrabold text-ink">
            <Trophy className="h-3.5 w-3.5" strokeWidth={2.6} />
            {compactAmount(pool)} G$ prize
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-5 bottom-5">
        <h3 className="m-0 line-clamp-2 text-[22px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.35)] [text-wrap:balance]">
          {campaign.title}
        </h3>
        <p className="m-0 mt-1 truncate text-[13px] font-medium text-white/70">
          {stake > 0 ? `${compactStake(stake)} ${token} to join this challenge` : "Free to join this challenge"}
        </p>

        {joined > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            {avatars.length > 0 ? (
              // total = shown, so the stack doesn't add its own "+N" bubble — the line below says it.
              <AvatarStack participants={avatars.slice(0, 3)} total={Math.min(3, avatars.length)} size={24} max={3} />
            ) : null}
            <span className="truncate text-[13px] font-bold text-white">{peopleLine}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function CampaignBannerCardSkeleton({ className }: { className?: string }) {
  return <div className={cn("aspect-[16/11] min-h-[264px] animate-pulse rounded-[32px] bg-ink/10", className)} />;
}
