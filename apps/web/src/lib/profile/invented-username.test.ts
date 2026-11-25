import assert from "node:assert/strict";
import test from "node:test";
import { hasChosenUsername, isInventedUsername } from "@/lib/profile/invented-username";

const address = "0xAbCdef1234567890abcdef1234567890abcDEF12";

test("the made-up player name matches the address, in any case", () => {
  assert.equal(isInventedUsername(address, "playerabcdef"), true);
  assert.equal(isInventedUsername(address, "PlayerABCDEF"), true);
  assert.equal(hasChosenUsername(address, "playerabcdef"), false);
  assert.equal(hasChosenUsername(address, ""), false);
  assert.equal(hasChosenUsername(address, "   "), false);
});

test("a name the person chose is not the made-up one", () => {
  assert.equal(isInventedUsername(address, "ada"), false);
  assert.equal(isInventedUsername(address, "playerzzzzzz"), false);
  assert.equal(hasChosenUsername(address, "ada"), true);
});
