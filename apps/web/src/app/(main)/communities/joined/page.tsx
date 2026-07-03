"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, Target, Trophy, AlertTriangle, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useJoinedCampaignDashboard,
  type JoinedDashboardCampaign,
} from "@/hooks/use-user-campaign-milestones";
import { MainPage } from "@/components/main-app-header";
import { isCampaignEndedByDate } from "@/lib/community/campaign-types";
import { BASE_PROOF_POINTS } from "@/lib/dashboard/campaign-constants";
import { cn } from "@/lib/utils";

function daysLeft(displayEndsAt: string | null, durationDays: number) {
  if (!displayEndsAt) return durationDays;
  return Math.max(0, Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000));
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const show = Math.min(total, 12);
  const scale = total / show;
  const filled = Math.round(done / scale);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: show }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < filled
              ? "w-3 bg-foreground"
              : "w-2 bg-muted-foreground/25",
          )}
        />
      ))}
    </div>
  );
}

function CampaignCard({ c }: { c: JoinedDashboardCampaign }) {
  const href = `/communities/${c.community.slug}/campaigns/${c.campaign_id}`;
  const isClosed = isCampaignEndedByDate(c.display_ends_at);
  const overdueCount = c.next_milestones.filter((m) => m.is_overdue && !m.completed).length;
  const pts = c.completed_count * BASE_PROOF_POINTS;
  const left = daysLeft(c.display_ends_at, c.duration_days);
  const pct = c.milestone_count > 0 ? (c.completed_count / c.milestone_count) * 100 : 0;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-border"
    >
      {/* Cover image with overlay title */}
      <div className="relative aspect-[4/1] overflow-hidden bg-delulu-blue-light/40">
        {c.cover_image_url ? (
          <Image
            src={c.cover_image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-delulu-blue via-delulu-blue/80 to-[#1e3a8a]">
            <Target className="h-10 w-10 text-white/20" />
          </div>
        )}

        {/* Dark gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

        {/* Status badge — top right */}
        <div className="absolute right-3 top-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
              isClosed
                ? "bg-black/50 text-white/60"
                : overdueCount > 0
                  ? "bg-orange-500/90 text-white"
                  : "bg-emerald-500/90 text-white",
            )}
          >
            {isClosed ? "Ended" : overdueCount > 0 ? `${overdueCount} overdue` : "On track"}
          </span>
        </div>

        {/* Title block over image */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            {c.community.name}
          </p>
          <p
            className="mt-0.5 line-clamp-1 text-base font-black leading-snug text-white"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {c.title}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3.5">
        {/* Progress bar + fraction */}
        {c.milestone_count > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <ProgressDots done={c.completed_count} total={c.milestone_count} />
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                {c.completed_count}/{c.milestone_count}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Milestones coming soon</p>
        )}

        {/* Stat chips row */}
        <div className="flex items-center gap-2 flex-wrap">
          {pts > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-[#fffbeb] px-2.5 py-1 text-[11px] font-black text-[#9a7b0a]">
              <Star className="h-3 w-3 fill-[#f6c324] text-[#f6c324]" />
              +{pts.toLocaleString()} pts
            </span>
          ) : null}

          {c.completed_count > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
              <Trophy className="h-3 w-3" />
              {c.completed_count} {c.completed_count === 1 ? "win" : "wins"}
            </span>
          ) : null}

          {overdueCount > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-black text-orange-700">
              <AlertTriangle className="h-3 w-3" />
              {overdueCount} missed
            </span>
          ) : null}

          {!isClosed && c.milestone_count > 0 ? (
            <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
              {left === 0 ? "Ends today" : `${left}d left`}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function JoinedCampaignsPage() {
  const { address, authenticated } = useAuth();
  const { data, isLoading } = useJoinedCampaignDashboard(address);

  if (!authenticated) {
    return (
      <MainPage className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Sign in to see your campaigns.</p>
      </MainPage>
    );
  }

  const campaigns = data ?? [];
  const active = campaigns.filter((c) => !isCampaignEndedByDate(c.display_ends_at));
  const ended = campaigns.filter((c) => isCampaignEndedByDate(c.display_ends_at));

  const totalPts = campaigns.reduce((sum, c) => sum + c.completed_count * BASE_PROOF_POINTS, 0);
  const totalWins = campaigns.reduce((sum, c) => sum + c.completed_count, 0);
  const totalMissed = campaigns.reduce(
    (sum, c) => sum + c.next_milestones.filter((m) => m.is_overdue && !m.completed).length,
    0,
  );

  return (
    <MainPage className="mx-auto max-w-2xl pb-24 lg:pb-8">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <h1
          className="text-2xl font-black text-foreground"
          style={{ fontFamily: '"Clash Display", sans-serif' }}
        >
          My campaigns
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {campaigns.length === 0 ? "No campaigns joined yet" : `${campaigns.length} joined`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mx-4 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">No campaigns joined yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Browse campaigns and join one to get started.
          </p>
          <Link
            href="/explore?tab=campaigns"
            className="mt-4 inline-block text-sm font-semibold text-delulu-blue hover:underline"
          >
            Browse campaigns →
          </Link>
        </div>
      ) : (
        <>
          {/* Global stats banner */}
          <div className="mx-4 mb-5 grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#fffbeb] px-3 py-4 text-center">
              <Star className="mb-1.5 h-5 w-5 fill-[#f6c324] text-[#f6c324]" />
              <p
                className="text-xl font-black tabular-nums text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {totalPts.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#9a7b0a]">
                pts earned
              </p>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-emerald-50 px-3 py-4 text-center">
              <Trophy className="mb-1.5 h-5 w-5 text-emerald-600" />
              <p
                className="text-xl font-black tabular-nums text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {totalWins}
              </p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                milestones won
              </p>
            </div>

            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl px-3 py-4 text-center",
                totalMissed > 0 ? "bg-orange-50" : "bg-muted/40",
              )}
            >
              {totalMissed > 0 ? (
                <AlertTriangle className="mb-1.5 h-5 w-5 text-orange-600" />
              ) : (
                <Zap className="mb-1.5 h-5 w-5 text-muted-foreground/50" />
              )}
              <p
                className="text-xl font-black tabular-nums text-foreground"
                style={{ fontFamily: '"Clash Display", sans-serif' }}
              >
                {totalMissed}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] font-bold uppercase tracking-wider",
                  totalMissed > 0 ? "text-orange-700" : "text-muted-foreground",
                )}
              >
                missed
              </p>
            </div>
          </div>

          {/* Active campaigns */}
          {active.length > 0 ? (
            <div className="px-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/50">
                Active · {active.length}
              </p>
              {active.map((c) => (
                <CampaignCard key={c.campaign_id} c={c} />
              ))}
            </div>
          ) : null}

          {/* Ended campaigns */}
          {ended.length > 0 ? (
            <div className={cn("px-4 space-y-3", active.length > 0 && "mt-6")}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/50">
                Ended · {ended.length}
              </p>
              {ended.map((c) => (
                <CampaignCard key={c.campaign_id} c={c} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </MainPage>
  );
}
