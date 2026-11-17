"use client";

import Link from "next/link";
import { ArrowRight, Vote } from "lucide-react";
import { gameButtonClass } from "@/components/ds";
import { FLOW_STATE, flowStateLive } from "@/lib/flow-state";

/** Home's urgent ask while the Flow State vote is on: vote for Delulu, 3 quick steps. */
export function FlowStateCard() {
  if (!flowStateLive()) return null;
  return (
    <section className="animate-rise rounded-[20px] border-2 border-ink bg-white p-4 shadow-[0_4px_0_#161615]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow">
          <Vote className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-mono m-0 text-[10px] text-orange">Urgent · help Delulu</p>
          <p className="m-0 mt-0.5 text-[15px] font-extrabold leading-snug">Vote for Delulu on Flow State 🗳️</p>
          <p className="m-0 mt-0.5 text-[13px] font-semibold leading-snug text-muted-foreground">
            Your vote keeps rewards flowing this season. 3 quick steps{FLOW_STATE.endsOn ? ` · ends ${FLOW_STATE.endsOn}` : ""}.
          </p>
        </div>
      </div>
      <Link href="/flow-state" className={gameButtonClass({ variant: "yellow", size: "sm", full: true, className: "mt-3" })}>
        Show me how <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
