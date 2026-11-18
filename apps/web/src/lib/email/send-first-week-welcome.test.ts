import { test } from "node:test";
import assert from "node:assert/strict";
import { firstWeekWelcomeEmail } from "@/lib/email/send-first-week-welcome";

const money = (g: number) => ({ g, usd: g * 0.000106, ngn: g * 0.000106 * 1353 });
const facts = {
  gdUsd: 0.000106, ngnPerUsd: 1353,
  sevenDay: null,
  firstWeek: { slug: "first-week", title: "Your First Week", entry: money(15000), top: money(15000), perPhoto: 1000 },
  topReferrers: [{ name: "metakay23", usd: 9.54, ngn: 12910 }],
  topCampaign: [{ name: "amakatdc", usd: 28.4, ngn: 38460 }],
};

test("welcome email names the inviter, the $ and ₦, the daily + finish split, and is honest about misses", () => {
  const e = firstWeekWelcomeEmail({ username: "ada", invitedBy: "kaddy" }, facts);
  assert.match(e.subject, /^@kaddy invited you — your first week pays \$1\.59 \(≈ ₦2,150\)$/);
  assert.match(e.body, /\+1,000 G\$, paid the same day/);
  assert.match(e.body, /\+8,000 G\$ more/);
  assert.match(e.body, /you keep what you've earned and can start again/);
  assert.match(e.body, /@metakay23 \$9\.54/);
  assert.equal(e.path, "/bingo/first-week");
  assert.match(firstWeekWelcomeEmail({ username: null, invitedBy: null }, facts).subject, /^Welcome to Delulu/);
});
