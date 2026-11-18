import { test } from "node:test";
import assert from "node:assert/strict";
import { slotsLine } from "@/lib/referral/slots-copy";

const base = { live: true, start: "s", end: "e", used: 0, nextStart: "n", nextSlots: 30, reward: 5000 };
test("spots copy: left this week, growing weekly; full → when the new spots come", () => {
  assert.match(slotsLine({ ...base, slots: 30, used: 18, left: 12 })!, /^12 of 30 spots left · more every Tuesday$/);
  assert.match(slotsLine({ ...base, slots: 30, used: 30, left: 0 })!, /^All spots taken — 30 new spots /);
  assert.equal(slotsLine({ ...base, live: false, slots: 0, left: 0 }), null);
});
