"use client";

import Link from "next/link";
import Image from "next/image";
import { Target, ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useJoinedCampaignDashboard } from "@/hooks/use-user-campaign-milestones";
import { MainPage } from "@/components/main-app-header";
import { isCampaignEndedByDate } from "@/lib/community/campaign-types";
import { cn } from "@/lib/utils";

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

  return (
    <MainPage className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Home
        </Link>
        <h1 className="text-lg font-black text-foreground">My campaigns</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
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
        <ul className="space-y-3">
          {campaigns.map((c) => {
            const href = `/communities/${c.community.slug}/campaigns/${c.campaign_id}`;
            const isClosed = isCampaignEndedByDate(c.display_ends_at);
            const progress = c.milestone_count > 0
              ? `${c.completed_count} of ${c.milestone_count} done`
              : null;
            const pendingCount = c.next_milestones.length;

            return (
              <li key={c.campaign_id}>
                <Link
                  href={href}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-delulu-blue/30"
                >
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-delulu-blue-light">
                    {c.cover_image_url ? (
                      <Image
                        src={c.cover_image_url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Target className="h-5 w-5 text-delulu-blue" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {c.community.name}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-foreground">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {progress ?? "No milestones yet"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                      isClosed
                        ? "bg-muted text-muted-foreground"
                        : pendingCount > 0
                          ? "bg-delulu-blue-light text-delulu-blue"
                          : "bg-emerald-500/10 text-emerald-700",
                    )}
                  >
                    {isClosed ? "Ended" : pendingCount > 0 ? "Due" : "Up to date"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </MainPage>
  );
}
