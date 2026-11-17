/**
 * The nudge rules: given where someone is, the ONE most useful nudge right
 * now (or none). Pure, so every rule is testable. Ordered by urgency — a
 * square closing tonight beats a general "come back".
 */
import type { Person } from "@/lib/nudges/people";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type Nudge = {
  rule: NudgeRule;
  /** One send per (wallet, rule, dedupeKey), ever. */
  dedupeKey: string;
  title: string;
  body: string;
  /** In-app path the push/email opens. */
  path: string;
  emailSubject: string;
  emailHeading: string;
  emailBody: string;
  cta: string;
};

export const NUDGE_RULES = [
  "square_due",
  "missed_day",
  "setup_unfinished",
  "verify_for_gift",
  "gift_not_played",
  "install_app",
  "come_back",
] as const;
export type NudgeRule = (typeof NUDGE_RULES)[number];

export const RULE_LABEL: Record<NudgeRule, string> = {
  square_due: "Today's square closing",
  missed_day: "Missed a day",
  setup_unfinished: "Setup not finished",
  verify_for_gift: "Not verified (no gift)",
  gift_not_played: "Gift not played",
  install_app: "App not installed",
  come_back: "Quiet 3+ days",
};

/** Lagos hour 0–23 (UTC+1, no DST). */
export const lagosHour = (nowMs: number) => (new Date(nowMs).getUTCHours() + 1) % 24;
/** No nudges 10pm–8am Lagos. */
export const isQuietHours = (nowMs: number) => {
  const h = lagosHour(nowMs);
  return h >= 22 || h < 8;
};

const hoursLeft = (iso: string, nowMs: number) => (Date.parse(iso) - nowMs) / HOUR;
const fmtHours = (h: number) => (h >= 1 ? `${Math.floor(h)}h` : `${Math.max(1, Math.round(h * 60))}m`);
const name = (p: Person) => (p.username ? `${p.username}, ` : "");

export function pickNudge(p: Person, nowMs = Date.now()): Nudge | null {
  const age = nowMs - Date.parse(p.createdAt);
  const card = p.activeCard;

  // 1. Today's square is still open and closing within 8 hours.
  if (card && !card.todayFilled) {
    const left = hoursLeft(card.dayEndsAt, nowMs);
    if (left > 0.25 && left <= 8) {
      const mission = card.todayMission?.replace(/^Day \d+ · /, "") ?? "today's photo";
      return {
        rule: "square_due",
        dedupeKey: `${card.attemptId}:${card.today}`,
        title: `⏰ Day ${card.today + 1} closes in ${fmtHours(left)}`,
        body: `${card.title}: ${mission}. One photo keeps your card alive.`,
        path: `/bingo/${card.slug}`,
        emailSubject: `Day ${card.today + 1} of ${card.title} closes in ${fmtHours(left)}`,
        emailHeading: `Don't lose your card, ${p.username ?? "friend"}`,
        emailBody: `Today's square on ${card.title} is still empty: ${mission}.\n\nIt closes in ${fmtHours(left)}. One photo and you're through to day ${card.today + 2 <= card.days ? card.today + 2 : card.days}.`,
        cta: "Add today's photo",
      };
    }
  }

  // 2. A card just ended on a missed day — point them at a fresh start.
  if (p.recentMiss && !card) {
    const fresh = p.recentMiss.oneTime ? { slug: "prayer-streak", title: "Prayer Streak" } : { slug: p.recentMiss.slug, title: p.recentMiss.title };
    return {
      rule: "missed_day",
      dedupeKey: p.recentMiss.attemptId,
      title: "New day, fresh start 🌱",
      body: `${p.recentMiss.title} ended on a missed day. Start ${fresh.title} — 3 days, one photo a day.`,
      path: `/bingo/${fresh.slug}`,
      emailSubject: "A fresh start is waiting",
      emailHeading: "Missed a day? Happens to everyone.",
      emailBody: `Your ${p.recentMiss.title} card ended on a missed day. The best streaks start right after a miss.\n\nStart ${fresh.title}: one photo a day, and you earn G$ for every photo.`,
      cta: `Start ${fresh.title}`,
    };
  }

  // 3. Signed up but never finished setup (first 3 days).
  if (!p.onboardedAt && age >= 2 * HOUR && age <= 3 * DAY) {
    return {
      rule: "setup_unfinished",
      dedupeKey: "once",
      title: "Your 1,000 G$ is waiting 🎁",
      body: "Finish setting up Delulu to unlock your free welcome gift.",
      path: "/home",
      emailSubject: "Your 1,000 G$ welcome gift is waiting",
      emailHeading: `${name(p)}you're one step away`,
      emailBody: "You started signing up for Delulu but didn't finish.\n\nTake one minute to finish setting up and unlock your free 1,000 G$ welcome gift. Then use it to start your first Bingo.",
      cta: "Finish setting up",
    };
  }

  // 4. Set up but no gift — the gift needs a one-time face check.
  if (p.onboardedAt && !p.giftSent && nowMs - Date.parse(p.onboardedAt) >= 3 * HOUR && age <= 5 * DAY) {
    return {
      rule: "verify_for_gift",
      dedupeKey: "once",
      title: "One face check = 1,000 G$ free",
      body: "Verify once and your welcome gift lands in your wallet.",
      path: "/home",
      emailSubject: "One quick face check unlocks 1,000 G$",
      emailHeading: "Unlock your welcome gift",
      emailBody: "Your 1,000 G$ welcome gift is ready — it just needs one quick face check to make sure you're a real person.\n\nIt takes under a minute, and you only do it once.",
      cta: "Verify now",
    };
  }

  // 5. Got the gift but hasn't played with it.
  const giftAt = p.giftClaimedAt ?? (p.giftSent ? p.onboardedAt : null);
  if (p.giftSent && !p.everStartedBingo && giftAt && nowMs - Date.parse(giftAt) >= 6 * HOUR && nowMs - Date.parse(giftAt) <= 7 * DAY) {
    return {
      rule: "gift_not_played",
      dedupeKey: "once",
      title: "Put your 1,000 G$ to work 💪",
      body: "Start Delulu Debut: 3 days, 3 photos, 100 G$ a photo — and your 1,000 back.",
      path: "/bingo/delulu-debut",
      emailSubject: "Your 1,000 G$ could be earning",
      emailHeading: "Start your Delulu Debut",
      emailBody: "Your welcome gift is in your wallet. Put it into Delulu Debut: three days, one photo a day.\n\nYou earn 100 G$ for every photo, and your 1,000 G$ comes back when you finish.",
      cta: "Start Delulu Debut",
    };
  }

  // 6. Posting proofs but hasn't installed the app (and can't get pushes).
  // Only once we've seen them since install tracking began — before that "not installed" just means "unknown".
  if (p.lastProofAt && p.lastSeenAt && !p.installedAt && !p.pushOn && age <= 14 * DAY) {
    return {
      rule: "install_app",
      dedupeKey: "once",
      title: "Add Delulu to your home screen",
      body: "Open it in one tap and get a reminder before your day closes.",
      path: "/home",
      emailSubject: "Never miss a day: add Delulu to your home screen",
      emailHeading: "Keep Delulu one tap away",
      emailBody:
        "Add Delulu to your home screen so you can post in one tap — and we can remind you before a day closes.\n\nAndroid (Chrome): open Delulu, tap ⋮ → \"Add to Home screen\".\niPhone (Safari): open Delulu, tap Share → \"Add to Home Screen\".",
      cta: "Open Delulu",
    };
  }

  // 7. Quiet for 3+ days after getting started — once a week at most.
  const lastActive = Math.max(...[p.lastSeenAt, p.lastProofAt].filter(Boolean).map((d) => Date.parse(d!)), 0);
  if (!card && (p.onboardedAt || p.everStartedBingo) && lastActive > 0 && nowMs - lastActive >= 3 * DAY) {
    return {
      rule: "come_back",
      dedupeKey: `w${Math.floor(nowMs / (7 * DAY))}`,
      title: "Lulu misses you 🥺",
      body: "A new Bingo is open — one photo a day, G$ for every photo.",
      path: "/explore",
      emailSubject: "Lulu misses you",
      emailHeading: `${name(p)}come back for a quick win`,
      emailBody: "It's been a few days. A Bingo is open right now: one photo a day, and you earn G$ for every photo you post.\n\nYour free daily G$ is waiting too.",
      cta: "See today's Bingo",
    };
  }

  return null;
}

/** Did the person do what the nudge asked, within a day of it? */
export function actedOn(rule: NudgeRule, p: Person, sentAtIso: string): boolean {
  const sent = Date.parse(sentAtIso);
  const after = (iso: string | null) => !!iso && Date.parse(iso) >= sent && Date.parse(iso) - sent <= DAY;
  switch (rule) {
    case "square_due":
    case "missed_day":
    case "gift_not_played":
      return after(p.lastProofAt) || (rule === "gift_not_played" && p.everStartedBingo);
    case "setup_unfinished":
      return after(p.onboardedAt);
    case "verify_for_gift":
      return p.giftSent;
    case "install_app":
      return after(p.installedAt);
    case "come_back":
      return after(p.lastSeenAt) || after(p.lastProofAt);
  }
}
