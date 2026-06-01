import type { FormattedDelulu } from "@/lib/types";

export const FEED_ROW_LIMIT = 10;

export type FeedCategoryId = "on-a-roll" | "for-you" | "worth-a-look";

export interface FeedCategory {
  id: FeedCategoryId;
  title: string;
  seeMoreHref: string;
  items: FormattedDelulu[];
}

/** Milestone fields present on FormattedDeluluFeed but not the base type. */
interface WithMilestones {
  feedMilestones?: { isVerified: boolean }[];
  totalMilestoneCount?: number;
}

/** Support amount shown on cards (tips + stake fallback). */
export function getDeluluSupportAmount(d: FormattedDelulu): number {
  const received = d.totalSupportCollected ?? 0;
  const fallback = d.totalStake ?? 0;
  return received > 0 ? received : fallback;
}

/** Returns [verifiedCount, totalCount] using feed-level milestone data. */
function getMilestoneProgress(d: FormattedDelulu): [number, number] {
  const m = d as FormattedDelulu & WithMilestones;
  const total = m.totalMilestoneCount ?? m.feedMilestones?.length ?? 0;
  const verified = m.feedMilestones?.filter((ms) => ms.isVerified).length ?? 0;
  return [verified, total];
}

/**
 * Score for "for you": ratio first (6/7 beats 2/3), then absolute verified
 * count (6/7 beats 5/6). Items with 0 verified milestones return -1 (excluded).
 */
function forYouScore(d: FormattedDelulu): number {
  const [verified, total] = getMilestoneProgress(d);
  if (verified === 0 || total === 0) return -1;
  const ratio = verified / total;
  return ratio * 1000 + verified;
}

/** Newest delulus first for "on a roll"; slightly deprioritize viewer's own. */
function latestScore(d: FormattedDelulu, viewerAddress?: string): number {
  const recency = d.createdAt?.getTime() ?? 0;
  const isOwn =
    viewerAddress &&
    d.creator.toLowerCase() === viewerAddress.toLowerCase();
  return recency - (isOwn ? 10 ** 15 : 0);
}

export function buildFeedCategories(
  delulus: FormattedDelulu[],
  viewerAddress?: string,
): FeedCategory[] {
  const pool = [...delulus];
  const used = new Set<number>();

  const take = (sorted: FormattedDelulu[]): FormattedDelulu[] => {
    const out: FormattedDelulu[] = [];
    for (const d of sorted) {
      if (out.length >= FEED_ROW_LIMIT) break;
      if (used.has(d.id)) continue;
      used.add(d.id);
      out.push(d);
    }
    return out;
  };

  const onARoll = take(
    [...pool].sort(
      (a, b) => latestScore(b, viewerAddress) - latestScore(a, viewerAddress),
    ),
  );

  const forYou = take(
    [...pool]
      .filter((d) => forYouScore(d) >= 0)
      .sort((a, b) => forYouScore(b) - forYouScore(a)),
  );

  const worthALook = take(
    [...pool].sort((a, b) => {
      const supportersDelta =
        (b.totalSupporters ?? 0) - (a.totalSupporters ?? 0);
      if (supportersDelta !== 0) return supportersDelta;
      return getDeluluSupportAmount(b) - getDeluluSupportAmount(a);
    }),
  );

  return [
    {
      id: "on-a-roll",
      title: "On a roll 🔥",
      seeMoreHref: "/search",
      items: onARoll,
    },
    {
      id: "for-you",
      title: "For you",
      seeMoreHref: "/search",
      items: forYou,
    },
    {
      id: "worth-a-look",
      title: "Worth a look",
      seeMoreHref: "/search",
      items: worthALook,
    },
  ];
}
