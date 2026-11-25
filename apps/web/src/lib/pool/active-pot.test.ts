import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_POT, potShares, ticketsFor } from "@/lib/pool/active-pot";

test("the pool players share is 1,000,000 G$ a week", () => {
  assert.equal(ACTIVE_POT.weeklyG, 1_000_000);
});

const week = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];
const p = (wallet: string, stake: number, newcomer: boolean, days = week) => ({ wallet, stake, newcomer, days });

test("only players who kept all 7 days share", () => {
  const s = potShares({ potG: 1_000_000, players: [p("a", 1000, false), p("b", 1000, false, week.slice(0, 6))] }, 7);
  assert.equal(s.size, 1);
  assert.equal(s.get("a"), 1_000_000);
});

test("tickets: new players earn for being active; returning players need 1,000+ and earn more higher up", () => {
  assert.equal(ticketsFor(0, true), 0); // must be on a staked card
  assert.equal(ticketsFor(100, true), 5); // new: active is enough
  assert.equal(ticketsFor(5_000, true), 15); // new players still gain from staking more
  assert.equal(ticketsFor(100, false), 0); // returning: below 1,000 isn't in the pot
  assert.equal(ticketsFor(1_000, false), 5);
  assert.equal(ticketsFor(2_500, false), 10);
  assert.equal(ticketsFor(1_000_000, false), 40);
});

test("a new player at 100 matches a returning player at 1,000", () => {
  const s = potShares({ potG: 1_000_000, players: [p("new", 100, true), p("old", 1_000, false)] }, 7);
  assert.equal(s.get("new"), 500_000);
  assert.equal(s.get("old"), 500_000);
  assert.equal(ACTIVE_POT.newcomerTickets, 5);
});

test("never pays more than the pot", () => {
  const players = Array.from({ length: 37 }, (_, i) => p(`w${i}`, 100 + i * 137, i % 3 === 0));
  const s = potShares({ potG: 1_000_000, players }, 7);
  assert.ok([...s.values()].reduce((n, v) => n + v, 0) <= 1_000_000);
});
