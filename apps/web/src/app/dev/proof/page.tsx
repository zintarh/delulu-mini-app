"use client";

import { notFound } from "next/navigation";
import { ProofModal } from "@/components/proof-modal";

/** Development-only: the proof capture screen, for layout checks. */
export default function DevProofPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <ProofModal
      open
      onOpenChange={() => {}}
      onSubmit={async () => {}}
      campaignTitle="Read 30 minutes"
      milestoneIndex={3}
      proofInstructions="A photo of the page you're on, with today's date visible."
    />
  );
}
