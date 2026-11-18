"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, BellRing, Clock, Sparkles, Trophy, TriangleAlert } from "lucide-react";
import { GameButton, gameButtonClass } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { getPushSupportState, subscribeToWebPush } from "@/lib/web-push-client";
import { fmtUntil } from "@/lib/bingo/format";
import { nextBingoFor, proofNextStep, type NextStep, type NextStepAction } from "@/lib/next-step";
import { useBingoList } from "@/hooks/use-bingo";
import { cn } from "@/lib/utils";

const TONE = {
  go: { box: "border-ink bg-white", icon: Sparkles, iconCls: "bg-yellow text-ink" },
  wait: { box: "border-line bg-white", icon: Clock, iconCls: "bg-paper text-ink" },
  win: { box: "border-green-line bg-[#f2fbf5]", icon: Trophy, iconCls: "bg-green text-ink" },
  warn: { box: "border-orange/40 bg-orange-soft", icon: TriangleAlert, iconCls: "bg-white text-orange" },
} as const;

/** Re-renders each minute so countdowns stay true. */
function useMinuteTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
}

/** Only offered when the browser hasn't decided yet, or is allowed but not subscribed. */
function useRemindMe() {
  const { address } = useAuth();
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "on">("hidden");
  useEffect(() => {
    let cancelled = false;
    void getPushSupportState().then((s) => {
      if (cancelled) return;
      if (s.state === "needs_permission" && s.permission === "default") setState("offer");
      else if (s.state === "ready") setState(s.subscribed ? "on" : "offer");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const enable = async () => {
    if (!address) return;
    setState("busy");
    try {
      await subscribeToWebPush(address);
      setState("on");
    } catch {
      setState("hidden");
    }
  };
  return { state, enable };
}

/**
 * The next step, always: what to do now, or when to come back (with a live
 * countdown and a one-tap reminder). Never leaves the player at a dead end.
 */
export function NextStepCard({
  step,
  onAction,
  compact = false,
  className,
}: {
  step: NextStep;
  /** Handles in-page actions ("join", "today", "verify"); links are followed directly. */
  onAction?: (action: NextStepAction) => void;
  /** One slim line (waiting states on Home — information, not a task). */
  compact?: boolean;
  className?: string;
}) {
  useMinuteTick();
  const remind = useRemindMe();
  const t = TONE[step.tone];
  const Icon = t.icon;
  const cta = step.cta;

  if (compact) {
    const until = step.until && Date.parse(step.until) > Date.now() ? ` · ${step.untilLabel === "closes" ? "closes" : "next"} in ${fmtUntil(step.until)}` : "";
    return (
      <div className={cn("flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2", t.box, className)}>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
        <p className="m-0 min-w-0 flex-1 truncate text-[13px] font-extrabold">
          {step.title}
          <span className="font-semibold text-muted-foreground">{until}</span>
        </p>
        {step.remind && (remind.state === "offer" || remind.state === "busy") ? (
          <button type="button" onClick={() => void remind.enable()} disabled={remind.state === "busy"} aria-label="Remind me" className="shrink-0 rounded-lg p-1 text-ink">
            <Bell className="h-4 w-4" />
          </button>
        ) : cta?.href ? (
          <Link href={cta.href} className="shrink-0 text-[12px] font-extrabold text-ink underline">
            {cta.label}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("animate-rise rounded-[20px] border-2 p-3.5 text-left shadow-edge-sm", t.box, className)}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.iconCls)}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-extrabold leading-snug">{step.title}</p>
          {step.body ? <p className="m-0 mt-0.5 text-[13px] font-semibold leading-snug text-muted-foreground">{step.body}</p> : null}
          {step.until && Date.parse(step.until) > Date.now() ? (
            step.untilLabel === "closes" && Date.parse(step.until) - Date.now() < 3 * 3_600_000 ? (
              // Under 3h: the countdown is the message.
              <p className="m-0 mt-2 inline-flex items-center gap-1.5 rounded-full bg-orange px-2.5 py-1 text-[12px] font-extrabold text-white">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.6} /> Closes in {fmtUntil(step.until)}
              </p>
            ) : (
              <p className="label-mono m-0 mt-1.5 text-[10px] text-muted-foreground">
                {step.untilLabel === "closes" ? "Closes" : "Opens"} in {fmtUntil(step.until)}
              </p>
            )
          ) : null}
        </div>
      </div>

      {cta || (step.remind && (remind.state === "offer" || remind.state === "busy")) ? (
        <div className="mt-3 flex gap-2">
          {cta?.href ? (
            <Link href={cta.href} className={gameButtonClass({ variant: step.tone === "win" ? "green" : "yellow", size: "sm", full: true })}>
              {cta.label} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : cta?.action ? (
            <GameButton variant="yellow" size="sm" full onClick={() => onAction?.(cta.action!)}>
              {cta.label}
            </GameButton>
          ) : null}
          {step.remind && (remind.state === "offer" || remind.state === "busy") ? (
            <GameButton variant="line" size="sm" full={!cta} onClick={() => void remind.enable()} disabled={remind.state === "busy"}>
              <Bell className="h-4 w-4" /> Remind me
            </GameButton>
          ) : null}
        </div>
      ) : step.remind && remind.state === "on" ? (
        <p className="label-mono m-0 mt-2 inline-flex items-center gap-1 text-[10px] text-green-edge">
          <BellRing className="h-3 w-3" /> We&apos;ll remind you
        </p>
      ) : null}
    </div>
  );
}

/** The success card's closing line for personal goals and campaigns. */
export function ProofNextStep({ milestoneIndex, milestoneCount }: { milestoneIndex?: number | null; milestoneCount?: number | null }) {
  const { bingos } = useBingoList();
  const step = proofNextStep({ milestoneIndex, milestoneCount, nextBingo: nextBingoFor(null, bingos ?? []) });
  return <NextStepCard step={step} className="mt-4 w-full" />;
}
