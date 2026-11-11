"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { ProofSuccessCard } from "@/components/proof-success-card";
import { useProofRewardStore, type ProofRewardState } from "@/lib/proof-reward/client";

/** Development-only: the proof success card with each reward outcome, for layout checks. ?state=… */
const STATES: Record<string, (now: number) => ProofRewardState> = {
  checking: (now) => ({ startedAt: now, status: "checking" }),
  paid: (now) => ({
    startedAt: now,
    status: "done",
    result: {
      status: "processed",
      wallet: "0x",
      day: "2026-11-11",
      daily: { result: "paid", amount: 100, payoutStatus: "confirmed" },
      weekly: { result: "not_reached" },
      completion: { result: "not_complete" },
    },
  }),
  bonus: (now) => ({
    startedAt: now,
    status: "done",
    result: {
      status: "processed",
      wallet: "0x",
      day: "2026-11-11",
      daily: { result: "queued", amount: 100, payoutStatus: "pending" },
      weekly: { result: "queued", amount: 250, payoutStatus: "pending" },
      completion: { result: "queued", amount: 1000, payoutStatus: "pending" },
    },
  }),
  limit: (now) => ({
    startedAt: now,
    status: "done",
    result: {
      status: "processed",
      wallet: "0x",
      day: "2026-11-11",
      daily: { result: "daily_limit" },
      weekly: { result: "not_reached" },
      completion: { result: "not_complete" },
    },
  }),
  unverified: (now) => ({ startedAt: now, status: "done", result: { status: "not_verified" } }),
  friend: (now) => ({ startedAt: now, status: "done", result: { status: "awaiting_verifier" } }),
};

export default function DevProofSuccessPage() {
  const [state, setState] = useState("paid");
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("state") ?? "paid";
    setState(s);
    const make = STATES[s];
    useProofRewardStore.setState({ current: make ? make(Date.now()) : null });
  }, []);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-[420px] bg-paper px-5 py-6">
      <p className="label-mono mb-3 text-[10px] text-muted-foreground">state: {state}</p>
      <ProofSuccessCard
        campaignTitle="Read 30 minutes"
        myStreak={4}
        myPoints={5200}
        pointsAwarded={1000}
        milestoneIndex={3}
        milestoneCount={30}
        onDone={() => {}}
      />
    </div>
  );
}
