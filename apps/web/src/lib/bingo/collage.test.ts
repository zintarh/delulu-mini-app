import { test } from "node:test";
import assert from "node:assert/strict";
import { collageColumns } from "@/lib/bingo/collage";

const sq = (states: ("filled" | "empty" | "missed")[]) => states.map((state, index) => ({ index, state }));
const colHeight = (col: { h: number }[], gap: number) => col.reduce((s, t) => s + t.h, 0) + gap * Math.max(0, col.length - 1);

test("photos lead, columns end level, score tile closes the card", () => {
  for (const states of [sq(["filled", "empty", "empty"]), sq(["filled", "filled", "filled", "empty", "empty", "empty", "missed"]), sq(["filled", "filled", "filled"])]) {
    const [a, b] = collageColumns(states, { withScore: true, gapRatio: 0.05 });
    assert.ok(Math.abs(colHeight(a, 0.05) - colHeight(b, 0.05)) < 1e-9);
    assert.equal([...a, ...b].filter((t) => t.kind === "score").length, 1);
    assert.equal([...a, ...b].filter((t) => t.kind !== "score").length, states.length);
    assert.equal(a[0].kind, "photo");
  }
});
