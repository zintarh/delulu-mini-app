"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Calendar,
  ChevronLeft,
  Clock,
  Loader2,
  Trophy,
  Users,
} from "lucide-react";
import { ProofModal } from "@/components/proof-modal";
import { cn, formatAddress } from "@/lib/utils";
import { isCampaignFunded } from "@/lib/community/campaign-types";

export type CommunityCampaignDetailData = {
  id: string;
  title: string;
  description: string | null;
  proof_instructions: string | null;
  proof_cadence: string;
  proposed_pool_amount: number;
  cover_image_url: string | null;
  status: string;
  display_ends_at: string | null;
  duration_days: number;
  prize_winner_count: number;
  communities?: {
    name: string;
    slug: string;
    description: string | null;
    owner_name: string | null;
  };
};

export type CampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
  points_total: number;
  is_community_member: boolean;
};

function formatEndsAt(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cadenceLabel(cadence: string) {
  return cadence === "weekly" ? "Weekly" : "Daily";
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

export function CommunityCampaignDetail({
  campaign,
  communitySlug,
  leaderboard,
  participantCount,
  isJoined,
  isCommunityMember,
  address,
  authenticated,
  joining,
  myPoints,
  proofOpen,
  proofBusy,
  proofSuccess,
  proofError,
  actionError,
  onJoin,
  onOpenProof,
  onProofOpenChange,
  onProofSubmit,
  onProofDone,
}: {
  campaign: CommunityCampaignDetailData;
  communitySlug: string;
  leaderboard: CampaignLeaderboardRow[];
  participantCount: number;
  isJoined: boolean;
  isCommunityMember: boolean;
  address: string | undefined;
  authenticated: boolean;
  joining: boolean;
  myPoints: number;
  proofOpen: boolean;
  proofBusy: boolean;
  proofSuccess: boolean;
  proofError: string | null;
  actionError: string | null;
  onJoin: () => void;
  onOpenProof: () => void;
  onProofOpenChange: (open: boolean) => void;
  onProofSubmit: (imageUrl: string) => void;
  onProofDone: () => void;
}) {
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const funded = isCampaignFunded(campaign.status);
  const endsLabel = formatEndsAt(campaign.display_ends_at);
  const topN = campaign.prize_winner_count ?? 10;
  const myRank = address
    ? leaderboard.find((r) => r.wallet_address.toLowerCase() === address.toLowerCase())
    : undefined;
  const inPrizeZone = myRank ? myRank.rank <= topN : false;
  const showClaimNote = inPrizeZone && isJoined && !isCommunityMember && funded;

  const stats: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Clock, label: "Submit proof", value: cadenceLabel(campaign.proof_cadence) },
    {
      icon: Calendar,
      label: "Ends",
      value: endsLabel ?? `${campaign.duration_days ?? 30} days`,
    },
    { icon: Users, label: "Top winners", value: `Top ${topN}` },
  ];

  if (funded && campaign.proposed_pool_amount > 0) {
    stats.unshift({
      icon: Trophy,
      label: "Prize pool",
      value: `${campaign.proposed_pool_amount} G$`,
    });
  }

  return (
    <>
      <main className="mx-auto max-w-2xl pb-28">
        {/* Hero */}
        <div className="relative">
          {campaign.cover_image_url ? (
            <div className="relative h-44 w-full sm:h-48">
              <Image
                src={campaign.cover_image_url}
                alt=""
                fill
                className="object-cover"
                unoptimized
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
            </div>
          ) : (
            <div className="h-24 bg-gradient-to-br from-delulu-blue-light to-delulu-blue/20" />
          )}

          <div
            className={cn(
              "px-4",
              campaign.cover_image_url ? "absolute inset-x-0 bottom-0 pb-4" : "pt-4",
            )}
          >
            <Link
              href={`/communities/${communitySlug}`}
              className={cn(
                "mb-3 inline-flex items-center gap-1 text-xs font-semibold",
                campaign.cover_image_url
                  ? "text-white/90 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {campaign.communities?.name ?? "Community"}
            </Link>
            <h1
              className={cn(
                "text-xl font-bold leading-tight sm:text-2xl",
                campaign.cover_image_url ? "text-white" : "text-foreground",
              )}
            >
              {campaign.title}
            </h1>
            {campaign.description ? (
              <p
                className={cn(
                  "mt-1.5 text-sm line-clamp-2",
                  campaign.cover_image_url ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {campaign.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="px-4 pt-4">
          {/* Stats */}
          <div
            className={cn(
              "grid gap-2",
              stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
            )}
          >
            {stats.map((stat) => (
              <InfoTile key={stat.label} {...stat} />
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="mt-4 hidden sm:flex flex-wrap items-center gap-2">
            {!authenticated ? (
              <p className="text-sm text-muted-foreground">Sign in to join this campaign.</p>
            ) : isJoined ? (
              <>
                <button
                  type="button"
                  onClick={onOpenProof}
                  className="rounded-xl bg-delulu-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-delulu-blue/90"
                >
                  Submit proof
                </button>
                {myPoints > 0 ? (
                  <span className="inline-flex items-center rounded-xl bg-delulu-blue-light px-3 py-2 text-sm font-semibold text-delulu-blue">
                    {myPoints} pts
                  </span>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                disabled={joining}
                onClick={onJoin}
                className="rounded-xl bg-delulu-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-delulu-blue/90 disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join campaign"}
              </button>
            )}
          </div>

          {actionError ? <p className="mt-3 text-xs text-destructive">{actionError}</p> : null}

          {/* Leaderboard */}
          <div ref={leaderboardRef} className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Trophy className="h-4 w-4 text-delulu-blue" />
                Leaderboard
              </h2>
              <span className="text-xs text-muted-foreground">
                {participantCount} participant{participantCount !== 1 ? "s" : ""} · top {topN} win
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No participants yet. Be the first to join.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                {leaderboard.map((row) => {
                  const isMe = address?.toLowerCase() === row.wallet_address.toLowerCase();
                  const inZone = row.rank <= topN;
                  return (
                    <li
                      key={row.wallet_address}
                      className={cn(
                        "flex items-center justify-between gap-2 px-4 py-3 text-sm",
                        isMe && "bg-delulu-blue-light/40",
                        inZone && !isMe && "bg-[#fffbeb]/50",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "w-6 shrink-0 text-xs font-bold tabular-nums",
                            inZone ? "text-[#9a7b0a]" : "text-muted-foreground",
                          )}
                        >
                          {row.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs truncate">
                              {isMe ? "You" : formatAddress(row.wallet_address)}
                            </span>
                            {row.is_community_member ? (
                              <span className="rounded-full bg-delulu-blue-light px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-delulu-blue">
                                Member
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 font-bold tabular-nums">{row.points_total}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {showClaimNote ? (
              <p className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                You&apos;re in the prize zone. Join{" "}
                <Link
                  href={`/communities/${communitySlug}`}
                  className="font-semibold text-delulu-blue hover:underline"
                >
                  {campaign.communities?.name}
                </Link>{" "}
                before claiming your share when payouts go live.
              </p>
            ) : null}
          </div>

          {/* Details */}
          <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-3 text-sm space-y-2">
            <p className="text-foreground">
              <span className="font-semibold">Prize split:</span> Pool shared among top {topN} on
              the leaderboard when the campaign ends.
            </p>
            {campaign.proof_instructions ? (
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">What to submit:</span>{" "}
                {campaign.proof_instructions}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Top winners must join the community before claiming. Points and leaderboard are live
              now.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 pb-4 text-sm">
            <span className="text-muted-foreground">Hosted by</span>
            <Link
              href={`/communities/${communitySlug}`}
              className="font-semibold text-delulu-blue hover:underline"
            >
              {campaign.communities?.name}
            </Link>
            {campaign.communities?.owner_name ? (
              <span className="text-muted-foreground">· {campaign.communities.owner_name}</span>
            ) : null}
          </div>
        </div>
      </main>

      {/* Mobile sticky CTA */}
      {authenticated ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:hidden">
          {isJoined ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProof}
                className="flex-1 rounded-xl bg-delulu-blue py-3 text-sm font-bold text-white"
              >
                Submit proof
              </button>
              {myPoints > 0 ? (
                <span className="rounded-xl bg-delulu-blue-light px-3 py-3 text-sm font-bold text-delulu-blue tabular-nums">
                  {myPoints} pts
                </span>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={joining}
              onClick={onJoin}
              className="w-full rounded-xl bg-delulu-blue py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {joining ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Joining…
                </span>
              ) : (
                "Join campaign"
              )}
            </button>
          )}
        </div>
      ) : null}

      <ProofModal
        open={proofOpen}
        onOpenChange={onProofOpenChange}
        onSubmit={onProofSubmit}
        isSubmitting={proofBusy}
        submitSuccess={proofSuccess}
        submitError={proofError ? new Error(proofError) : null}
        onDone={onProofDone}
      />
    </>
  );
}
