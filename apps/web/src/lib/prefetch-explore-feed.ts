
let feedPrefetch: Promise<unknown> | null = null;

export function prefetchExploreFeed(): void {
  if (typeof window === "undefined") return;
  if (feedPrefetch) return;

  feedPrefetch = import("@/lib/apollo-client")
    .then(({ apolloClient }) =>
      import("@/lib/explore-feed-query").then(
        ({ GET_DELULUS_FEED, EXPLORE_FEED_PAGE_SIZE }) =>
          apolloClient.query({
            query: GET_DELULUS_FEED,
            variables: { first: EXPLORE_FEED_PAGE_SIZE, skip: 0 },
            fetchPolicy: "cache-first",
          }),
      ),
    )
    .catch(() => {})
    .finally(() => {
      feedPrefetch = null;
    });
}

export function prefetchExploreOnIntent(): void {
  if (typeof window === "undefined") return;
  prefetchExploreFeed();
  void import("@/components/lazy-explore-pin-card");
  void import("@/components/explore-social-feed");
}
