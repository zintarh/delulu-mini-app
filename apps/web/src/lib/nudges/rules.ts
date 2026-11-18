/**
 * The nudge rules: given where someone is, the ONE most useful nudge right
 * now (or none). Pure, so every rule is testable. Ordered by urgency — a
 * square closing tonight beats a general "come back".
 */
import type { Person } from "@/lib/nudges/people";
import { referralPhase } from "@/lib/referral/campaign";
import { NAIRA_CASHOUT_MIN_G, NAIRA_CASHOUT_TELEGRAM_URL } from "@/lib/rewards/cash-out";
import { earnersLine, fmtMoney, type EarnFacts } from "@/lib/earn/format";
import { FIRST_WEEK_SLUG } from "@/lib/bingo/first-week";

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
  "last_call",
  "square_due",
  "missed_day",
  "setup_unfinished",
  "verify_for_gift",
  "gift_not_played",
  "install_app",
  "level_up",
  "seven_day_start",
  "referral_week",
  "referred_back",
  "come_back",
] as const;
export type NudgeRule = (typeof NUDGE_RULES)[number];

export const RULE_LABEL: Record<NudgeRule, string> = {
  last_call: "Last call: ~2h left, stake on the line",
  square_due: "Today's square closing",
  missed_day: "Missed a day",
  setup_unfinished: "Setup not finished",
  verify_for_gift: "Not verified (no gift)",
  gift_not_played: "Gift not played",
  install_app: "App not installed",
  level_up: "Finished a 3-day → 7-day",
  seven_day_start: "Active, nothing running → 7-day Bingo",
  referral_week: "Referral round is open",
  referred_back: "Invited friend gone quiet",
  come_back: "Quiet 3+ days / dormant",
};

/** What a person's nudge history looks like (for cadence and "stop if ignored"). */
export type NudgeHistory = { rule: string; sentAt: string; acted: boolean }[];

/**
 * Everything Delulu is offering right now — appended to every email so each
 * nudge also sells the rest. `skip` drops the one the nudge itself is about.
 */
/** Same new-users-only cutoff as the welcome gift (lib/onboarding/gift.ts NEW_USER_CUTOFF_ISO). */
const GIFT_NEW_USER_CUTOFF_MS = Date.parse("2026-09-21T00:00:00+01:00");

/** Can this person still get the 1,000 G$ welcome gift? (Newer accounts that haven't had it.) */
export const canStillGetGift = (p: Pick<Person, "createdAt" | "giftSent">) => !p.giftSent && Date.parse(p.createdAt) >= GIFT_NEW_USER_CUTOFF_MS;

export function offerLines(nowMs: number, skip: "gift" | "photo" | "finish" | "referral" | null = null, giftEligible = true): string {
  // Earning every day leads — that's what keeps students coming back.
  const lines: string[] = ["💸 Free money to claim every day"];
  if (skip !== "photo") lines.push("📸 100 G$ for every Bingo photo — one photo a day, a minute between classes");
  if (skip !== "finish") lines.push("🏆 Finish a 7-day Bingo: your stake back + up to 2,000 G$ bonus");
  if (skip !== "gift" && giftEligible) lines.push("🎁 1,000 G$ free to start your first Bingo (after one quick face check)");
  const ref = referralPhase(new Date(nowMs));
  if (skip !== "referral" && ref.phase !== "off") {
    lines.push(`🤝 ${ref.round.reward.toLocaleString("en-US")} G$ for every friend you invite${ref.phase === "soon" ? " (opens soon)" : " this week"}`);
  }
  // Only promise naira once there's someone to message for it.
  if (NAIRA_CASHOUT_TELEGRAM_URL) lines.push(`🇳🇬 Turn your G$ into naira from ${NAIRA_CASHOUT_MIN_G.toLocaleString("en-US")} G$ — How to earn → Turn G$ into naira`);
  return `Earn on Delulu every day:\n${lines.join("\n")}`;
}
const withOffersBase = (body: string, nowMs: number, skip: Parameters<typeof offerLines>[1] = null, p?: Pick<Person, "createdAt" | "giftSent">) =>
  `${body}\n\n${offerLines(nowMs, skip, p ? canStillGetGift(p) : false)}`;

/** Lagos hour 0–23 (UTC+1, no DST). */
export const lagosHour = (nowMs: number) => (new Date(nowMs).getUTCHours() + 1) % 24;
/** No nudges 10pm–8am Lagos. */
export const isQuietHours = (nowMs: number) => {
  const h = lagosHour(nowMs);
  return h >= 22 || h < 8;
};

/** The last-call window before a day closes (the cron runs every 30 min, so ≥ 4 chances). */
export const LAST_CALL_HOURS = 2.5;
const hoursLeft = (iso: string, nowMs: number) => (Date.parse(iso) - nowMs) / HOUR;
const fmtHours = (h: number) => (h >= 1 ? `${Math.floor(h)}h` : `${Math.max(1, Math.round(h * 60))}m`);
const name = (p: Person) => (p.username ? `${p.username}, ` : "");

/** "7 days = $1.01 (≈ ₦1,370)" — from the 7-day Bingo's live reward config, never a hard-coded promise. */
export function sevenDayPitch(f: EarnFacts | null | undefined): string | null {
  return f?.sevenDay ? `7 days = ${fmtMoney(f.sevenDay.entry)}` : null;
}

/** The "what you're missing" block on every email: what 7 days pays, and what top players earned. */
export function stakesBlock(f: EarnFacts | null | undefined, skip: "firstWeek" | null = null): string {
  if (!f) return "";
  const lines: string[] = [];
  if (f.sevenDay && skip !== "firstWeek") {
    const more = f.sevenDay.top.g > f.sevenDay.entry.g ? ` — up to ${fmtMoney(f.sevenDay.top)} with a bigger stake` : "";
    lines.push(`📅 Stay active 7 days on ${f.sevenDay.title}: earn ${fmtMoney(f.sevenDay.entry)}${more}`);
  }
  if (f.topReferrers.length) lines.push(`🤝 Top inviters so far: ${earnersLine(f.topReferrers)}`);
  if (f.topCampaign.length) lines.push(`🏆 Top mission earners: ${earnersLine(f.topCampaign)}`);
  return lines.length ? `\n\nWhat you'd be missing:\n${lines.join("\n")}` : "";
}

/** New (first 2 weeks) or invited, and hasn't played Your First Week yet. */
export function canDoFirstWeek(p: Pick<Person, "createdAt" | "referredBy" | "finishedSlugs">, nowMs: number): boolean {
  // A missed day ends a First Week card but not the offer — only finishing it does.
  if (p.finishedSlugs.includes(FIRST_WEEK_SLUG)) return false;
  return !!p.referredBy || nowMs - Date.parse(p.createdAt) < 14 * DAY;
}

/** Comeback-type nudges that switch to the First Week offer for anyone who can still take it. */
const FIRST_WEEK_RULES = new Set<NudgeRule>(["gift_not_played", "missed_day", "seven_day_start", "level_up", "referred_back", "come_back"]);

export function pickNudge(p: Person, nowMs = Date.now(), history: NudgeHistory = [], facts: EarnFacts | null = null): Nudge | null {
  const n = pickNudgeBase(p, nowMs, history, facts);
  const fw = facts?.firstWeek;
  if (!n || !fw || !FIRST_WEEK_RULES.has(n.rule) || !canDoFirstWeek(p, nowMs)) return n;
  const amount = fmtMoney(fw.entry);
  const friend = p.referredBy?.username ? `@${p.referredBy.username} invited you — ` : "";
  // Rotate subject lines so a quiet player doesn't get the same email every time.
  const sentBefore = history.filter((h) => h.rule === n.rule).length;
  const subjects = [
    `Did you know you can earn ${amount} on Delulu?`,
    `${amount} just for showing up 7 days`,
    `Your ${amount} welcome week is still waiting`,
  ];
  return {
    ...n,
    title: `Earn ${amount} in 7 days 💸`,
    body: `${friend}show up 7 days in a row, one photo a day. A welcome bonus for new players — once.`,
    path: `/bingo/${fw.slug}`,
    emailSubject: subjects[sentBefore % subjects.length],
    emailHeading: `${name(p)}did you know you can earn ${amount}?`,
    emailBody:
      `${friend ? `${friend.replace(" — ", ".")}\n\n` : ""}Did you know you can earn ${amount} on Delulu just for showing up 7 days in a row?\n\n` +
      `Join ${fw.title}: post one photo a day — it takes a minute between classes. Stay active all 7 days and the ${amount} is yours, plus your stake back. ` +
      `It's a one-time welcome bonus for new players.\n\n` +
      `After that, stake more to earn more — and top players turn their points into cash on the monthly leaderboard.` +
      stakesBlock(facts, "firstWeek"),
    cta: "Start my first week",
  };
}

function pickNudgeBase(p: Person, nowMs: number, history: NudgeHistory, facts: EarnFacts | null): Nudge | null {
  const withOffers: typeof withOffersBase = (...a) => withOffersBase(...a) + stakesBlock(facts);
  const pitch = sevenDayPitch(facts);
  const age = nowMs - Date.parse(p.createdAt);
  const card = p.activeCard;

  // 0. Last call: ~2h left and today's photo still missing — the stake is on
  //    the line. The one nudge allowed on top of the daily one (and in quiet hours).
  if (card && !card.todayFilled) {
    const left = hoursLeft(card.dayEndsAt, nowMs);
    if (left > 0.25 && left <= LAST_CALL_HOURS) {
      const stake = card.stake > 0 ? `${card.stake.toLocaleString("en-US")} G$` : "your card";
      const mission = card.todayMission?.replace(/^Day \d+ · /, "") ?? "today's photo";
      return {
        rule: "last_call",
        dedupeKey: `${card.attemptId}:${card.today}`,
        title: `⏰ ${fmtHours(left)} left — post or lose ${stake}`,
        body: `${card.title}, day ${card.today + 1}: ${mission}. One photo keeps your stake and everything you've earned going.`,
        path: `/bingo/${card.slug}`,
        emailSubject: `${fmtHours(left)} left: post today's photo or lose ${stake}`,
        emailHeading: `Last call, ${p.username ?? "friend"}`,
        emailBody: `Day ${card.today + 1} of ${card.title} closes in ${fmtHours(left)} and today's photo is still missing: ${mission}.\n\nMiss it and the card ends — ${card.stake > 0 ? `your ${stake} stake goes to the community pool` : "your streak resets"}. One photo now keeps it all.`,
        cta: "Post today's photo",
      };
    }
  }

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
        emailBody: withOffers(`Today's square on ${card.title} is still empty: ${mission}.\n\nIt closes in ${fmtHours(left)}. One photo earns you 100 G$ and keeps your card alive.`, nowMs, "photo", p),
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
      emailBody: withOffers(`Your ${p.recentMiss.title} card ended on a missed day. The best streaks start right after a miss.\n\nStart ${fresh.title} today: one photo a day, 100 G$ for every photo.`, nowMs, "photo", p),
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
      emailBody: withOffers("You started signing up for Delulu but didn't finish.\n\nTake one minute to finish setting up and unlock your free 1,000 G$ welcome gift. Then use it to start your first Bingo.", nowMs, "gift", p),
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
      emailBody: withOffers("Your 1,000 G$ welcome gift is ready — it just needs one quick face check to make sure you're a real person.\n\nIt takes under a minute, and you only do it once.", nowMs, "gift", p),
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
      emailBody: withOffers("Your welcome gift is in your wallet. Put it into Delulu Debut: three days, one photo a day.\n\nYou earn 100 G$ for every photo, and your 1,000 G$ comes back when you finish.", nowMs, "gift", p),
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
      emailBody: withOffers(
        "Add Delulu to your home screen so you can post in one tap — and we can remind you before a day closes, so you never lose a card.\n\nAndroid (Chrome): open Delulu, tap ⋮ → \"Add to Home screen\".\niPhone (Safari): open Delulu, tap Share → \"Add to Home Screen\".",
        nowMs, null, p),
      cta: "Open Delulu",
    };
  }

  const lastActive = Math.max(...[p.lastSeenAt, p.lastProofAt].filter(Boolean).map((d) => Date.parse(d!)), 0);
  // "Dormant" comes from Bingo/proof history; someone who opened the app in the
  // last 3 days isn't dormant, whatever that history says.
  const dormantNow = p.dormant && !(lastActive > 0 && nowMs - lastActive < 3 * DAY);
  // A real player: set up in the new flow, or has played/posted before (older accounts predate onboarding tracking).
  const isPlayer = !!(p.onboardedAt || p.everStartedBingo || p.lastProofAt);

  // 7. Finished a 3-day Bingo, nothing going now → the 7-day one pays the most.
  if (!card && p.completedDays === 3 && p.lastCompletedAt && nowMs - Date.parse(p.lastCompletedAt) <= 4 * DAY) {
    return {
      rule: "level_up",
      dedupeKey: p.lastCompletedAt.slice(0, 10),
      title: "Ready for the big one? 🏆",
      body: "Start a 7-day Bingo — up to +2,000 G$ for finishing, plus 100 G$ a photo.",
      path: "/bingo/outside-your-bubble",
      emailSubject: "You finished! Now level up: up to +2,000 G$",
      emailHeading: `${name(p)}you did it 🎉`,
      emailBody: withOffers(
        facts?.sevenDay
          ? `You finished a 3-day Bingo — that's real momentum.\n\nThe 7-day Bingo is the next level: post one photo a day for 7 days and earn ${fmtMoney(facts.sevenDay.entry)} — up to ${fmtMoney(facts.sevenDay.top)} with a bigger stake — on top of your stake back.`
          : "You finished a 3-day Bingo — that's real momentum.\n\nThe 7-day Bingo is the next level: pick your stake, post one photo a day, and finish for a bonus on top of your stake back. Plus 100 G$ for every photo.",
        nowMs,
        "finish", p),
      cta: "Start the 7-day Bingo",
    };
  }

  // 7b. Active in the last 2 days but nothing running — the "slacking off"
  //     moment. Point them at the 7-day Bingo, at most once a week.
  const sevenDaySentThisWeek = history.some((h) => h.rule === "seven_day_start" && nowMs - Date.parse(h.sentAt) < 7 * DAY);
  if (!card && isPlayer && !dormantNow && !sevenDaySentThisWeek && lastActive > 0 && nowMs - lastActive <= 2 * DAY) {
    return {
      rule: "seven_day_start",
      dedupeKey: `w${Math.floor(nowMs / (7 * DAY))}`,
      title: pitch ? `${pitch} 💸` : "Earn every day this week 💸",
      body: pitch
        ? `Start the 7-day Bingo: one photo a day. Stay active all 7 days and you earn ${fmtMoney(facts!.sevenDay!.entry)}.`
        : "Start the 7-day Bingo: 100 G$ for each day's photo, and up to +2,000 G$ when you finish.",
      path: "/bingo/outside-your-bubble",
      emailSubject: "7 days, 7 photos, paid every day",
      emailHeading: `${name(p)}make this week pay`,
      emailBody: withOffers(
        facts?.sevenDay
          ? `You've got nothing running right now — let's change that.\n\nStart the 7-day Bingo: post one photo a day (it takes a minute between classes). Stay active all 7 days and you earn ${fmtMoney(facts.sevenDay.entry)} — plus your stake back.`
          : "You've got nothing running right now — let's change that.\n\nStart the 7-day Bingo: post one photo a day (it takes a minute between classes) and earn 100 G$ for every photo. Finish all 7 and you get your stake back plus a bonus of up to 2,000 G$.",
        nowMs,
        "finish", p),
      cta: "Start my 7 days",
    };
  }

  // 8. A referral round is open — tell active players once per round.
  const ref = referralPhase(new Date(nowMs));
  if (ref.phase === "live" && (p.everStartedBingo || p.bestDays > 0) && lastActive > 0 && nowMs - lastActive <= 14 * DAY) {
    const reward = ref.round.reward.toLocaleString("en-US");
    return {
      rule: "referral_week",
      dedupeKey: ref.round.start.slice(0, 10),
      title: `🤝 ${reward} G$ for every friend this week`,
      body: "Invite a friend — when they post their first Bingo photo, you get paid.",
      path: "/rewards#invite",
      emailSubject: `This week only: ${reward} G$ for every friend you bring`,
      emailHeading: `${reward} G$ per friend — this week`,
      emailBody: withOffers(
        `Referrals are open this week. Share your link from Rewards → Invite friends.\n\nYour friend gets 1,000 G$ free to start, and when they post their first Bingo photo, ${reward} G$ lands with you. Each week's budget is limited, so the earliest invites count first.`,
        nowMs,
        "referral", p),
      cta: "Get my invite link",
    };
  }

  // 8b. Invited friends we've paid (or will pay) for: every 3 days while
  //     they're quiet, naming the friend who brought them. After 5 ignored in
  //     a row they fall through to the regular come-back cadence below.
  if (p.referredBy && !card) {
    const quietFor = lastActive > 0 ? nowMs - lastActive : Infinity;
    const sent = history.filter((h) => h.rule === "referred_back").sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    let ignored = 0;
    for (const h of sent) {
      if (h.acted) break;
      ignored++;
    }
    if (quietFor >= 2 * DAY && ignored < 5) {
      const friend = p.referredBy.username ? `@${p.referredBy.username}` : "Your friend";
      const variant = sent.length % 3;
      const copy = [
        {
          title: `${friend} saved you a spot 👀`,
          body: pitch ? `Come back for 7 days and earn ${fmtMoney(facts!.sevenDay!.entry)}. One photo a day.` : "Come back and earn: free money every day + 100 G$ for each photo.",
          emailSubject: `${friend} brought you to Delulu — your money's waiting`,
          emailHeading: `${name(p)}${friend} wants you back`,
          emailBody: `${friend} invited you to Delulu because it pays to show up.\n\nClaim your free daily money, then post one photo a day on a Bingo — every photo earns you 100 G$.`,
          cta: "Claim today's money",
          path: "/home",
        },
        {
          title: pitch ? `${pitch} 📸` : "7 days, 7 photos, paid every day 📸",
          body: pitch ? "Start the 7-day Bingo: one photo a day — miss none and it's yours." : "Start the 7-day Bingo: 100 G$ a photo and up to +2,000 G$ when you finish.",
          emailSubject: pitch ? `Stay active 7 days: ${pitch.replace("7 days = ", "earn ")}` : "7 photos this week = up to 2,700 G$",
          emailHeading: `${name(p)}one photo a day, paid every day`,
          emailBody: facts?.sevenDay
            ? `Start the 7-day Bingo today. Post one photo a day — it takes a minute between classes.\n\nStay active all 7 days and you earn ${fmtMoney(facts.sevenDay.entry)}, plus your stake back. That's just the start — see what top players have made below.`
            : `Start the 7-day Bingo today. Post one photo a day — it takes a minute between classes.\n\nEvery photo pays 100 G$, and finishing all 7 gets your stake back plus a bonus of up to 2,000 G$.`,
          cta: "Start my 7 days",
          path: "/bingo/outside-your-bubble",
        },
        {
          title: "Your daily money is waiting 💸",
          body: "Tap to claim it — then keep a streak going for more.",
          emailSubject: "You have free money to claim today",
          emailHeading: `${name(p)}don't leave money on the table`,
          emailBody: `There's free money waiting for you on Delulu every single day — it takes one tap to claim.\n\nWhile you're there, start a Bingo and earn 100 G$ for every photo.`,
          cta: "Claim my money",
          path: "/home",
        },
      ][variant];
      return {
        rule: "referred_back",
        dedupeKey: `r${Math.floor(nowMs / (3 * DAY))}`,
        ...copy,
        emailBody: withOffers(copy.emailBody, nowMs, variant === 1 ? "finish" : "photo", p),
      };
    }
  }

  // 9. Quiet for a while. Recent players: after 3 days, weekly. Dormant
  //    accounts: every 2 weeks, and we stop after 3 ignored in a row.
  const comeBacks = history.filter((h) => h.rule === "come_back");
  const ignoredInARow = (() => {
    let n = 0;
    for (const h of [...comeBacks].sort((a, b) => b.sentAt.localeCompare(a.sentAt))) {
      if (h.acted) break;
      n++;
    }
    return n;
  })();
  const recentlyQuiet = !card && (p.onboardedAt || p.everStartedBingo) && lastActive > 0 && nowMs - lastActive >= 3 * DAY;
  const dormant = !card && dormantNow && !!p.onboardedAt;
  if ((recentlyQuiet || dormant) && ignoredInARow < 3) {
    const period = dormant ? 14 * DAY : 7 * DAY;
    return {
      rule: "come_back",
      dedupeKey: `${dormant ? "d" : "w"}${Math.floor(nowMs / period)}`,
      title: "Lulu misses you 🥺",
      body: pitch
        ? `Stay active 7 days and earn ${fmtMoney(facts!.sevenDay!.entry)}.${canStillGetGift(p) ? " 1,000 G$ free to start." : ""}`
        : canStillGetGift(p) ? "Bingo is here: one photo a day, 100 G$ a photo — and 1,000 G$ free to start." : "Bingo is here: one photo a day, 100 G$ for every photo.",
      path: "/explore",
      emailSubject: dormant ? "Delulu has changed — there's free money waiting" : "Lulu misses you (and so does your G$)",
      emailHeading: dormant ? `${name(p)}a lot has changed 👀` : `${name(p)}come back for a quick win`,
      emailBody: withOffers(
        dormant
          ? "Delulu now has Bingo: pick a 3- or 7-day card, post one photo a day, and get paid for every photo.\n\nNew here or coming back, you can start in a minute."
          : "It's been a few days. A Bingo is open right now: one photo a day, and you earn G$ for every photo you post.",
        nowMs, null, p),
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
    case "last_call":
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
    case "referral_week":
    case "referred_back":
      return after(p.lastSeenAt) || after(p.lastProofAt);
    case "level_up":
    case "seven_day_start":
      return !!p.activeCard || after(p.lastProofAt);
  }
}
