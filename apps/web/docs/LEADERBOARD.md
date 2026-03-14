# Leaderboard data

This doc explains how leaderboard data is loaded and what you need for it to display.

## Campaign leaderboard (per-campaign page)

**Where:** Campaign detail page (`/campaigns/[id]`) — "Leaderboard" section.

**Data source:** Subgraph query `GetDelulus` with:

- `where: { challengeId: "<id>" }` — only delulus that have joined this campaign
- `orderBy: "points"`, `orderDirection: "desc"`

**For the list to have rows:**

1. At least one delulu must have **joined** this campaign (on-chain `DeluluJoinedChallenge` event).
2. An admin must have **allocated points** to that delulu (on-chain `PointsAllocated` event).

**If you see "No participants yet":** No delulus have joined this campaign yet, or none have points. Have users join from a delulu page, then (as admin) allocate points from this campaign page.

**If you see "Failed to load leaderboard":** Check the browser console and ensure:

- `NEXT_PUBLIC_SUBGRAPH_URL_MAINNET` (or your chain’s subgraph URL) is set and the subgraph is deployed and synced.
- The subgraph schema includes `Delulu` with `challengeId` and `points` and supports filtering by `challengeId`.

---

## Creator leaderboard (global page)

**Where:** `/leaderboard` — "Creator leaderboard".

**Data source:** Subgraph query `CreatorLeaderboard` against the **CreatorStats** entity (exposed as `creatorStatses` in the API).

**For the list to have rows:**

1. The subgraph must be deployed with the **CreatorStats** entity in the schema and in the data source `entities` in `subgraph.yaml`.
2. At least one creator must have activity that updates CreatorStats, for example:
   - Creating a delulu (goal)
   - Having milestones verified
   - Resolving a delulu (completed/failed goals)
   - Receiving support (stakes)

**If you see "No creator stats yet":** The subgraph may not have indexed any CreatorStats yet, or no one has created/completed goals. Create a goal and complete milestones to appear.

**If you see "Failed to load leaderboard":** Check:

- Subgraph URL in env (e.g. `NEXT_PUBLIC_SUBGRAPH_URL_MAINNET`).
- That the subgraph schema defines **CreatorStats** and the GraphQL API exposes the collection. Standard graph-node pluralization uses **creatorStatses** for type `CreatorStats`. If your graph-node version uses a different name (e.g. `creatorStats_collection`), update the query in `useCreatorLeaderboard.ts` to match.
- That the subgraph has **CreatorStats** in the data source `entities` list in `subgraph.yaml` (so it is indexed).

---

## Routes

- Campaign list: `/campaigns`
- Campaign detail (and its leaderboard): `/campaigns/[id]`
- Creator leaderboard: `/leaderboard`

Links to campaign detail use `/campaigns/<id>`; avoid `/challenges/<id>` (no such route).
