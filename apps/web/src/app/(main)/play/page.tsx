"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseUnits } from "viem";
import { useChainId } from "wagmi";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { BingoBannerCard } from "@/components/bingo/bingo-tile";
import { PinBoard, pinAspect } from "@/components/ui/pin-board";
import { useBingoList } from "@/hooks/use-bingo";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { useAuth } from "@/hooks/use-auth";
import { useGoodDollarClaim } from "@/hooks/useGoodDollarClaim";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { ForfeitCadence, ForfeitDestinationType, useCreateForfeitCommitment } from "@/hooks/use-create-forfeit-commitment";
import { CELO_MAINNET_ID, GOODDOLLAR_ADDRESSES, getForfeitMarketAddress } from "@/lib/constant";
import { finishRollingStart } from "@/lib/bingo/rolling-client";
import { rollingFirstDeadline } from "@/lib/bingo/types";
import { STARTER_CARDS, STARTER_STAKE } from "@/lib/bingo/starter";
import { celebrateCampaignJoin } from "@/lib/celebrate";
import { afterVote } from "@/lib/vote-gate";
import type { BingoView } from "@/lib/bingo/view";

const NEEDS_STARTER_KEY = "delulu:needs-starter";

const DAY_S = 86_400;

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/user (rejected|denied)|rejected the request|cancel/i.test(msg)) return "Cancelled. Nothing was claimed or joined.";
  if (/insufficient funds|gas/i.test(msg)) return "You need a little CELO for gas. We'll top you up — tap Claim and join again.";
  return msg || "Couldn't claim and join. Try again.";
}

/**
 * One tap: claim today's G$ (if it isn't claimed yet), then stake 100 G$ on
 * this card. That claim and that join are the two contract interactions a new
 * player needs. The vote opens here, and Home comes after they vote.
 */
function ClaimAndJoin({ bingo, pin, onDone }: { bingo: BingoView; pin: string; onDone: () => void }) {
  const router = useRouter();
  const { address } = useAuth();
  const chainId = useChainId();
  const ubi = useGoodDollarClaim();
  const { formatted, refetch: refetchBalance } = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const market = (() => {
    try {
      return chainId === CELO_MAINNET_ID ? getForfeitMarketAddress(chainId) : undefined;
    } catch {
      return undefined;
    }
  })();
  const approval = useTokenApproval(GOODDOLLAR_ADDRESSES.mainnet, market);
  const { createCommitmentAndWait } = useCreateForfeitCommitment();
  const [phase, setPhase] = useState<"idle" | "claiming" | "joining">("idle");
  const [error, setError] = useState<string | null>(null);

  const alreadyIn = !!bingo.me && bingo.me.status === "active" && bingo.me.phase !== "ended";
  const gBalance = Number(formatted);
  const canClaimToday = ubi.isWhitelisted && !ubi.hasClaimed && (ubi.entitlement ?? 0n) > 0n;
  const joinOnly = !canClaimToday && (ubi.hasClaimed || gBalance >= STARTER_STAKE);

  const run = async () => {
    if (phase !== "idle") return;
    if (!address) {
      persistSignInRedirect("/play");
      router.push(buildSignInUrl("/play"));
      return;
    }
    setError(null);
    setPhase("claiming");
    try {
      const status = await ubi.refreshStatus();
      const canClaim = status.isWhitelisted && !status.hasClaimed && (status.entitlement ?? 0n) > 0n;
      if (canClaim) {
        await ubi.claim();
        const after = await ubi.refreshStatus();
        if (!after.hasClaimed) {
          throw new Error(ubi.error?.message ?? "The G$ claim didn't go through. Try again.");
        }
      }

      setPhase("joining");

      let balance = 0;
      for (let i = 0; i < 6; i++) {
        const next = await refetchBalance();
        balance = Number(next.data?.formatted ?? 0);
        if (balance >= STARTER_STAKE) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (balance < STARTER_STAKE) {
        throw new Error(
          canClaim
            ? "Your G$ is still arriving. Wait a moment and tap Claim and join again."
            : `You need ${STARTER_STAKE} G$ to join. Claim today's G$ first, then tap again.`,
        );
      }

      if (approval.needsApproval(STARTER_STAKE)) await approval.approve(STARTER_STAKE);

      const verifier = await fetch("/api/bingo/verifier")
        .then((r) => r.json())
        .then((j: { address?: string | null }) => (j.address && /^0x[0-9a-f]{40}$/i.test(j.address) ? (j.address as `0x${string}`) : undefined))
        .catch(() => undefined);

      const txHash = await createCommitmentAndWait({
        verifier,
        token: GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
        stakeAmountWei: parseUnits(String(STARTER_STAKE), 18),
        destinationType: ForfeitDestinationType.CommunityPool,
        cadence: ForfeitCadence.Daily,
        totalPeriods: bingo.missions.filter((m) => !m.bonus).length,
        periodSeconds: DAY_S,
        firstDeadline: rollingFirstDeadline(),
      });

      await finishRollingStart(bingo.slug, address, {
        txHash,
        title: `${bingo.title} Bingo`,
        description: bingo.missions.map((m, i) => `Day ${i + 1}: ${m.title}`).join(" · "),
      });
      await celebrateCampaignJoin(bingo.title);
      await afterVote(() => undefined);
      onDone();
    } catch (err) {
      setError(friendly(err));
      setPhase("idle");
    }
  };

  const label = alreadyIn
    ? "You're in"
    : phase === "claiming"
      ? "Claiming…"
      : phase === "joining"
        ? "Joining…"
        : joinOnly
          ? "Join"
          : "Claim and join";

  return (
    <div>
      <BingoBannerCard
        bingo={bingo}
        pin={pin}
        action={{
          label,
          busy: phase !== "idle",
          disabled: !alreadyIn && !bingo.joinable,
          onClick: () => {
            if (alreadyIn) {
              void afterVote(() => undefined).then(onDone);
              return;
            }
            void run();
          },
        }}
      />
      {error ? <p className="m-0 mt-2 text-[12px] font-bold leading-snug text-orange">{error}</p> : null}
    </div>
  );
}

export default function PlayPage() {
  const router = useRouter();
  const { bingos } = useBingoList();
  const loading = bingos == null;
  const cards = STARTER_CARDS.map((s) => bingos?.find((b) => b.slug === s.slug)).filter((b): b is BingoView => !!b);
  const goHome = () => {
    try {
      const addr = window.localStorage.getItem(NEEDS_STARTER_KEY);
      if (addr) window.localStorage.removeItem(NEEDS_STARTER_KEY);
    } catch {
      /* private mode */
    }
    router.replace("/home");
  };

  return (
    <MainPage>
      <PageBackHeader
        title="Pick a card"
        eyebrow="Your first 7 days"
        subtitle="Claim today's G$ and join one card for 100 G$. Already claimed, and the G$ is in your wallet? Just join."
      />
      <div className="mx-auto max-w-3xl px-5 pb-12 pt-2">
        {loading && cards.length === 0 ? (
          <PinBoard twoUp>
            {STARTER_CARDS.map((s, i) => (
              <div key={s.slug} className={`${pinAspect(i + 1)} animate-pulse rounded-[22px] bg-ink/10`} />
            ))}
          </PinBoard>
        ) : null}
        {cards.length > 0 ? (
          <PinBoard twoUp>
            {cards.map((b, i) => (
              <ClaimAndJoin key={b.slug} bingo={b} pin={pinAspect(i + 1)} onDone={goHome} />
            ))}
          </PinBoard>
        ) : null}
        {!loading && cards.length === 0 ? (
          <p className="m-0 text-sm font-semibold text-orange">The starter cards aren't available right now. Try again in a moment.</p>
        ) : null}
      </div>
    </MainPage>
  );
}
