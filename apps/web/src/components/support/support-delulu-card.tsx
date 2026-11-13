"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Coin, Flame, ProgressBar } from "@/components/ds";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { goalIconFor } from "@/components/goal-icon";
import { compactCount } from "@/lib/rewards/public-stats";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/rules";
import { CATEGORY_THEME } from "@/lib/support/category-theme";
import type { PublicDeluluDto, PublicProfile } from "@/lib/support/server";
import { cn } from "@/lib/utils";

export function durationLabel(d: Pick<PublicDeluluDto, "cadence" | "progress">): string {
  if (d.cadence === "once") return "One-off";
  const unit = d.cadence === "weekly" ? "week" : "day";
  return `${d.progress.total} ${unit}${d.progress.total === 1 ? "" : "s"}`;
}

export function creatorName(d: Pick<PublicDeluluDto, "creator">): string {
  return d.creator.username ? `@${d.creator.username}` : "A Delulu dreamer";
}

export function facesToStack(faces: PublicProfile[]) {
  return faces.map((f, i) => ({ address: `face-${i}-${f.username ?? ""}`, username: f.username, pfpUrl: f.pfpUrl }));
}

/** "Be first" / streak badge in the card's colour band. */
function Badge({ d }: { d: PublicDeluluDto }) {
  if (d.support.supporters === 0 && !d.isOwn) {
    return (
      <span className="label-mono animate-bounce-in rounded-full bg-pink-bright px-2.5 py-1 text-[9px] text-white shadow-[0_2px_0_#c23e6e]">
        Be first
      </span>
    );
  }
  if (d.progress.streak >= 2) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[12px] font-extrabold shadow-edge-sm">
        <Flame size={16} /> {d.progress.streak}
      </span>
    );
  }
  return null;
}

/**
 * Discovery card: colour band by category with the goal's icon, creator
 * avatar overlapping it, progress, who's backing it, and a heart that opens
 * the support picker.
 */
export function SupportDeluluCard({
  delulu: d,
  onSupport,
  compact = false,
}: {
  delulu: PublicDeluluDto;
  onSupport: (_d: PublicDeluluDto, _amount?: number) => void;
  compact?: boolean;
}) {
  const Icon = goalIconFor(d.title);
  const theme = CATEGORY_THEME[d.category ?? "none"];
  const pct = d.progress.total ? d.progress.kept / d.progress.total : 0;
  const dark = d.category === "productivity";

  return (
    <div
      className={cn(
        "relative flex animate-rise flex-col overflow-hidden rounded-[24px] border-2 border-line bg-white shadow-edge transition-transform hover:-translate-y-0.5",
        compact && "w-[248px] shrink-0 snap-start",
      )}
    >
      <Link href={`/support/${d.id}`} className="absolute inset-0 z-0" aria-label={d.title} />

      {/* Colour band */}
      <div className={cn("pointer-events-none relative", compact ? "h-[64px]" : "h-[78px]", theme.band)}>
        <Icon
          className={cn("absolute -right-3 -top-3 h-[104px] w-[104px] rotate-[-12deg] opacity-25", theme.icon)}
          strokeWidth={2}
          aria-hidden
        />
        <Icon className={cn("absolute right-4 top-1/2 h-9 w-9 -translate-y-1/2", theme.icon)} strokeWidth={2.4} aria-hidden />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          {d.category ? (
            <span
              className={cn(
                "label-mono rounded-full px-2.5 py-1 text-[9px]",
                dark ? "bg-white/15 text-white" : "bg-white/80 text-ink",
              )}
            >
              {SUPPORT_CATEGORY_LABELS[d.category]}
            </span>
          ) : null}
          <Badge d={d} />
        </div>
      </div>

      {/* Creator, overlapping the band */}
      <div className="pointer-events-none relative -mt-6 flex items-end gap-2 px-4">
        <UserAvatar
          address="0x0000"
          username={d.creator.username}
          pfpUrl={d.creator.pfpUrl}
          size={48}
          className="ring-4 ring-white"
        />
        <span className="mb-1 min-w-0 flex-1 truncate text-[13px] font-bold">{creatorName(d)}</span>
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col px-4 pb-4 pt-2">
        <h3 className="m-0 line-clamp-2 text-[17px] font-extrabold leading-tight">{d.title}</h3>
        {d.description && !compact ? (
          <p className="m-0 mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{d.description}</p>
        ) : null}

        <div className="mt-3">
          <div className="label-mono mb-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>{durationLabel(d)}</span>
            <span className="tabular-nums">
              {d.progress.kept}/{d.progress.total} kept
            </span>
          </div>
          <ProgressBar value={pct} thin />
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3.5">
          {d.support.faces.length > 0 ? (
            <AvatarStack participants={facesToStack(d.support.faces)} total={d.support.supporters} max={3} size={22} />
          ) : null}
          <span className="flex min-w-0 flex-1 items-center gap-0.5 text-[13px] font-extrabold tabular-nums">
            <Coin size={16} />
            {compactCount(d.support.totalG)}
            <span className="ml-1 truncate font-semibold text-muted-foreground">
              {d.support.supporters === 0 ? "· no backers yet" : "raised"}
            </span>
          </span>
          {d.isOwn ? (
            <span className="label-mono shrink-0 rounded-full bg-yellow-soft px-3 py-1.5 text-[10px] text-ink">Yours</span>
          ) : (
            <button
              type="button"
              disabled={!d.accepting}
              onClick={() => onSupport(d)}
              aria-label={`Support ${d.title}`}
              className="pointer-events-auto relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-bright text-white shadow-[0_3px_0_#c23e6e] transition active:translate-y-[2px] active:shadow-[0_1px_0_#c23e6e] disabled:opacity-40"
            >
              <Heart className="h-5 w-5" fill="currentColor" strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupportCardSkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={cn("h-[300px] animate-pulse rounded-[24px] bg-line/70", compact && "w-[248px] shrink-0")} />;
}
