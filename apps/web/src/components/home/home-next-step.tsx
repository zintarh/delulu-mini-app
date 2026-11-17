"use client";

import { useRouter } from "next/navigation";
import { NextStepCard } from "@/components/next-step-card";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { useIdentity } from "@/hooks/identityHook";
import { useBingoList } from "@/hooks/use-bingo";
import { homeNextStep, type NextStepAction } from "@/lib/next-step";

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
  if (!next) return <div className="h-[104px] animate-pulse rounded-[20px] bg-line" aria-busy="true" />;

  const onAction = (action: NextStepAction) => {
    if (action === "verify") return faceCheck?.start();
    if (next.featuredSlug) router.push(`/bingo/${next.featuredSlug}`);
  };
  return (
    <section aria-label="Your next step">
      <p className="label-mono m-0 mb-2 text-[10px] text-muted-foreground">Your next step</p>
      <NextStepCard step={next.step} onAction={onAction} />
    </section>
  );
}
