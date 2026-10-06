"use client";

import { useEffect } from "react";
import { Camera, Zap } from "lucide-react";
import { Chest, Coin, ShieldBadge, Trophy, gameButtonClass } from "@/components/ds";
import { useVerifySheet } from "@/contexts/right-panel-context";

const BENEFITS = [
  { icon: <Chest size={26} />, title: "Free money every day", body: "Claim free G$ from GoodDollar daily" },
  { icon: <Coin size={24} />, title: "Stake G$ & join campaigns", body: "Put real money on your word" },
  { icon: <Trophy size={26} />, title: "Prizes & payouts", body: "Claim campaign prizes and rewards" },
  { icon: <Zap className="h-5 w-5 text-[#E07B1A]" strokeWidth={2} />, title: "Gas included", body: "GoodDollar tops up your wallet instantly" },
];

/** Face-check explainer (design: docs/redesign/screens/Verify.dc.html). */
export function VerifySheet() {
  const { isOpen, close, startFaceCheck } = useVerifySheet();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[440px] animate-sheet-up flex-col gap-[18px] rounded-t-[28px] bg-white px-5 pb-7 pt-2.5 sm:rounded-[28px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 28px)" }}
      >
        <span className="h-[5px] w-10 self-center rounded-full bg-[#dadad4]" aria-hidden />
        <div className="flex flex-col items-center gap-2.5 text-center">
          <span className="animate-bounce-in">
            <ShieldBadge size={84} />
          </span>
          <h2 id="verify-title" className="m-0 mt-1 text-2xl font-bold leading-[1.2] tracking-[-0.02em]">
            Prove you&apos;re a real person
          </h2>
          <p className="m-0 max-w-[300px] text-[15px] leading-normal text-muted-foreground">
            One quick face check. It keeps rewards fair and bots out.
          </p>
        </div>
        <div className="flex flex-col gap-3.5 py-1">
          {BENEFITS.map(({ icon, title, body }, i) => (
            <div key={title} className="flex animate-rise items-center gap-3.5" style={{ animationDelay: `${(i + 2) * 0.1}s` }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-paper">
                {icon}
              </span>
              <div>
                <div className="font-bold">{title}</div>
                <div className="mt-0.5 text-[13px] text-muted-foreground">{body}</div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={startFaceCheck} className={gameButtonClass({ variant: "blue", full: true })}>
          <Camera className="h-5 w-5" strokeWidth={2} />
          Start face check
        </button>
        <div className="flex items-center justify-between">
          <span className="label-mono text-[10px] text-muted-foreground">Face check by GoodDollar</span>
          <button type="button" onClick={close} className="py-2 font-bold">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
