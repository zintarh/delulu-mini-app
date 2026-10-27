"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AddToHomeCardView } from "@/components/home/add-to-home-card";
import { CampaignQuestRow } from "@/components/active-campaigns-section";
import type { JoinedDashboardCampaign } from "@/hooks/use-user-campaign-milestones";

const HOUR = 3600_000;
function mockCampaign(title: string, done: number, total: number, startOffsetH: number | null): JoinedDashboardCampaign {
  const now = Date.now();
  return {
    campaign_id: title, challenge_id: 1, title, community: { name: "Lagos Runners", slug: "x" },
    cover_image_url: null, display_ends_at: null, duration_days: 30, proof_type: "screenshot",
    live_camera_duration_seconds: null, is_free_to_join: true, join_token: "G$", join_amount: 0, forfeit_pct: 0,
    participant_count: 12, milestone_count: total, completed_count: done,
    next_milestones:
      startOffsetH == null
        ? []
        : [{
            milestone_id: done, label: "Proof", completed: false, is_overdue: false,
            start_time: new Date(now + startOffsetH * HOUR).toISOString(),
            deadline: new Date(now + (startOffsetH + 6) * HOUR).toISOString(),
          }],
  };
}
import { DailyMoneyCardView } from "@/components/home/daily-money-card";
import { AddToHomeSheet } from "@/components/pwa/add-to-home-sheet";
import { AppIntroView } from "@/components/app-intro";
import { DailyGoalCardView, WeekFlamesView } from "@/components/home/home-progress";

/**
 * Development-only gallery of redesign components in every state, for
 * checking layout at phone widths without a signed-in wallet.
 */
export default function DevPreviewPage() {
  // ?sheet=1 opens the add-to-home sheet on load (for screenshots).
  const [sheetOpen, setSheetOpen] = useState(false);
  // ?intro=1..3 opens the first-run intro on that step (?guest=1 for the guest ending).
  const [intro, setIntro] = useState<{ step: number; guest: boolean } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setSheetOpen(q.get("sheet") === "1");
    const step = Number(q.get("intro"));
    if (step >= 1) setIntro({ step: step - 1, guest: q.get("guest") === "1" });
  }, []);
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="h-[100dvh] overflow-y-auto bg-paper">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
        <h1 className="m-0 text-2xl font-bold">Component preview</h1>
        <span className="label-mono text-muted-foreground">Free daily money</span>
        <DailyMoneyCardView state="loading" />
        <DailyMoneyCardView state="verify" />
        <DailyMoneyCardView state="claimable" amount="1,234.56" />
        <DailyMoneyCardView state="claimed" nextClaim="1:00 PM · in 4:59" />
        <DailyMoneyCardView state="claimed" nextClaim="tomorrow 1:00 PM · in 23:12" />
        <DailyMoneyCardView state="empty" />
        <span className="label-mono text-muted-foreground">Your campaigns (Home)</span>
        <CampaignQuestRow campaign={mockCampaign("30-day morning run", 3, 10, -1)} nowMs={Date.now()} proofBusy={false} onProve={() => {}} />
        <CampaignQuestRow campaign={mockCampaign("Read 10 pages daily", 5, 14, 20)} nowMs={Date.now()} proofBusy={false} onProve={() => {}} />
        <CampaignQuestRow campaign={mockCampaign("No sugar November", 7, 7, null)} nowMs={Date.now()} proofBusy={false} onProve={() => {}} />
        <span className="label-mono text-muted-foreground">Add to home screen</span>
        <AddToHomeCardView onOpen={() => setSheetOpen(true)} onHide={() => {}} />
        <AddToHomeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
        {intro ? (
          <AppIntroView guest={intro.guest} initialStep={intro.step} onDone={() => setIntro(null)} onStart={() => setIntro(null)} />
        ) : null}
        <span className="label-mono text-muted-foreground">Daily goal</span>
        <DailyGoalCardView kept={3} total={3} daysSinceKept={0} />
        <DailyGoalCardView kept={1} total={3} daysSinceKept={1} />
        <DailyGoalCardView kept={0} total={0} />
        <span className="label-mono text-muted-foreground">Lulu&apos;s mood (missed days)</span>
        <DailyGoalCardView kept={0} total={2} daysSinceKept={2} />
        <DailyGoalCardView kept={0} total={2} daysSinceKept={4} />
        <DailyGoalCardView kept={0} total={2} daysSinceKept={9} />
        <span className="label-mono text-muted-foreground">Week</span>
        <WeekFlamesView last7Days={[true, true, false, true, true, true, false]} />
      </div>
    </div>
  );
}
