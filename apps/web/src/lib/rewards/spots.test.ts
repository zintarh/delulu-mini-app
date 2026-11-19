import { test } from "node:test";
import assert from "node:assert/strict";
import { spotToTake } from "@/lib/rewards/spots";

test("a bigger Bingo takes the smallest smaller Bingo's spot — never a personal goal, an equal stake, or itself", () => {
  const held = [
    { id: "a", goalRef: "g1", bingoStake: 20_000 },
    { id: "b", goalRef: "g2", bingoStake: 10_000 },
    { id: "c", goalRef: "g3", bingoStake: null }, // personal goal
  ];
  assert.equal(spotToTake(held, 50_000)?.id, "b");
  assert.equal(spotToTake(held, 15_000)?.id, "b");
  assert.equal(spotToTake(held, 10_000), null);
  assert.equal(spotToTake(held, 5_000), null);
  assert.equal(spotToTake([{ id: "x", goalRef: "me", bingoStake: 1 }], 50_000, "me"), null);
});
