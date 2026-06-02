"use client";

import { CheckCircle2, Trophy } from "lucide-react";

export function DeluluCampaignSection({
  campaignTitle,
  deluluEarnedPoints,
}: {
  campaignTitle: string;
  deluluEarnedPoints: number;
}) {
  return (
    <div className="p-6 bg-card rounded-2xl border border-border space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 border border-purple-400/60">
            <Trophy className="w-4 h-4 text-purple-300" />
          </span>
          <h3 className="text-sm md:text-base font-black text-foreground">Campaign</h3>
        </div>
        <span className="text-xs md:text-sm font-semibold text-purple-200 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/60">
          {campaignTitle}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span>This delulu is participating in {campaignTitle}</span>
      </div>
      <p className="text-sm text-foreground">
        <span className="font-semibold tabular-nums">
          {deluluEarnedPoints.toLocaleString()}
        </span>{" "}
        <span className="text-muted-foreground">
          points earned on this delulu
          {deluluEarnedPoints > 0
            ? " (verified milestones)"
            : " — verify milestones to earn points"}
        </span>
      </p>
    </div>
  );
}
