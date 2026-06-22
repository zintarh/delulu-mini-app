"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommunityCampaignMilestoneRow } from "@/lib/community/campaign-subgraph";

function formatCountdown(deadline: string) {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.ceil(ms / 3600000);
  return `${hours}h left`;
}

export type CampaignHorizontalCardProps = {
  href: string;
  title: string;
  subtitle: string;
  coverImageUrl?: string | null;
  thumbnailSize?: "sm" | "md" | "lg";
  size?: "default" | "comfortable";
  meta?: React.ReactNode;
  milestones?: CommunityCampaignMilestoneRow[];
  progress?: { completed: number; total: number };
  action?: React.ReactNode;
  className?: string;
};

const THUMB_SIZE_CLASS = {
  sm: "h-12 w-12 rounded-xl",
  md: "h-14 w-14 rounded-xl",
  lg: "h-16 w-16 rounded-2xl",
} as const;

export function CampaignHorizontalCard({
  href,
  title,
  subtitle,
  coverImageUrl,
  thumbnailSize = "sm",
  size = "default",
  meta,
  milestones,
  progress,
  action,
  className,
}: CampaignHorizontalCardProps) {
  const comfortable = size === "comfortable";
  const thumbClass = THUMB_SIZE_CLASS[thumbnailSize];

  return (
    <div
      className={cn(
        "flex items-center rounded-2xl border border-border/60 bg-card shadow-sm",
        comfortable ? "gap-3 p-4 sm:gap-4" : "gap-3 p-3",
        action ? "items-start" : "items-center",
        className,
      )}
    >
      <Link href={href} className="shrink-0">
        {coverImageUrl ? (
          <div className={cn("relative overflow-hidden", thumbClass)}>
            <Image src={coverImageUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <span
            className={cn(
              "flex items-center justify-center bg-delulu-blue-light text-delulu-blue",
              thumbClass,
            )}
          >
            <Target className={cn(comfortable ? "h-5 w-5" : "h-4 w-4")} />
          </span>
        )}
      </Link>

      <Link href={href} className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-1 font-bold leading-snug text-foreground",
            comfortable ? "text-base" : "text-sm",
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "mt-0.5 text-muted-foreground",
            comfortable ? "text-xs" : "text-[11px]",
          )}
        >
          {subtitle}
        </p>
        {meta}
        {progress && progress.total > 0 ? (
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {progress.completed}/{progress.total} milestones
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-delulu-blue transition-all"
                style={{
                  width: `${Math.round((progress.completed / progress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        {milestones && milestones.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {milestones.map((m) => (
              <li
                key={m.milestone_id}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-foreground">{m.label}</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    m.is_overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {formatCountdown(m.deadline)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Link>

      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </div>
  );
}

export function CampaignPoolMeta({
  amount,
  funded,
  comfortable = false,
}: {
  amount: number;
  funded: boolean;
  comfortable?: boolean;
}) {
  const textClass = comfortable ? "text-xs" : "text-[11px]";

  if (funded && amount > 0) {
    return (
      <p
        className={cn(
          "mt-1 flex items-center gap-1 font-semibold text-delulu-blue",
          textClass,
        )}
      >
        <Trophy className={comfortable ? "h-3.5 w-3.5" : "h-3 w-3"} />
        {amount} G$ prize pool
      </p>
    );
  }

  if (amount > 0) {
    return (
      <p className={cn("mt-1 text-muted-foreground", textClass)}>
        {amount} G$ proposed · <span className="font-medium text-foreground/80">not funded</span>
      </p>
    );
  }

  return (
    <p className={cn("mt-1 font-medium text-muted-foreground", textClass)}>
      Not funded
    </p>
  );
}

export function CampaignActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  href,
  fullWidth = false,
  size = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "muted";
  href?: string;
  fullWidth?: boolean;
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  const className = cn(
    "shrink-0 font-bold transition-opacity",
    fullWidth
      ? "w-full px-4 py-3 text-sm"
      : compact
        ? "w-fit max-w-[4.25rem] rounded-full px-2 py-1 text-[10px] leading-tight sm:max-w-none sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
        : "w-fit rounded-xl px-4 py-2.5 text-sm",
    variant === "primary"
      ? "bg-delulu-blue text-white hover:opacity-90 disabled:opacity-50"
      : "border border-border bg-muted/50 text-muted-foreground hover:bg-muted",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {disabled && children === "Join" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

export function CampaignHorizontalCardSkeleton({
  className,
  comfortable = false,
}: {
  className?: string;
  comfortable?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex animate-pulse items-center rounded-2xl border border-border/60 bg-card",
        comfortable ? "gap-4 p-4" : "gap-3 p-3",
        className,
      )}
    >
      <div
        className={cn(
          "shrink-0 rounded-2xl bg-muted",
          comfortable ? "h-16 w-16" : "h-12 w-12 rounded-xl",
        )}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className={cn("w-3/4 rounded bg-muted", comfortable ? "h-4" : "h-3.5")} />
        <div className={cn("w-1/2 rounded bg-muted/80", comfortable ? "h-3" : "h-2.5")} />
        <div className="h-1.5 w-full rounded-full bg-muted/70" />
      </div>
      <div
        className={cn(
          "shrink-0 rounded-xl bg-muted",
          comfortable ? "h-10 w-24" : "h-7 w-16 rounded-lg",
        )}
      />
    </div>
  );
}

export function CampaignSectionSkeleton({
  rows = 2,
  comfortable = true,
}: {
  rows?: number;
  comfortable?: boolean;
}) {
  return (
    <div className="space-y-3 px-4 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <CampaignHorizontalCardSkeleton key={i} comfortable={comfortable} />
      ))}
    </div>
  );
}
