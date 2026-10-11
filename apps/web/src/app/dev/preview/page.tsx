"use client";

import { notFound } from "next/navigation";
import { DailyMoneyCardView } from "@/components/home/daily-money-card";
import { DailyGoalCardView, WeekFlamesView } from "@/components/home/home-progress";

/**
 * Development-only gallery of redesign components in every state, for
 * checking layout at phone widths without a signed-in wallet.
 */
export default function DevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="h-[100dvh] overflow-y-auto bg-paper">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
        <h1 className="m-0 text-2xl font-bold">Component preview</h1>
        <span className="label-mono text-muted-foreground">Free daily money</span>
        <DailyMoneyCardView state="loading" />
        <DailyMoneyCardView state="verify" />
        <DailyMoneyCardView state="claimable" amount="1,234.56" />
        <DailyMoneyCardView state="claimed" countdown="23:59:12" />
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
