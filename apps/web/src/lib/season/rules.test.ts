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

test("points scale with stake, token points under 5k, capped at 50k", () => {
  assert.equal(seasonPointsForStake(0), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(1_000), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(4_999), LOW_STAKE_POINTS);
  assert.equal(seasonPointsForStake(5_000), 500);
  assert.equal(seasonPointsForStake(10_000), 1_000);
  assert.equal(seasonPointsForStake(20_000), 2_000);
  assert.equal(seasonPointsForStake(500_000), 5_000);
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
  assert.equal(minStakeFor("regular", live), 5_000);
  assert.equal(minStakeFor("newcomer", live), 5_000); // First Week is the only 1k way in (exempt)
  assert.equal(canPledgeWord("regular", before), true);
  assert.equal(canPledgeWord("regular", live), false);
  assert.equal(canPledgeWord("newcomer", live), true);
});

test("7-day cap", () => {
  assert.equal(isDurationAllowed(7, live), true);
  assert.equal(isDurationAllowed(8, live), false);
  assert.equal(isDurationAllowed(30, before), true);
});
