"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useChainId } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Camera, Coins, Eye, Lock, RotateCcw, TriangleAlert } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { LowBalancePanel } from "@/components/low-balance-panel";
import { Coin, GameButton } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCommunityCampaignTokenApproval } from "@/hooks/use-community-campaign-token-approval";
import { useJoinCommunityCampaignOnChain } from "@/hooks/use-community-campaign-onchain";
import { ForfeitCadence, ForfeitDestinationType, useCreateForfeitCommitment } from "@/hooks/use-create-forfeit-commitment";
import { joinCommunityCampaignWithWallet } from "@/lib/community/join-campaign-client";
import { celebrateCampaignJoin } from "@/lib/celebrate";
import { GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import type { BingoView } from "@/lib/bingo/view";
import { finishRollingStart } from "@/lib/bingo/rolling-client";
import { rollingFirstDeadline, rollingStartsTomorrow } from "@/lib/bingo/types";
import { fmtDay, fmtG } from "@/lib/bingo/format";
import { cn } from "@/lib/utils";
import { useStakeRules } from "@/hooks/use-stake-rules";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fmtNgn } from "@/lib/earn/format";
import { isFirstWeekSlug } from "@/lib/bingo/first-week";
import { seasonPointsForStake } from "@/lib/season/rules";

const DAY_S = 86_400;

/**
 * Pick a stake and join. Everything that can cost money is spelled out
 * before the stake moves: what a miss costs, where it goes, when the stake
 * comes back, and the real reward amounts.
 *
 * Weekly Bingos join a tier's CommunityMarket campaign; 3-day Bingos open the
 * player's own daily Forfeit goal (personal clock, starts now).
 */
export function BingoJoinSheet({
  bingo,
  open,
  onOpenChange,
  onJoined,
  initialTierKey,
}: {
  bingo: BingoView;
  open: boolean;
  /** Pre-pick a tier (the welcome gift opens on Starter). */
  initialTierKey?: string;
  onOpenChange: (open: boolean) => void;
  onJoined: () => void | Promise<void>;
}) {
  const { address } = useAuth();
  const chainId = useChainId();
  const rolling = bingo.enrollment === "rolling";
  const tiers = bingo.tiers.filter((t) => t.ready && (rolling || t.campaignId));
  const [tierKey, setTierKey] = useState((initialTierKey && tiers.some((t) => t.key === initialTierKey) ? initialTierKey : tiers[0]?.key) ?? "");
  // Season 2: tiers under this wallet's minimum stake are locked.
  const { rules: stakeRules } = useStakeRules(address);
  // Naira at the live G$ rate (G$ moves, so never a fixed figure).
  const facts = useEarnFacts();
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);
  // The Season 2 minimum is for 7-day Bingos: First Week is gated on eligibility instead,
  // and 3-day Bingos are the light way in (2k–5k stakes).
  const isLocked = (stake: number) =>
    !isFirstWeekSlug(bingo.slug) && bingo.durationDays !== 3 && stakeRules.live && stake < stakeRules.minStake;
  const firstOpen = tiers.find((t) => !isLocked(t.stake));
  useEffect(() => {
    const cur = tiers.find((t) => t.key === tierKey);
    if (cur && isLocked(cur.stake) && firstOpen) setTierKey(firstOpen.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeRules.minStake, stakeRules.live, firstOpen?.key]);
  const tier = tiers.find((t) => t.key === tierKey) ?? tiers[0];
  const tierLocked = !!tier && isLocked(tier.stake);
  // Photo-reward spots: joining is never limited, but only a few cards pay per photo (biggest stakes first).
  const { data: spots } = useQuery({
    queryKey: ["bingo-spots", address?.toLowerCase()],
    enabled: open && !!address && rolling,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/bingo/spots?address=${address}`);
      return r.ok ? ((await r.json()) as { max: number | null; used: number; bingoStakes: number[] }) : null;
    },
  });
  const spotsFull = !!spots?.max && spots.used >= spots.max;
  const smaller = spotsFull && tier ? spots!.bingoStakes.filter((n) => n < tier.stake).sort((a, b) => a - b)[0] : undefined;
  const { formatted, refetch } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const balance = Number(formatted) || 0;

  // Weekly: CommunityMarket. Rolling: ForfeitMarket.
  const weeklyApproval = useCommunityCampaignTokenApproval("G$");
  const forfeitMarket = useMemo(() => {
    try {
      return getForfeitMarketAddress(chainId);
    } catch {
      return undefined;
    }
  }, [chainId]);
  const rollingApproval = useTokenApproval(GOODDOLLAR_ADDRESSES.mainnet, forfeitMarket);
  const { joinCommunityCampaignAndWait } = useJoinCommunityCampaignOnChain();
  const { createCommitmentAndWait } = useCreateForfeitCommitment();

  const [step, setStep] = useState<"idle" | "approving" | "joining" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const required = bingo.missions.filter((m) => !m.bonus).length;
  const perMiss = tier ? (tier.stake * tier.forfeitPct) / 100 : 0;
  const short = tier ? Math.max(0, tier.stake - balance) : 0;
  const lastDay = bingo.cycle ? fmtDay(Date.parse(bingo.cycle.endsAt) - 1) : "";

  const rules = useMemo(() => {
    if (!tier) return [];
    const finish = typeof tier.completionReward === "number" ? tier.completionReward : bingo.rewards.completion;
    const earn =
      bingo.rewards.perProof > 0 || finish > 0
        ? {
            icon: Coins,
            text:
              [
                bingo.rewards.perProof > 0 ? `up to ${fmtG(bingo.rewards.perProof)} G$ a photo` : null,
                finish > 0 ? `${fmtG(finish)} G$ for a full card` : null,
              ]
                .filter(Boolean)
                .join(" + ") + " (verified players)",
          }
        : null;
    const list = rolling
      ? [
          {
            icon: Camera,
            text: rollingStartsTomorrow()
              ? `Starts tomorrow · 1 photo a day for ${required} days, each day until midnight`
              : `Day 1 is today · 1 photo a day for ${required} days, each day until midnight`,
          },
          { icon: TriangleAlert, text: `Miss a day: your ${fmtG(tier.stake)} G$ goes to the community pool` },
          { icon: RotateCcw, text: `Finish all ${required}: your ${fmtG(tier.stake)} G$ comes straight back` },
        ]
      : [
          { icon: Camera, text: `1 photo a day · any square · ${required} days` },
          perMiss > 0
            ? { icon: TriangleAlert, text: `Miss a day: −${fmtG(perMiss)} G$ (${tier.forfeitPct}%) to the Delulu pool` }
            : { icon: TriangleAlert, text: "No stake lost for missed days" },
          { icon: RotateCcw, text: `Stake back after ${lastDay}, minus missed days` },
        ];
    return [...list, ...(earn ? [earn] : []), { icon: Eye, text: "Your Bingo photos are shown to other players" }];
  }, [tier, rolling, required, perMiss, lastDay, bingo.rewards]);

  const joinWeekly = async () => {
    if (!address || !tier?.campaignId) return;
    if (weeklyApproval.needsApproval(tier.stake)) {
      setStep("approving");
      await weeklyApproval.approve(tier.stake);
    }
    setStep("joining");
    await joinCommunityCampaignWithWallet(tier.campaignId, address, joinCommunityCampaignAndWait, { campaignTitle: bingo.title });
  };

  const joinRolling = async () => {
    if (!address || !tier) return;
    if (rollingApproval.needsApproval(tier.stake)) {
      setStep("approving");
      await rollingApproval.approve(tier.stake);
    }
    setStep("joining");
    // Delulu's server verifies the card: once the AI approves a photo it marks the day done,
    // so nothing is left for the player to sign (or to get stuck) after the photo.
    const verifier = await fetch("/api/bingo/verifier")
      .then((r) => r.json())
      .then((j: { address?: string | null }) => (j.address && /^0x[0-9a-f]{40}$/i.test(j.address) ? (j.address as `0x${string}`) : undefined))
      .catch(() => undefined);
    const txHash = await createCommitmentAndWait({
      verifier,
      token: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
      stakeAmountWei: parseUnits(String(tier.stake), 18),
      destinationType: ForfeitDestinationType.CommunityPool,
      cadence: ForfeitCadence.Daily,
      totalPeriods: required,
      periodSeconds: DAY_S,
      // Days follow the calendar: day 1 closes at midnight (Lagos), not 24h from now.
      firstDeadline: rollingFirstDeadline(),
    });
    setStep("saving");
    await finishRollingStart(bingo.slug, address, {
      txHash,
      title: `${bingo.title} Bingo`,
      description: bingo.missions.map((m, i) => `Day ${i + 1}: ${m.title}`).join(" · "),
    });
    await celebrateCampaignJoin(bingo.title);
  };

  const join = async () => {
    setError(null);
    try {
      await (rolling ? joinRolling() : joinWeekly());
      void refetch();
      await onJoined();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/user (rejected|denied)|rejected the request|cancel/i.test(msg) ? "Cancelled." : msg || "Couldn't join. Try again.");
    } finally {
      setStep("idle");
    }
  };

  const busy = step !== "idle";
  const label =
    step === "approving" ? "Approving…" : step === "joining" ? "Staking…" : step === "saving" ? "Opening your card…" : `Stake ${fmtG(tier?.stake ?? 0)} G$ & ${rolling ? "start" : "join"}`;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={rolling ? `Start ${bingo.title}` : `Join ${bingo.title}`}
      sheetClassName="rounded-t-3xl pb-10"
      modalClassName="max-w-md"
    >
      <div className="flex flex-col gap-4 px-5 pt-1">
        {!rolling && bingo.cycle?.phase === "upcoming" ? (
          <p className="label-mono flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Starts {fmtDay(bingo.cycle.startsAt)}
          </p>
        ) : null}

        {tiers.length > 1 ? (
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Stake">
            {tiers.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={t.key === tier?.key}
                onClick={() => setTierKey(t.key)}
                disabled={busy || isLocked(t.stake)}
                className={cn(
                  "press-edge flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3",
                  isLocked(t.stake) && "opacity-40",
                  t.key === tier?.key ? "border-ink bg-ink text-white shadow-[0_3px_0_#000]" : "border-line bg-white text-ink shadow-edge-sm",
                )}
              >
                <span className="label-mono flex items-center gap-1 text-[10px] opacity-70">
                  {isLocked(t.stake) ? <Lock className="h-3 w-3" /> : null}
                  {t.label}
                </span>
                <span className="font-display text-xl font-extrabold leading-none">{fmtG(t.stake)}</span>
                <span className="text-[10px] font-bold opacity-70">G${ngn(t.stake) ? ` · ≈ ${ngn(t.stake)}` : ""}</span>
                <span className="text-[10px] font-bold opacity-70">+{seasonPointsForStake(t.stake).toLocaleString()} pts a day</span>
                {typeof t.completionReward === "number" && t.completionReward > 0 ? (
                  <span className={cn("mt-1 rounded-full px-1.5 py-0.5 text-center text-[10px] font-extrabold leading-tight", t.key === tier?.key ? "bg-green text-ink" : "bg-green-soft text-green-edge")}>
                    +{fmtG(t.completionReward)} back
                    {ngn(t.completionReward) ? <span className="block font-bold opacity-80">≈ {ngn(t.completionReward)}</span> : null}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="flex flex-col gap-2.5 rounded-2xl border-2 border-line bg-white p-3.5">
          {rules.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-[13px] font-semibold leading-snug">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              {text}
            </li>
          ))}
        </ul>

        {spotsFull ? (
          <p className="m-0 flex items-start gap-2 rounded-xl bg-green-soft px-3 py-2 text-[12px] font-bold leading-snug text-green-edge">
            <Coins className="mt-px h-4 w-4 shrink-0" />
            {smaller != null
              ? `Earns photo G$ in place of your ${fmtG(smaller)} G$ card — bigger stakes earn first`
              : `Your ${spots!.max} photo-reward spots are full · this card earns cashback when you finish`}
          </p>
        ) : null}

        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Your balance</span>
          <span className={cn("inline-flex items-center gap-1 font-bold", short > 0 && "text-orange")}>
            <Coin size={16} /> {fmtG(balance)} G$
          </span>
        </div>

        {error ? <p className="rounded-xl bg-orange-soft px-3 py-2 text-[13px] font-semibold text-orange">{error}</p> : null}

        {tierLocked ? (
          <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-[13px] font-semibold">
            <Lock className="h-4 w-4 shrink-0" /> Min stake {fmtG(stakeRules.minStake)} G$
          </p>
        ) : short > 0 ? (
          <LowBalancePanel need={tier?.stake ?? 0} have={balance} />
        ) : (
          <GameButton variant="yellow" full onClick={() => void join()} disabled={busy || !tier || !address}>
            {label}
          </GameButton>
        )}
      </div>
    </ResponsiveSheet>
  );
}
