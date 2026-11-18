"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FLOW_STATE, flowStateLive } from "@/lib/flow-state";

/** Home's vote ask — one slim row while the Flow State vote is on. */
export function FlowStateCard() {
  if (!flowStateLive()) return null;
  return (
    <Link
      href="/flow-state"
      className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-white py-2.5 pl-3 pr-2 text-ink no-underline shadow-[0_3px_0_#161615]"
    >
      <span className="text-[22px] leading-none" aria-hidden>
        🗳️
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-extrabold leading-tight">Vote for Delulu on Flow State</span>
        <span className="block truncate text-[11px] font-semibold text-orange">Urgent · 3 quick steps{FLOW_STATE.endsOn ? ` · ends ${FLOW_STATE.endsOn}` : ""}</span>
      </span>
      <span className="inline-flex h-9 shrink-0 items-center rounded-xl bg-yellow px-3 text-[12px] font-extrabold uppercase shadow-edge-yellow">Vote</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
