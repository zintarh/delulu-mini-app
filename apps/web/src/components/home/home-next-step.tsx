"use client";

import { useRouter } from "next/navigation";
import { HomeBingoMini } from "@/components/home/home-bingo-mini";
import { NextStepCard } from "@/components/next-step-card";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { useIdentity } from "@/hooks/identityHook";
import { useBingoList } from "@/hooks/use-bingo";
import { homeNextStep, type NextStepAction } from "@/lib/next-step";
import { atStakePlaying } from "@/components/home/at-stake-card";
import { useEarnFacts } from "@/hooks/use-earn-facts";

/** The step Home leads with, plus the Bingo it's about (so the list below doesn't repeat it). */
export function useHomeNextStep() {
  const { bingos } = useBingoList();
  const identity = useIdentity();
  const verified = identity.isLoading ? null : identity.isVerified;
  if (!bingos) return null;
  return homeNextStep({ bingos, verified });
}

/** "Your next step" — one thing to do, always. */
export function HomeNextStep() {
  const router = useRouter();
  const faceCheck = useFaceCheckOptional();
  const next = useHomeNextStep();
  const { bingos } = useBingoList();
  const facts = useEarnFacts();
  if (!next) return <div className="h-[104px] animate-pulse rounded-[20px] bg-line" aria-busy="true" />;

  const onAction = (action: NextStepAction) => {
    if (action === "verify") return faceCheck?.start();
    if (next.featuredSlug) router.push(`/bingo/${next.featuredSlug}`);
  };
  // Waiting (done for today, opens soon) is information, not a task: one slim line, no big card.
  const waiting = next.step.tone === "wait";
  // Done for today and the at-stake card right below already says so ("Day N done ✓") — one done card, not two.
  if (waiting && facts && atStakePlaying(bingos)?.me?.todayUsed) return null;
  // Their card shows when there's something to do today, or right after finishing (the flex moment).
  const featured = waiting ? null : (bingos?.find((b) => b.slug === next.featuredSlug && b.me) ?? null);
  return (
    <section aria-label="Your next step" className="flex flex-col gap-3">
      <div>
        <p className="label-mono m-0 mb-2 text-[10px] text-muted-foreground">Your next step</p>
        <NextStepCard step={next.step} onAction={onAction} compact={waiting} />
      </div>
      {/* Your card, small — the full board is one tap away on the Bingo page. */}
      {featured?.me ? <HomeBingoMini card={featured.me} slug={featured.slug} title={featured.title} today={featured.me.dayOrdered && !featured.me.todayUsed ? featured.me.today : null} /> : null}
    </section>
  );
}
