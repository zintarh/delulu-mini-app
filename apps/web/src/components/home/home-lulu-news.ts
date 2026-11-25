"use client";

import { useMemo } from "react";
import type { LuluMessage, LuluTone } from "@/components/home/lulu-hero";
import { useHomeNextStep } from "@/components/home/home-next-step";
import { useFaceCheckOptional } from "@/contexts/right-panel-context";
import { referralPhase } from "@/lib/referral/campaign";

const TONE: Record<"go" | "wait" | "win" | "warn", LuluTone> = { go: "progress", wait: "happy", win: "reward", warn: "urgent" };

/**
 * What Home used to say in separate cards, said by Lulu instead: the one next
 * step and referral news. Ids starting "due:" stay until done (tapping and
 * backing out mustn't hide today's photo); the rest retire once tapped.
 */
export function useLuluHomeNews(): LuluMessage[] {
  const next = useHomeNextStep();
  const faceCheck = useFaceCheckOptional();
  const phase = referralPhase();
  return useMemo(() => {
    const out: LuluMessage[] = [];
    const step = next?.step;
    // First Week has its own card at the top; "done for today" is Lulu's own cheer.
    if (step && step.kind !== "first-week" && step.tone !== "wait") {
      const verify = step.cta?.action === "verify";
      out.push({
        id: `due:next:${next.featuredSlug ?? "none"}:${step.title}`,
        tone: TONE[step.tone],
        text: step.title,
        cta: step.cta ? { label: step.cta.label, href: step.cta.href ?? (verify ? "#verify" : next.featuredSlug ? `/bingo/${next.featuredSlug}` : "/explore") } : undefined,
        onAct: verify ? () => faceCheck?.start() : undefined,
      });
    }
    if (phase.phase === "live") {
      out.push({
        id: `ref:${phase.round.start}`,
        tone: "tip",
        text: `Invite friends: ${phase.round.reward.toLocaleString("en-US")} G$ each once they verify and stake.`,
        cta: { label: "Invite", href: "/referrals" },
      });
    }
    return out;
  }, [next, faceCheck, phase]);
}
