import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERRAL_ROUNDS,
  currentReferralRound,
  isReferralCampaignLive,
  isInCurrentReferralCampaign,
  referralRoundAt,
  referralRewardNow,
  roundCapacity,
} from "@/lib/referral/campaign";

test("referral rounds: 7 days each, back to back, Lagos midnights", () => {
  for (const [i, r] of REFERRAL_ROUNDS.entries()) {
    assert.equal(Date.parse(r.end) - Date.parse(r.start), 7 * 86_400_000, `round ${i} is 7 days`);
    assert.match(r.start, /T00:00:00\+01:00$/);
    if (i > 0) assert.equal(r.start, REFERRAL_ROUNDS[i - 1].end, "no gap between rounds");
  }
});

test("round 1 starts tomorrow at Lagos midnight and pays 5,000 G$ up to its budget", () => {
  assert.equal(currentReferralRound(new Date("2026-11-17T22:59:59Z")), null);
  const r1 = currentReferralRound(new Date("2026-11-17T23:00:00Z"));
  assert.ok(r1);
  assert.equal(r1.reward, 5000);
  assert.equal(roundCapacity(r1), Math.floor(r1.budget / 5000));
  assert.equal(currentReferralRound(new Date("2026-11-24T22:59:59Z")), r1);
  assert.equal(currentReferralRound(new Date("2026-11-24T23:00:00Z")), REFERRAL_ROUNDS[1]);
  assert.equal(isReferralCampaignLive(new Date("2026-12-01T23:00:00Z")), false);
});

test("a credit pays at its own round's reward, also after that round ends", () => {
  assert.equal(referralRoundAt("2026-11-20T10:00:00Z")?.start, REFERRAL_ROUNDS[0].start);
  assert.equal(referralRoundAt("2026-09-20T10:00:00Z"), null); // old Sep programme stays closed
  assert.equal(isInCurrentReferralCampaign("2026-11-01T00:00:00Z"), false);
  assert.equal(isInCurrentReferralCampaign("2026-11-18T09:00:00+01:00"), true);
  assert.equal(referralRewardNow(new Date("2026-11-17T12:00:00Z")), 5000);
});
