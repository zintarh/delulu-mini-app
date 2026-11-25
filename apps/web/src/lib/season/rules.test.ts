import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOW_STAKE_POINTS,
  SEASON_2_START_MS,
  canPledgeWord,
  isDurationAllowed,
  minStakeFor,
  seasonPointsForStake,
  stakeTierFor,
} from "@/lib/season/rules";

const DAY = 86_400_000;
const live = SEASON_2_START_MS + DAY;
const before = SEASON_2_START_MS - DAY;

test("points scale with stake, token points under 1k, capped at a 100k stake", () => {
  assert.equal(seasonPointsForStake(0), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(100), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(999), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(1_000), 100);
  assert.equal(seasonPointsForStake(2_500), 250);
  assert.equal(seasonPointsForStake(5_000), 500);
  assert.equal(seasonPointsForStake(10_000), 1_000);
  assert.equal(seasonPointsForStake(20_000), 2_000);
  assert.equal(seasonPointsForStake(100_000), 10_000);
  assert.equal(seasonPointsForStake(500_000), 10_000);
});

test("newcomer for 2 weeks unless they pass 20 proofs or 20 days", () => {
  const fresh = { firstSeenMs: live - 3 * DAY, acceptedProofs: 4, activeDays: 3 };
  assert.equal(stakeTierFor(fresh, live), "newcomer");
  assert.equal(stakeTierFor({ ...fresh, firstSeenMs: live - 14 * DAY }, live), "regular");
  assert.equal(stakeTierFor({ ...fresh, acceptedProofs: 21 }, live), "regular");
  assert.equal(stakeTierFor({ firstSeenMs: null, acceptedProofs: 0, activeDays: 0 }, live), "newcomer");
});

test("minimums and word pledges only bite once the season is live", () => {
  assert.equal(minStakeFor("regular", before), 0);
  assert.equal(minStakeFor("regular", live), 1_000);
  assert.equal(minStakeFor("newcomer", live), 1_000); // First Week (100) and 3-day Bingos are exempt
  assert.equal(canPledgeWord("regular", before), true);
  assert.equal(canPledgeWord("regular", live), false);
  assert.equal(canPledgeWord("newcomer", live), true);
});

test("7-day cap", () => {
  assert.equal(isDurationAllowed(7, live), true);
  assert.equal(isDurationAllowed(8, live), false);
  assert.equal(isDurationAllowed(30, before), true);
});

test("Season 2 points start Sat 21 Nov (WAT), two days before the stake rules", async () => {
  const { SEASON_2_POINTS_START_MS, isSeason2PointsLive } = await import("@/lib/season/rules");
  assert.equal(new Date(SEASON_2_POINTS_START_MS).toISOString(), "2026-11-20T23:00:00.000Z");
  assert.equal(SEASON_2_START_MS - SEASON_2_POINTS_START_MS, 2 * DAY);
  assert.equal(isSeason2PointsLive(SEASON_2_POINTS_START_MS), true);
  assert.equal(isSeason2PointsLive(SEASON_2_POINTS_START_MS - 1), false);
  // Stake minimum still waits for Monday.
  assert.equal(minStakeFor("regular", SEASON_2_POINTS_START_MS + DAY), 0);
});
