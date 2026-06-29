"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChevronLeft, Clock, Target, Trophy, Users } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { isCampaignEndedByDate } from "@/lib/community/campaign-types";
import { cn } from "@/lib/utils";

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  proof_cadence: string;
  proof_instructions: string | null;
  proposed_pool_amount: number;
  status: string;
  display_ends_at: string | null;
  created_at: string;
  cover_image_url?: string | null;
  duration_days?: number | null;
};

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

function daysLeft(displayEndsAt: string | null, durationDays: number | null | undefined) {
  if (!displayEndsAt) return durationDays ?? null;
  return Math.max(0, Math.ceil((new Date(displayEndsAt).getTime() - Date.now()) / 86400000));
}

function PageSkeleton() {
  return (
    <div className="animate-pulse px-4 pb-16 pt-2">
      {/* Back */}
      <div className="mb-5 h-7 w-28 rounded-full bg-muted" />
      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="h-6 w-40 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded-lg bg-muted/70" />
      </div>
      {/* Campaign cards */}
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="aspect-[16/7] bg-muted" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-3/4 rounded-lg bg-muted" />
              <div className="h-3 w-1/2 rounded-lg bg-muted/70" />
              <div className="mt-3 h-9 w-full rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampaignCard({ campaign, communitySlug }: { campaign: Campaign; communitySlug: string }) {
  const href = `/communities/${communitySlug}/campaigns/${campaign.id}`;
  const isClosed = isCampaignEndedByDate(campaign.display_ends_at);
  const left = daysLeft(campaign.display_ends_at, campaign.duration_days);
  const hasPrize = campaign.proposed_pool_amount > 0;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all hover:border-delulu-blue/30 hover:shadow-md">
      <Link href={href} className="block">
        {/* Image */}
        <div className="relative aspect-[16/7] overflow-hidden bg-gradient-to-br from-delulu-blue/20 via-delulu-blue/10 to-muted/30">
          {(campaign as { cover_image_url?: string | null }).cover_image_url ? (
            <Image
              src={(campaign as { cover_image_url: string }).cover_image_url}
              alt=""
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Target className="h-8 w-8 text-delulu-blue/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

          {/* Prize badge */}
          {hasPrize && !isClosed ? (
            <div className="absolute right-3 top-3">
              <span className="flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-1 text-[11px] font-black text-black shadow-sm">
                <Trophy className="h-3 w-3" />
                {campaign.proposed_pool_amount} G$
              </span>
            </div>
          ) : null}

          {isClosed ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/60 py-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/80">
                Ended
              </span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="p-4">
          <h3
            className="line-clamp-2 text-base font-black leading-snug text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {campaign.title}
          </h3>
          {campaign.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {campaign.description}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {left != null ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isClosed ? "Ended" : left === 0 ? "Ends today" : `${left}d left`}
              </span>
            ) : null}
            <span className="flex items-center gap-1 capitalize">
              <Target className="h-3 w-3" />
              {campaign.proof_cadence} proofs
            </span>
          </div>
        </div>
      </Link>

      <div className="border-t border-border/50 px-4 pb-4 pt-3">
        <Link
          href={href}
          className={cn(
            "flex h-9 w-full items-center justify-center rounded-xl text-sm font-bold transition-colors",
            isClosed
              ? "border border-border/60 bg-muted/30 text-muted-foreground"
              : "bg-delulu-blue text-white shadow-[0_2px_10px_rgba(37,99,235,0.25)] hover:bg-delulu-blue/90",
          )}
        >
          {isClosed ? "View campaign" : "View & join →"}
        </Link>
      </div>
    </article>
  );
}

export default function CommunityHubPage() {
  const params = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/community/communities/${params.slug}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "Not found"); return; }
        setCommunity(json.community);
        setCampaigns(json.campaigns ?? []);
      } catch {
        setError("Failed to load community");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.slug]);

  if (loading) {
    return <MainPage className="mx-auto max-w-2xl xl:max-w-3xl"><PageSkeleton /></MainPage>;
  }

  if (error || !community) {
    return (
      <MainPage className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        {error ?? "Community not found"}
      </MainPage>
    );
  }

  const active = campaigns.filter((c) => !isCampaignEndedByDate(c.display_ends_at));
  const past = campaigns.filter((c) => isCampaignEndedByDate(c.display_ends_at));

  return (
    <MainPage className="mx-auto max-w-2xl xl:max-w-3xl px-4 py-6">
      {/* Back */}
      <Link
        href="/communities"
        className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Communities
      </Link>

      {/* Community header */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-delulu-blue/10 text-lg font-black text-delulu-blue">
            {community.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1
              className="text-xl font-black text-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              {community.name}
            </h1>
            {community.description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{community.description}</p>
            ) : null}
          </div>
        </div>

        {active.length > 0 ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{active.length} active campaign{active.length !== 1 ? "s" : ""}</span>
          </div>
        ) : null}
      </div>

      {/* Active campaigns */}
      {active.length > 0 ? (
        <section>
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-foreground/50">
            Active campaigns
          </p>
          <div className="space-y-4">
            {active.map((c) => (
              <CampaignCard key={c.id} campaign={c} communitySlug={community.slug} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">No active campaigns</p>
          <p className="mt-1 text-xs text-muted-foreground">Check back soon for new challenges.</p>
        </div>
      )}

      {/* Past campaigns */}
      {past.length > 0 ? (
        <section className="mt-8">
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-foreground/50">
            Past campaigns
          </p>
          <div className="space-y-4">
            {past.map((c) => (
              <CampaignCard key={c.id} campaign={c} communitySlug={community.slug} />
            ))}
          </div>
        </section>
      ) : null}
    </MainPage>
  );
}
