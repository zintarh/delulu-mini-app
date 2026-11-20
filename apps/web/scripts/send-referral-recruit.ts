/**
 * Referrer recruitment email: everyone active on 5+ days, active in the last
 * 30 days, or who referred in an earlier campaign (not this season's referrers —
 * the daily referral funnel cheers those on) gets the live referrer leaderboard, their
 * own invite link (or the steps that unlock it), what a friend pays and the
 * spots left this week.
 *
 * Usage (from apps/web):
 *   npx tsx --tsconfig tsconfig.json scripts/send-referral-recruit.ts                      # dry run: audience + who's ready/locked
 *   npx tsx --tsconfig tsconfig.json scripts/send-referral-recruit.ts --preview=out.html   # writes a ready + a locked sample
 *   npx tsx --tsconfig tsconfig.json scripts/send-referral-recruit.ts --test=you@x.com     # emails both samples to you
 *   npx tsx --tsconfig tsconfig.json scripts/send-referral-recruit.ts --send               # real send (nudge_log dedupes)
 */
import { config } from "dotenv";
import { writeFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const APP_URL = "https://www.staydelulu.xyz";
const LINK_BASE = "https://www.staydelulu.xyz/sign-in?ref=";
/** Left out on request. Matched on username, case-insensitive. */
const EXCLUDE_USERNAMES = new Set(["samajayi", "sammajayi"]);
const RULE = "referral_recruit";
const DEDUPE = "s2-week1";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`))?.split("=")[1] ?? (process.argv.includes(`--${name}`) ? "1" : null);

async function main() {
  const { getSupabaseAdmin } = await import("@/lib/push/supabase");
  const { loadActivity } = await import("@/lib/analytics/retention");
  const { checkReferralEligibility } = await import("@/lib/referral/eligibility");
  const { ensureReferralCode } = await import("@/lib/referral/code");
  const { slotsView } = await import("@/lib/referral/slots");
  const { SEASON_START_LAGOS, currentReferralRound, roundFirstPayment } = await import("@/lib/referral/campaign");
  const { getEarnFacts, toMoney, fmtNgn } = await import("@/lib/earn/facts");
  const { isLeaderboardBlacklisted } = await import("@/lib/constant");
  const { buildRecruitHtml, buildRecruitText, recruitSubject } = await import("@/lib/outreach/referral-recruit");
  type RecruitEmail = import("@/lib/outreach/referral-recruit").RecruitEmail;

  const admin = getSupabaseAdmin()!;
  const round = currentReferralRound();
  if (!round) throw new Error("No referral round is live");
  const seasonIso = new Date(`${SEASON_START_LAGOS}T00:00:00+01:00`).toISOString();

  // ── Audience ──
  const activity = await loadActivity(admin, Date.parse("2025-01-01"));
  const dayCount = (ts: number[]) => new Set(ts.map((t) => new Date(t + 3600e3).toISOString().slice(0, 10))).size;
  const monthAgo = Date.now() - 30 * 86_400_000;
  const wallets = new Set<string>();
  for (const [w, ts] of activity) if (dayCount(ts) >= 5 || ts.some((t) => t >= monthAgo)) wallets.add(w);
  const { data: allCredits } = await admin.from("referral_credits").select("*").limit(50_000);
  const { data: referredRows } = await admin.from("profiles").select("referred_by").not("referred_by", "is", null).limit(50_000);
  for (const c of allCredits ?? []) wallets.add(String(c.referrer_wallet).toLowerCase());
  for (const p of referredRows ?? []) wallets.add(String(p.referred_by).toLowerCase());

  const { data: profiles } = await admin.from("profiles").select("address, username, email, referral_code").in("address", [...wallets]);
  const { data: alreadySent } = await admin.from("nudge_log").select("wallet").eq("rule", RULE).eq("dedupe_key", DEDUPE).eq("status", "sent");
  const sent = new Set((alreadySent ?? []).map((r) => String(r.wallet)));
  // This season's referrers get the daily referral funnel (lib/nudges/rules.ts), not this email.
  const { data: seasonInvites } = await admin.from("profiles").select("referred_by").gte("created_at", seasonIso).not("referred_by", "is", null);
  const activeReferrers = new Set([
    ...(seasonInvites ?? []).map((r) => String(r.referred_by).toLowerCase()),
    ...(allCredits ?? []).filter((c) => String(c.credited_at) >= seasonIso).map((c) => String(c.referrer_wallet).toLowerCase()),
  ]);
  const people = (profiles ?? []).filter(
    (p) =>
      !activeReferrers.has(String(p.address).toLowerCase()) &&
      p.email &&
      !String(p.email).endsWith("@wallet.local") &&
      !isLeaderboardBlacklisted(String(p.address)) &&
      !EXCLUDE_USERNAMES.has(String(p.username ?? "").toLowerCase()),
  );

  // ── Leaderboard: this season's credits, paid G$ (first + 3-day bonus) ──
  const season = (allCredits ?? []).filter((c) => String(c.credited_at) >= seasonIso);
  const byRef = new Map<string, { friends: number; earnedG: number }>();
  for (const c of season) {
    const w = String(c.referrer_wallet).toLowerCase();
    const b = byRef.get(w) ?? { friends: 0, earnedG: 0 };
    b.friends++;
    if (c.payout_status === "sent") b.earnedG += Number(c.gdollars_amount ?? 0);
    if (c.streak_status === "sent") b.earnedG += Number(c.streak_amount ?? 0);
    byRef.set(w, b);
  }
  const { data: leaderProfiles } = await admin.from("profiles").select("address, username").in("address", [...byRef.keys()]);
  const leaders = [...byRef]
    .filter(([w]) => !isLeaderboardBlacklisted(w))
    .map(([w, b]) => ({ name: String(leaderProfiles?.find((p) => p.address === w)?.username ?? `${w.slice(0, 6)}…`), ...b }))
    .filter((l) => !EXCLUDE_USERNAMES.has(l.name.toLowerCase()))
    .sort((a, b) => b.earnedG - a.earnedG || b.friends - a.friends)
    .slice(0, 5);

  // ── Shared facts ──
  const [slots, facts] = await Promise.all([slotsView(admin), getEarnFacts(admin)]);
  const lastDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.parse(round.end) - 1));
  const rewardMoney = toMoney(round.reward, facts.gdUsd, facts.ngnPerUsd);
  const fw = facts.firstWeek;
  const base = {
    leaders,
    reward: round.reward,
    firstPayment: roundFirstPayment(round),
    rewardNaira: `≈ ${fmtNgn(rewardMoney.ngn)}`,
    friendGets: fw ? `${fw.entry.g.toLocaleString("en-US")} G$ (≈ ${fmtNgn(fw.entry.ngn)})` : "6,750 G$",
    spotsLeft: slots.left,
    spots: slots.slots,
    roundEnds: lastDay,
  };

  const STEP_LABEL: Record<string, string> = {
    verified: "Verify your face (Profile → Verify)",
    claimedUbi: "Claim your free daily money once",
    claimedGift: "Claim your 1,000 G$ welcome gift",
    completedCampaign: "Post one approved photo in a Bingo or goal",
  };

  // ── Personalise ──
  const emails: { wallet: string; to: string; e: RecruitEmail }[] = [];
  for (const p of people) {
    const w = String(p.address);
    const elig = await checkReferralEligibility(admin, w);
    const code = elig.eligible ? (p.referral_code ?? (await ensureReferralCode(admin, w))) : null;
    const mine = byRef.get(w);
    emails.push({
      wallet: w,
      to: String(p.email),
      e: {
        ...base,
        name: String(p.username ?? "Hey"),
        link: code ? `${LINK_BASE}${code}` : null,
        missingSteps: Object.entries(elig.steps).filter(([, ok]) => !ok).map(([s]) => STEP_LABEL[s] ?? s),
        myFriends: mine?.friends ?? 0,
        myEarnedG: mine?.earnedG ?? 0,
      },
    });
  }

  const ready = emails.filter((x) => x.e.link);
  const locked = emails.filter((x) => !x.e.link);
  console.log({ audience: wallets.size, withEmail: people.length, ready: ready.length, locked: locked.length, alreadySent: sent.size, spots: `${slots.left}/${slots.slots}`, leaders });
  const missingTally: Record<string, number> = {};
  for (const x of locked) for (const s of x.e.missingSteps) missingTally[s] = (missingTally[s] ?? 0) + 1;
  console.log("locked by step", missingTally);

  const samples = [ready.find((x) => x.e.myFriends > 0) ?? ready[0], locked[0]].filter(Boolean);

  const preview = arg("preview");
  if (preview) {
    const html = samples.map((s) => `<h3 style="font-family:sans-serif;text-align:center">Sample: ${s.e.link ? "ready" : "locked"} · subject: ${recruitSubject(s.e)}</h3>${buildRecruitHtml(APP_URL, s.e)}`).join("<hr/>");
    writeFileSync(resolve(preview), html);
    console.log("preview written", resolve(preview));
  }

  const test = arg("test");
  const doSend = arg("send");
  if (!test && !doSend) return;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";
  const pause = () => new Promise((r) => setTimeout(r, 600));

  if (test) {
    for (const s of samples) {
      const { error } = await resend.emails.send({ from, to: test, subject: `[TEST] ${recruitSubject(s.e)}`, html: buildRecruitHtml(APP_URL, s.e), text: buildRecruitText(APP_URL, s.e) });
      console.log("test", s.e.link ? "ready" : "locked", error ?? "ok");
      await pause();
    }
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const x of emails) {
    if (sent.has(x.wallet)) continue;
    const { error } = await resend.emails.send({ from, to: x.to, subject: recruitSubject(x.e), html: buildRecruitHtml(APP_URL, x.e), text: buildRecruitText(APP_URL, x.e) });
    await admin.from("nudge_log").upsert(
      { wallet: x.wallet, rule: RULE, dedupe_key: DEDUPE, channel: "email", status: error ? "failed" : "sent", detail: error ? String(error.message).slice(0, 200) : recruitSubject(x.e).slice(0, 200) },
      { onConflict: "wallet,rule,dedupe_key" },
    );
    if (error) failed++;
    else ok++;
    await pause();
  }
  console.log({ sent: ok, failed });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
