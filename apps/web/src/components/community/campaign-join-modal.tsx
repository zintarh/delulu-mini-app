"use client";

import { CalendarX, Loader2, Target, TrendingDown, Trophy, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Coin, GameButton } from "@/components/ds";
import { formatStake, getForfeitTerms } from "@/lib/community/campaign-forfeit";

export type CampaignJoinInfo = {
  title: string;
  communityName: string;
  milestoneCount: number;
  durationDays: number;
  endsAt?: string | null;
  isFreeToJoin: boolean;
  joinToken?: string;
  joinAmount?: number;
  forfeitPct?: number;
  proposedPoolAmount: number;
  prizeWinnerCount: number;
  isFunded: boolean;
  proofCadence?: string;
  proofInstructions?: string | null;
  pointsPerMilestone?: number;
  maxForfeitTotal?: number;
  fundedPoolAmount?: number;
  totalParticipantStakes?: number;
  totalPrizePoolAmount?: number;
  participantCount?: number;
};

const JOIN_LIMIT_MESSAGE =
  "You can only join 2 campaigns at a time. Complete your active campaigns to join another.";

export function CampaignJoinModal({
  open,
  info,
  joining,
  joiningLabel,
  joinError,
  insufficientBalance,
  userBalance,
  atJoinLimit,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  info: CampaignJoinInfo;
  joining: boolean;
  joiningLabel?: string;
  joinError?: string | null;
  insufficientBalance?: boolean;
  userBalance?: number;
  atJoinLimit?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const joinAmount = info.joinAmount ?? 0;
  const joinToken = info.joinToken ?? "G$";
  const isPaid = !info.isFreeToJoin && joinAmount > 0;
  const cadence = info.proofCadence === "weekly" ? "weekly" : "daily";
  // Claimable prize is funded G$ only — never treat proposed as claimable.
  const claimablePrize = info.fundedPoolAmount ?? info.totalPrizePoolAmount ?? 0;
  const terms = getForfeitTerms(info);
  const endsLabel = info.endsAt
    ? new Date(info.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : `${info.durationDays} days`;

  const rules: { icon: typeof CalendarX; text: string; warn?: boolean }[] = terms
    ? [
        {
          icon: CalendarX,
          text: `Miss a milestone → lose ${terms.pct}% (${formatStake(terms.perMiss)} ${terms.token})`,
          warn: true,
        },
        { icon: TrendingDown, text: "Lost stake goes to the Delulu pool" },
        terms.missesToLoseAll != null
          ? { icon: CalendarX, text: `Miss ${terms.missesToLoseAll} → lose it all` }
          : { icon: CalendarX, text: `Most you can lose: ${formatStake(terms.maxLoss)} ${terms.token}` },
        { icon: Undo2, text: "The rest comes back when the campaign ends" },
      ]
    : isPaid
      ? [{ icon: Undo2, text: "You get it all back when the campaign ends" }]
      : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={joining ? undefined : onCancel} />

      <div className="relative w-full max-w-sm overflow-hidden rounded-t-3xl border-2 border-line bg-white shadow-xl sm:rounded-3xl">
        <div className="mx-auto mb-1 mt-3 h-1 w-10 rounded-full bg-line sm:hidden" />

        <div className="px-5 pb-5 pt-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <h2 className="m-0 font-display text-[22px] font-extrabold uppercase leading-[0.95] text-ink">{info.title}</h2>
          <p className="label-mono mt-1.5 text-[10px] text-muted-foreground">
            {info.milestoneCount} {cadence} proofs · ends {endsLabel}
          </p>

          {/* Stake */}
          <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-yellow-soft px-4 py-3.5">
            <Coin size={40} />
            <div className="min-w-0">
              <div className="font-display text-[34px] font-extrabold uppercase leading-none tabular-nums">
                {isPaid ? `${formatStake(joinAmount)} ${joinToken}` : "Free"}
              </div>
              <div className="label-mono mt-1 text-[10px] text-muted-foreground">
                {isPaid ? "Your stake to join" : "No stake needed"}
              </div>
            </div>
          </div>

          {/* The rules, before they pay */}
          {rules.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {rules.map(({ icon: Icon, text, warn }) => (
                <li key={text} className={cn("flex items-center gap-2.5 text-[13px] font-semibold", warn ? "text-orange" : "text-ink")}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                  {text}
                </li>
              ))}
            </ul>
          ) : null}

          {claimablePrize > 0 ? (
            <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Trophy className="h-4 w-4 shrink-0 text-yellow-edge" strokeWidth={2.4} />
              {formatStake(claimablePrize)} G$ prize · top {info.prizeWinnerCount} by points
            </div>
          ) : null}

          {info.proofInstructions ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-paper px-3 py-2.5">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="m-0 text-xs text-muted-foreground">{info.proofInstructions}</p>
            </div>
          ) : null}

          {atJoinLimit ? (
            <p className="mt-3 rounded-2xl bg-orange-soft px-3 py-2.5 text-xs font-semibold text-orange">{JOIN_LIMIT_MESSAGE}</p>
          ) : insufficientBalance ? (
            <p className="mt-3 rounded-2xl bg-orange-soft px-3 py-2.5 text-xs font-semibold text-orange">
              You need {formatStake(joinAmount)} {joinToken} to join.
              {userBalance !== undefined ? ` You have ${formatStake(userBalance)}.` : ""}
            </p>
          ) : joinError ? (
            <p className="mt-3 rounded-2xl bg-orange-soft px-3 py-2.5 text-xs font-semibold text-orange">{joinError}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <GameButton variant="line" disabled={joining} onClick={onCancel}>
              Cancel
            </GameButton>
            <GameButton variant="yellow" full disabled={joining || !!insufficientBalance || !!atJoinLimit} onClick={onConfirm}>
              {joining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {joiningLabel ?? "Joining…"}
                </>
              ) : isPaid ? (
                terms ? `Stake ${formatStake(joinAmount)} · I agree` : `Stake ${formatStake(joinAmount)} ${joinToken}`
              ) : (
                "Join for free"
              )}
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}
