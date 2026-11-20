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
  SEASON_EPOCHS,
} from "@/lib/referral/campaign";

test("referral rounds: weekly, Tuesday to Tuesday, back to back, Lagos midnights; 6 epochs end on demo days", () => {
  assert.equal(REFERRAL_ROUNDS.length, 12);
  assert.deepEqual(SEASON_EPOCHS.map((e) => e.demoDay), ["2026-12-01", "2026-12-15", "2026-12-29", "2027-01-12", "2027-01-26", "2027-02-09"]);
  for (const e of SEASON_EPOCHS) assert.equal(new Date(`${e.demoDay}T12:00:00Z`).getUTCDay(), 2, `demo day ${e.demoDay} is a Tuesday`);
  for (const [i, r] of REFERRAL_ROUNDS.entries()) {
    assert.equal(Date.parse(r.end) - Date.parse(r.start), 7 * 86_400_000, `round ${i} is 7 days`);
    assert.match(r.start, /T00:00:00\+01:00$/);
    if (i > 0) assert.equal(r.start, REFERRAL_ROUNDS[i - 1].end, "no gap between rounds");
  }
});

test("round 1 starts Tue 17 Nov at Lagos midnight and pays 10,000 G$ up to its spots", () => {
  assert.equal(currentReferralRound(new Date("2026-11-16T22:59:59Z")), null);
  const r1 = currentReferralRound(new Date("2026-11-16T23:00:00Z"));
  assert.ok(r1);
  assert.equal(r1.reward, 10_000);
  assert.equal(roundCapacity(r1), r1.slots);
  assert.equal(currentReferralRound(new Date("2026-11-23T22:59:59Z")), r1);
  assert.equal(currentReferralRound(new Date("2026-11-23T23:00:00Z")), REFERRAL_ROUNDS[1]);
  assert.equal(isReferralCampaignLive(new Date("2027-02-08T23:00:00Z")), false);
});

test("a credit pays at its own round's reward, also after that round ends", () => {
  assert.equal(referralRoundAt("2026-11-20T10:00:00Z")?.start, REFERRAL_ROUNDS[0].start);
  assert.equal(referralRoundAt("2026-09-20T10:00:00Z"), null); // old Sep programme stays closed
  assert.equal(isInCurrentReferralCampaign("2026-11-01T00:00:00Z"), false);
  assert.equal(isInCurrentReferralCampaign("2026-11-17T09:00:00+01:00"), true);
  assert.equal(isInCurrentReferralCampaign("2026-11-18T09:00:00+01:00"), true);
  assert.equal(referralRewardNow(new Date("2026-11-17T12:00:00Z")), 10_000);
});
