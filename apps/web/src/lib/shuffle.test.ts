import { test } from "node:test";
import assert from "node:assert/strict";
import { seededShuffle, shuffleWindow } from "@/lib/shuffle";

test("seeded shuffle: stable within a window, changes across windows, keeps every item", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g"];
  assert.deepEqual(seededShuffle(items, "x:1"), seededShuffle(items, "x:1"));
  assert.notDeepEqual(seededShuffle(items, "x:1"), seededShuffle(items, "x:2"));
  assert.deepEqual([...seededShuffle(items, "x:3")].sort(), items);
  const t = Date.parse("2026-11-19T10:00:00Z");
  assert.equal(shuffleWindow(6, t), shuffleWindow(6, t + 3_600_000));
  assert.notEqual(shuffleWindow(6, t), shuffleWindow(6, t + 6 * 3_600_000));
});
