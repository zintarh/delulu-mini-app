"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BingoFlexCard } from "@/components/bingo/bingo-flex-card";
import { BingoCollage } from "@/components/bingo/bingo-collage";
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
  const { bingos } = useBingoList();
  if (!next) return <div className="h-[104px] animate-pulse rounded-[20px] bg-line" aria-busy="true" />;

  const onAction = (action: NextStepAction) => {
    if (action === "verify") return faceCheck?.start();
    if (next.featuredSlug) router.push(`/bingo/${next.featuredSlug}`);
  };
  // Waiting (done for today, opens soon) is information, not a task: one slim line, no big card.
  const waiting = next.step.tone === "wait";
  // Their card shows when there's something to do today, or right after finishing (the flex moment).
  const featured = waiting ? null : (bingos?.find((b) => b.slug === next.featuredSlug && b.me) ?? null);
  return (
    <section aria-label="Your next step" className="flex flex-col gap-3">
      <div>
        <p className="label-mono m-0 mb-2 text-[10px] text-muted-foreground">Your next step</p>
        <NextStepCard step={next.step} onAction={onAction} compact={waiting} />
      </div>
      {featured?.me ? (
        <Link href={`/bingo/${featured.slug}`} className="block no-underline transition-transform active:scale-[0.99]" aria-label={`Open ${featured.title}`}>
          {/* Once there's a photo, the card is a collage of them; before that, the sticker card. */}
          {featured.me.squares.some((q) => !q.bonus && (q.state === "filled" || q.state === "confirming")) ? (
            <BingoCollage card={featured.me} bingoTitle={featured.title} required={featured.missions.filter((m) => !m.bonus).length} mine />
          ) : (
            <BingoFlexCard card={featured.me} bingoTitle={featured.title} required={featured.missions.filter((m) => !m.bonus).length} />
          )}
        </Link>
      ) : null}
    </section>
  );
}
