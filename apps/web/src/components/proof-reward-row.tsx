"use client";

import { useRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Coin, Flame, ShieldBadge, Trophy } from "@/components/ds";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { useProofRewardStore } from "@/lib/proof-reward/client";
import type { RewardOutcome } from "@/lib/rewards/engine";
import { cn } from "@/lib/utils";

/** Results older than this when the card opened belong to an earlier proof. */
const FRESH_MS = 2 * 60_000;

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const earned = (o: RewardOutcome | null | undefined): o is Extract<RewardOutcome, { amount: number }> =>
  !!o && "amount" in o && o.amount > 0;

function Shell({
  tone,
  art,
  title,
  sub,
  action,
}: {
  tone: "green" | "yellow" | "plain";
  art: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 flex w-full animate-rise items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left [animation-delay:.55s]",
        tone === "green" && "border-green-line bg-green-soft",
        tone === "yellow" && "border-yellow-line bg-yellow-soft",
        tone === "plain" && "border-line bg-white",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">{art}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-snug">{title}</div>
        {sub ? <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * The G$ this proof earned, on the proof success card: checking → what was
 * granted (daily proof, plus a weekly streak or completion bonus if this
 * proof unlocked one), or why it didn't earn. Only states real outcomes from
 * the Rewards Engine; shows nothing when there's no reward request.
 */
export function ProofRewardRow() {
  const openedAt = useRef(Date.now());
  const current = useProofRewardStore((s) => s.current);
  const faceCheck = useFaceCheckOptional();

  if (!current || current.startedAt < openedAt.current - FRESH_MS || current.status === "error") return null;

  if (current.status === "checking") {
    return (
      <Shell
        tone="plain"
        art={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        title="Checking your G$ reward…"
      />
    );
  }

  const r = current.result;
  if (r.status === "not_verified") {
    return (
      <Shell
        tone="yellow"
        art={<ShieldBadge size={30} />}
        title="Verify to earn G$ for every proof"
        sub="One quick face check"
        action={
          faceCheck ? (
            <button
              type="button"
              onClick={faceCheck.start}
              className="press-edge shrink-0 rounded-xl border-2 border-ink bg-ink px-3 py-1.5 text-xs font-bold text-white"
            >
              Verify
            </button>
          ) : null
        }
      />
    );
  }
  if (r.status === "awaiting_verifier") {
    return <Shell tone="plain" art={<Coin size={28} />} title="G$ reward comes when your friend approves" />;
  }
  if (r.status !== "processed") return null;

  const bonuses = [
    earned(r.weekly) ? { key: "weekly", art: <Flame size={16} />, text: `+${fmt(r.weekly.amount)} G$ weekly streak` } : null,
    earned(r.completion) ? { key: "completion", art: <Trophy size={16} />, text: `+${fmt(r.completion.amount)} G$ for finishing` } : null,
  ].filter((b): b is NonNullable<typeof b> => !!b);

  const all = [r.daily, r.weekly, r.completion].filter(earned);
  const total = all.reduce((sum, o) => sum + o.amount, 0);
  const allPaid = all.length > 0 && all.every((o) => o.result === "paid");

  if (total > 0) {
    return (
      <Shell
        tone="green"
        art={<Coin size={30} />}
        title={
          <>
            +{fmt(total)} G$ reward
            {bonuses.length > 0 ? (
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-green-edge">
                {bonuses.map((b) => (
                  <span key={b.key} className="inline-flex items-center gap-1">
                    {b.art}
                    {b.text}
                  </span>
                ))}
              </span>
            ) : null}
          </>
        }
        sub={allPaid ? "Ready to claim" : "On its way"}
        action={
          allPaid ? (
            <Link
              href="/rewards"
              className="press-edge shrink-0 rounded-xl border-2 border-green-edge bg-green px-3 py-1.5 text-xs font-bold text-white no-underline"
            >
              Claim
            </Link>
          ) : null
        }
      />
    );
  }

  if (r.daily.result === "daily_limit") {
    return <Shell tone="plain" art={<Coin size={28} />} title="Today's G$ proof rewards are done" sub="Back tomorrow" />;
  }
  if (r.daily.result === "goal_limit") {
    return (
      <Shell tone="plain" art={<Coin size={28} />} title="This goal isn't earning G$" sub="Your earning goals are full" />
    );
  }
  return null;
}
