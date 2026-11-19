import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreCards } from "@/lib/bingo/cheers";

test("many people beat one big wallet", () => {
  const crowd = Array.from({ length: 10 }, (_, i) => ({ attemptId: "crowd", fromWallet: `v${i}`, amount: 100 }));
  const whale = [{ attemptId: "whale", fromWallet: "rich", amount: 5_000 }];
  const [first, second] = scoreCards([...crowd, ...whale]);
  assert.equal(first.attemptId, "crowd");
  assert.equal(first.score, 10);
  assert.equal(first.voters, 10);
  assert.equal(second.attemptId, "whale");
  assert.equal(second.score, 7.1);
  // Same voter cheering twice adds G$ under one square root, not two.
  const twice = scoreCards([{ attemptId: "c", fromWallet: "a", amount: 100 }, { attemptId: "c", fromWallet: "a", amount: 300 }]);
  assert.equal(twice[0].score, 2);
  assert.equal(twice[0].cheers, 2);
});
