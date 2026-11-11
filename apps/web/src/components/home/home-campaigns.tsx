"use client";

import Link from "next/link";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import {
  CampaignBannerCard,
  CampaignBannerCardSkeleton,
  isCampaignOpen,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/ds";
import { feedItemToCardData } from "@/components/home-campaigns-section";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";
import { useHomeCampaignsFeed } from "@/hooks/use-home-campaigns-feed";
import { useJoinedCampaignDashboard } from "@/hooks/use-user-campaign-milestones";

/** Open campaigns shown when there's room (no forfeits yet). */
const EXPANDED_LIMIT = 6;
/** Open campaigns shown under today's quests. */
const COMPACT_LIMIT = 4;
/** Fetch one past the cap so we know whether "See all" has more behind it. */
const FETCH_LIMIT = EXPANDED_LIMIT + 1;

export type HomeCampaignLists = {
  isLoading: boolean;
  joinedCount: number;
  open: CampaignExploreCardData[];
  /** Anything at all to show — when false, Home falls back to the forfeit empty state. */
  hasAny: boolean;
};

/**
 * Campaign data for Home. Joined = active campaigns you're in (ended ones are
 * already excluded); open = joinable ones you're not in. A failed request
 * counts as empty, so Home degrades to its normal empty state, never a gap.
 */
export function useHomeCampaignLists(address: string | undefined): HomeCampaignLists {
  const joined = useJoinedCampaignDashboard(address);
  const feed = useHomeCampaignsFeed("ongoing", address, "participants", FETCH_LIMIT);
  // Guests have no address for the personal feed; the public list has the same campaigns.
  const guest = useExploreCampaigns(undefined, "participants", undefined, !address);

  if (!address) {
    const open = (guest.data?.pages.flatMap((p) => p.campaigns) ?? []).filter(isCampaignOpen);
    return { isLoading: guest.isLoading, joinedCount: 0, open, hasAny: open.length > 0 };
  }

  const joinedCount = joined.data?.length ?? 0;
  const open = (feed.data?.pages.flatMap((p) => p.campaigns) ?? []).map(feedItemToCardData);
  return {
    isLoading: joined.isLoading || feed.isLoading,
    joinedCount,
    open,
    hasAny: joinedCount > 0 || open.length > 0,
  };
}

/** Phones: a swipe row bleeding to the edges (next card peeks in). Tablet up: a 2-up grid. */
const CARD_ROW_CLASS =
  "scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0";
const CARD_IN_ROW_CLASS = "w-[86%] shrink-0 snap-start sm:w-full";

function OpenCampaigns({ campaigns, limit, heading }: { campaigns: CampaignExploreCardData[]; limit: number; heading: string }) {
  if (campaigns.length === 0) return null;
  const visible = campaigns.slice(0, limit);
  return (
    <section>
      <SectionHeading action={<Link href="/explore">{campaigns.length > visible.length ? "See all →" : "Explore →"}</Link>}>
        {heading}
      </SectionHeading>
      {/* One line of context for people who don't know what a campaign is yet. */}
      <p className="m-0 -mt-1 mb-3 text-sm leading-snug text-muted-foreground">
        Join others on a challenge.
        {/* Desktop: two short lines instead of one long one. */}
        <br className="hidden sm:inline" />{" "}
        <span className="lg:whitespace-nowrap">
          Prove it with a photo each day, keep your streak, and climb the leaderboard together.
        </span>
      </p>
      {visible.length === 1 ? (
        <div className="sm:grid sm:grid-cols-2 sm:gap-4">
          <CampaignBannerCard campaign={visible[0]!} className="w-full" />
        </div>
      ) : (
        <div className={CARD_ROW_CLASS}>
          {visible.map((c) => (
            <CampaignBannerCard key={c.id} campaign={c} className={CARD_IN_ROW_CLASS} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Campaigns on Home:
 * - yours first (joined, active), as cards you can prove from;
 * - then recommended ones — always, as long as there's any campaign you
 *   haven't joined (the feed already leaves joined ones out). It only goes
 *   away when there's nothing left to recommend.
 * - no forfeits yet → recommended gets more room (the empty quest card's).
 */
export function HomeCampaigns({
  address,
  lists,
  noForfeits,
}: {
  address: string | undefined;
  lists: HomeCampaignLists;
  noForfeits: boolean;
}) {
  if (lists.isLoading) {
    return (
      <section role="status" aria-label="Loading campaigns">
        <div className="mb-3 h-6 w-52 animate-pulse rounded-lg bg-ink/10" />
        <div className="-mx-5 flex gap-3 overflow-hidden px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:px-0">
          {[0, 1].map((i) => (
            <CampaignBannerCardSkeleton key={i} className={cn("w-[86%] shrink-0 sm:w-full")} />
          ))}
        </div>
      </section>
    );
  }
  if (!lists.hasAny) return null;

  const joined = address && lists.joinedCount > 0;
  const showOpen = lists.open.length > 0;
  const limit = noForfeits ? EXPANDED_LIMIT : COMPACT_LIMIT;

  return (
    <div className="flex flex-col gap-10">
      {joined ? <ActiveCampaignsSection address={address} variant="quest" heading="Your campaigns" showMax={5} /> : null}
      {showOpen ? (
        <OpenCampaigns
          campaigns={lists.open}
          limit={limit}
          heading="Recommended campaigns"
        />
      ) : null}
    </div>
  );
}
