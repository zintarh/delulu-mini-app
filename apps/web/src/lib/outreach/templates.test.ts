import test from "node:test";
import assert from "node:assert/strict";
import { OUTREACH_TEMPLATES, fillTemplate, findBlanks, formatEarned, formatLastActive, usesEarned } from "./templates";
import { buildLuluEmailHtml } from "./email";

const v = { name: "metakay23", days: 27, earned: "90,000 G$ + 20 USDT", lastActive: "August" };

test("merge tags fill per person; unpaid people never see an empty amount", () => {
  assert.equal(fillTemplate("{name} did {days} days, earned {earned}, last {lastActive}", v), "metakay23 did 27 days, earned 90,000 G$ + 20 USDT, last August");
  assert.equal(fillTemplate("earned {earned}", { ...v, earned: "" }), "earned some money");
});

test("blanks block sending until filled", () => {
  const offer = OUTREACH_TEMPLATES.find((t) => t.id === "juicy-offer")!;
  assert.deepEqual(findBlanks(offer.subject, offer.body).sort(), ["[DATE]", "[YOUR OFFER]"]);
  assert.deepEqual(findBlanks("No blanks [here] or [a]"), []);
  for (const t of OUTREACH_TEMPLATES.filter((t) => t.id !== "juicy-offer")) assert.deepEqual(findBlanks(t.subject, t.heading, t.body, t.cta), [], t.id);
});

test("earned and last-active read naturally", () => {
  assert.equal(formatEarned(55964, 0), "55,964 G$");
  assert.equal(formatEarned(0, 8), "8 USDT");
  assert.equal(formatEarned(0, 0), "");
  const now = new Date("2026-11-17T12:00:00Z");
  assert.equal(formatLastActive("2026-11-16", now), "yesterday");
  assert.equal(formatLastActive("2026-11-10", now), "7 days ago");
  assert.equal(formatLastActive("2026-10-20", now), "4 weeks ago");
  assert.equal(formatLastActive("2026-08-19", now), "August");
  assert.equal(usesEarned("x {earned}"), true);
});

test("email escapes user-controlled text and links into the app", () => {
  const html = buildLuluEmailHtml({ appUrl: "https://www.staydelulu.xyz", subject: "Hi", heading: "Hey <b>x</b>", body: "Line one\n\nLine <script>two</script>", cta: "Go", ctaPath: "/leaderboard" });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.ok(html.includes('href="https://www.staydelulu.xyz/leaderboard"'));
  assert.equal((html.match(/<p style="margin:0 0 16px/g) ?? []).length, 2);
});
