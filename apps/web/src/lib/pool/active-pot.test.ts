import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_POT, potShares, ticketsFor } from "@/lib/pool/active-pot";

const week = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];
const p = (wallet: string, stake: number, newcomer: boolean, days = week) => ({ wallet, stake, newcomer, days });

test("only players who kept all 7 days share", () => {
  const s = potShares({ potG: 1_000_000, players: [p("a", 1000, false), p("b", 1000, false, week.slice(0, 6))] }, 7);
  assert.equal(s.size, 1);
  assert.equal(s.get("a"), 1_000_000);
});

test("tickets: steep to 1,000, flatter above; new players double", () => {
  assert.equal(ticketsFor(50, false), 0);
  assert.equal(ticketsFor(100, false), 1);
  assert.equal(ticketsFor(1_000, false), 5);
  assert.equal(ticketsFor(1_000, true), 10);
  assert.equal(ticketsFor(5_000, false), 10);
  assert.equal(ticketsFor(1_000_000, false), 20);
});

test("shares follow tickets: a new player at 1,000 matches a regular at 5,000", () => {
  const s = potShares({ potG: 1_000_000, players: [p("new", 1_000, true), p("old", 5_000, false)] }, 7);
  assert.equal(s.get("new"), 500_000);
  assert.equal(s.get("old"), 500_000);
  assert.equal(ACTIVE_POT.newcomerMultiplier, 2);
});

test("never pays more than the pot", () => {
  const players = Array.from({ length: 37 }, (_, i) => p(`w${i}`, 100 + i * 137, i % 3 === 0));
  const s = potShares({ potG: 1_000_000, players }, 7);
  assert.ok([...s.values()].reduce((n, v) => n + v, 0) <= 1_000_000);
});
