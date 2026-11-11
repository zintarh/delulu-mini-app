"use client";

import { CheckCircle2, Clock, RotateCw } from "lucide-react";
import {
  CheckDot,
  Flame,
  GameButton,
  GameCard,
  ProgressBar,
  Trophy,
} from "@/components/ds";
import type { RewardsSummary } from "@/hooks/use-rewards-summary";
import type { CompletionProgress } from "@/lib/rewards/summary";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const compactG = (n: number) =>
  n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : fmt(n);

function dayLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Small status pill for anything not yet paid. */
export function RewardStatusPill({
  status,
}: {
  status: "pending" | "failed" | "confirmed";
}) {
  if (status === "confirmed") return null;
  const pending = status === "pending";
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[9px]",
        pending ? "bg-yellow-soft text-ink" : "bg-orange-soft text-orange",
      )}
    >
      {pending ? (
        <Clock className="h-2.5 w-2.5" strokeWidth={2.6} />
      ) : (
        <RotateCw className="h-2.5 w-2.5" strokeWidth={2.6} />
      )}
      {pending ? "Pending" : "Retrying"}
    </span>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-line", className)} />;
}

/** Overview: G$ actually paid (confirmed on-chain), by category, plus what's still on its way. */
export function RewardsEarnedCard({
  summary,
  isLoading,
  error,
  onRetry,
}: {
  summary: RewardsSummary | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!summary) {
    return (
      <GameCard className="animate-rise p-4">
        {isLoading || !error ? (
          <div className="space-y-3">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-8 w-32" />
            <div className="grid grid-cols-3 gap-2">
              <SkeletonLine className="h-12" />
              <SkeletonLine className="h-12" />
              <SkeletonLine className="h-12" />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm text-muted-foreground">
              Couldn&apos;t load your rewards.
            </p>
            <GameButton variant="line" size="sm" onClick={onRetry}>
              Retry
            </GameButton>
          </div>
        )}
      </GameCard>
    );
  }

  const { totals } = summary;
  const tiles = [
    { label: "Proofs", value: totals.byCategory.daily_proof },
    { label: "Weekly", value: totals.byCategory.weekly_consistency },
    {
      label: "Completions",
      value:
        totals.byCategory.campaign_completion +
        totals.byCategory.goal_completion,
    },
  ];

  return (
    <GameCard className="animate-rise p-4">
      <span className="label-mono text-[10px] text-muted-foreground">
        Earned from Delulu
      </span>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-[32px] font-extrabold uppercase leading-none tabular-nums">
          {fmt(totals.earned)} G$
        </span>
        {totals.pending > 0 ? (
          <span className="label-mono inline-flex items-center gap-1 text-[10px] text-ink/70">
            <Clock className="h-3 w-3" strokeWidth={2.4} />+
            {fmt(totals.pending)} on the way
          </span>
        ) : null}
        {totals.failed > 0 ? (
          <span className="label-mono inline-flex items-center gap-1 text-[10px] text-orange">
            <RotateCw className="h-3 w-3" strokeWidth={2.4} />
            {fmt(totals.failed)} retrying
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[14px] border-2 border-line px-2.5 py-2"
          >
            <div className="truncate font-bold tabular-nums">
              {fmt(t.value)}
            </div>
            <div className="label-mono mt-0.5 truncate text-[9px] text-muted-foreground">
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </GameCard>
  );
}

function Row({
  art,
  title,
  amount,
  children,
}: {
  art: React.ReactNode;
  title: string;
  amount: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        {art}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold">{title}</span>
          <span className="label-mono shrink-0 text-[12px] font-semibold text-green-edge">
            {amount}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function CompletionRow({ p }: { p: CompletionProgress }) {
  const value = p.needed > 0 ? p.done / p.needed : 0;
  const reduced = !p.reward && p.amount < p.fullAmount;
  const right =
    p.state === "rewarded" && p.reward ? (
      p.reward.status === "confirmed" ? (
        <span className="inline-flex items-center gap-1 text-green-edge">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2.6} />+
          {fmt(p.reward.amount)}
        </span>
      ) : (
        <RewardStatusPill status={p.reward.status} />
      )
    ) : p.state === "missed" ? (
      <span className="text-muted-foreground">Missed</span>
    ) : p.state === "completed" ? (
      <span className="text-ink/70">Checking</span>
    ) : (
      <span className="text-green-edge">
        {reduced ? `up to ${fmt(p.amount)}` : `+${fmt(p.amount)}`}
      </span>
    );
  return (
    <div className="mt-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold">
          {p.title}
        </span>
        <span className="label-mono shrink-0 text-[10px]">{right}</span>
      </div>
      <ProgressBar
        thin
        className="mt-1.5"
        value={value}
        tone={
          p.state === "missed"
            ? "grey"
            : p.state === "on_track"
              ? "yellow"
              : "green"
        }
        label={`${p.title} progress`}
      />
      <div className="label-mono mt-1 text-[9px] text-muted-foreground">
        {p.done} of {p.needed} {p.unit}
      </div>
    </div>
  );
}

/** Breakdown: how each category pays (amounts from the backend config) and the user's real progress. */
export function RewardsHowYouEarnCard({
  summary,
}: {
  summary: RewardsSummary | null;
}) {
  if (!summary || !summary.config.enabled) return null;
  const { config, daily, weekly, completions, totals, unavailable } = summary;
  // Admins can switch categories off; never advertise a reward that won't be paid.
  const on = config.categoryEnabled ?? {
    daily_proof: true,
    weekly_consistency: true,
    campaign_completion: true,
    goal_completion: true,
  };
  const completionOn = on.campaign_completion || on.goal_completion;
  if (!on.daily_proof && !on.weekly_consistency && !completionOn) return null;
  const weeklyReward = weekly.reward;
  const tiers = [...config.campaignTiers].sort((a, b) => a.minDays - b.minDays);
  const daysToMonday =
    Math.round(
      (new Date(`${weekly.weekEnd}T00:00:00Z`).getTime() -
        new Date(`${daily.today}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;

  return (
    <GameCard className="animate-rise p-4">
      <span className="label-mono text-[10px] text-muted-foreground">
        How you earn
      </span>
      <div className="mt-3 divide-y divide-dashed divide-line">
        {on.daily_proof ? (
          <Row
            art={<CheckDot size={30} />}
            title="Approved proof"
            amount={`+${fmt(config.dailyAmount)} G$`}
          >
            <div className="label-mono mt-1 text-[10px] text-muted-foreground">
              Today {Math.min(daily.earnedToday, config.maxEligibleGoals)}/
              {config.maxEligibleGoals} · {fmt(totals.byCategory.daily_proof)}{" "}
              G$ so far
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {daily.goals.map((g) => (
                <span
                  key={`${g.kind}:${g.ref}`}
                  className="max-w-full truncate rounded-full border-2 border-line px-2 py-[1px] text-[11px] font-semibold"
                >
                  {g.title ?? (g.kind === "campaign" ? "Campaign" : "Goal")}
                </span>
              ))}
              {Array.from({
                length: Math.max(
                  0,
                  config.maxEligibleGoals - daily.goals.length,
                ),
              }).map((_, i) => {
                const cooling = [...daily.coolingUntil].sort()[i];
                return (
                  <span
                    key={`free-${i}`}
                    className="rounded-full border-2 border-dashed border-line px-2 py-[1px] text-[11px] text-muted-foreground"
                  >
                    {cooling ? `Opens ${dayLabel(cooling)}` : "Open slot"}
                  </span>
                );
              })}
            </div>
          </Row>
        ) : null}

        {on.weekly_consistency ? (
          <Row
            art={<Flame size={30} />}
            title="Weekly streak"
            amount={`+${fmt(config.weeklyAmount)} G$`}
          >
            {weeklyReward ? (
              <div className="label-mono mt-1 flex items-center gap-1.5 text-[10px] text-green-edge">
                {weeklyReward.status === "confirmed" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" strokeWidth={2.6} />{" "}
                    Earned this week
                  </>
                ) : (
                  <RewardStatusPill status={weeklyReward.status} />
                )}
              </div>
            ) : (
              <>
                <ProgressBar
                  thin
                  className="mt-1.5"
                  value={weekly.proofs / weekly.needed}
                  tone="yellow"
                  label="Weekly streak progress"
                />
                <div className="label-mono mt-1 text-[10px] text-muted-foreground">
                  {Math.min(weekly.proofs, weekly.needed)} of {weekly.needed}{" "}
                  proofs · resets in {daysToMonday}d
                </div>
              </>
            )}
          </Row>
        ) : null}

        {completionOn ? (
          <Row
            art={<Trophy size={32} />}
            title="Finish a goal"
            amount={tiers
              .map((t) => `${t.minDays}d ${compactG(t.amount)}`)
              .join(" · ")}
          >
            {unavailable.includes("completions") ||
            unavailable.includes("goals") ? (
              <div className="label-mono mt-1 text-[10px] text-muted-foreground">
                Progress unavailable right now
              </div>
            ) : completions.length === 0 ? (
              <div className="label-mono mt-1 text-[10px] text-muted-foreground">
                Join a campaign or keep a goal going
              </div>
            ) : (
              completions.map((p) => (
                <CompletionRow key={`${p.kind}:${p.ref}`} p={p} />
              ))
            )}
          </Row>
        ) : null}
      </div>
    </GameCard>
  );
}
