import { test } from "node:test";
import assert from "node:assert/strict";
import { keptDayOfResolutions, topUpsThrough } from "@/lib/community/campaign-subgraph";

const r = (id: string, commitmentId: string, createdAt: number, periodIndex: number) => ({ id, commitmentId, createdAt: String(createdAt), periodIndex });

test("kept day is the emitted periodIndex − 1, and the repeated index on the final day is that day", () => {
  // Real card 430 (7 days): the subgraph holds 1,2,3,4,5,6,6.
  const rows = [1, 2, 3, 4, 5, 6, 6].map((p, i) => r(`t${i}`, "430", 100 + i, p));
  const days = keptDayOfResolutions(rows);
  assert.deepEqual(rows.map((x) => days.get(x.id)), [0, 1, 2, 3, 4, 5, 6]);
  // Cards don't mix: another card's day 0 is still day 0.
  assert.equal(keptDayOfResolutions([r("a", "530", 1, 1), r("b", "933", 2, 1)]).get("b"), 0);
});

test("top-ups count from their day on, never backwards", () => {
  const ups = [{ slot: 1, amount: 9_000 }, { slot: 3, amount: 500 }];
  assert.equal(topUpsThrough(ups, 0), 0);
  assert.equal(topUpsThrough(ups, 1), 9_000);
  assert.equal(topUpsThrough(ups, 2), 9_000);
  assert.equal(topUpsThrough(ups, 3), 9_500);
  assert.equal(topUpsThrough(undefined, 5), 0);
});
