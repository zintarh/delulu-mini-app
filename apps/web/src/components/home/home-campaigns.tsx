"use client";

import Link from "next/link";
import { ActiveCampaignsSection } from "@/components/active-campaigns-section";
import {
  CampaignTicketRow,
  CampaignTicketRowSkeleton,
  isCampaignOpen,
  type CampaignExploreCardData,
} from "@/components/community/campaign-explore-card";
import { MonoLabel } from "@/components/ds";
import { feedItemToCardData } from "@/components/home-campaigns-section";
import { useExploreCampaigns } from "@/hooks/use-explore-campaigns";
import { useHomeCampaignsFeed } from "@/hooks/use-home-campaigns-feed";
import { useJoinedCampaignDashboard } from "@/hooks/use-user-campaign-milestones";

/** Open campaigns shown when there's room (no forfeits yet). */
const EXPANDED_LIMIT = 5;
/** Open campaigns shown under today's quests. */
const COMPACT_LIMIT = 3;
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

function OpenCampaigns({ campaigns, limit, heading }: { campaigns: CampaignExploreCardData[]; limit: number; heading: string }) {
  if (campaigns.length === 0) return null;
  const visible = campaigns.slice(0, limit);
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <MonoLabel>{heading}</MonoLabel>
        <Link href="/explore" className="text-[11px] font-semibold text-blue no-underline">
          {campaigns.length > visible.length ? "See all" : "Explore"}
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((c, i) => (
          <CampaignTicketRow key={c.id} campaign={c} index={i} />
        ))}
      </div>
    </section>
  );
}

/**
 * Campaigns on Home:
 * - joined any → just yours, as quest rows you can prove from here;
 * - joined none → open campaigns to join;
 * - no forfeits yet → open campaigns get the room the empty quest card used
 *   to take (more of them, and alongside yours if you've joined some).
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
        <div className="mb-2.5 h-3 w-28 animate-pulse rounded bg-line" />
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <CampaignTicketRowSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }
  if (!lists.hasAny) return null;

  const joined = address && lists.joinedCount > 0;
  const showOpen = !joined || noForfeits;
  const limit = noForfeits ? EXPANDED_LIMIT : COMPACT_LIMIT;

  return (
    <div className="flex flex-col gap-5">
      {joined ? <ActiveCampaignsSection address={address} variant="quest" heading="Your campaigns" showMax={5} /> : null}
      {showOpen ? (
        <OpenCampaigns
          campaigns={lists.open}
          limit={limit}
          heading={joined ? "More campaigns" : "Join a campaign"}
        />
      ) : null}
    </div>
  );
}
