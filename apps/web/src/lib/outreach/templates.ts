/**
 * Win-back email templates, written as Lulu. Shared by the admin page
 * (picker + live preview) and the send API (the actual merge), so what the
 * admin previews is exactly what goes out.
 *
 * Merge tags: {name} {days} {earned} {lastActive}. Text in [SQUARE BRACKETS]
 * is a blank the admin must fill — sending is blocked until none are left.
 */

export type OutreachTemplate = {
  id: string;
  label: string;
  /** One line in the picker: who it's for. */
  bestFor: string;
  subject: string;
  heading: string;
  body: string;
  cta: string;
  /** App path the button opens. */
  ctaPath: string;
};

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "miss-you",
    label: "Lulu misses you",
    bestFor: "Anyone who went quiet",
    subject: "{name}, Lulu misses you",
    heading: "Hey {name}, it's Lulu 👋",
    body: `I peeked at the leaderboard today and your spot looks a little empty without you.

You showed up {days} days on Delulu. That's not luck. That's discipline. And habits like that don't disappear, they just take a nap.

So here's my tiny ask: set one small goal for this week and prove it tomorrow. Just one. I'll be cheering the whole way.`,
    cta: "Wake my streak up",
    ctaPath: "/home",
  },
  {
    id: "you-got-paid",
    label: "You've been paid before",
    bestFor: "People who earned rewards",
    subject: "{name}, remember that {earned}? There's more 💛",
    heading: "You already know Delulu pays 💸",
    body: `Quick reminder from your favourite yellow friend: Delulu has already paid you {earned} for staying consistent.

That money didn't come from luck. It came from you showing up {days} days.

Rewards are flowing again: money every day you prove, a weekly streak bonus, and prizes for the monthly top 10. Your next payout starts with one proof.`,
    cta: "Get my next reward",
    ctaPath: "/home",
  },
  {
    id: "streak-bonus",
    label: "New: streak bonuses",
    bestFor: "Very active (10+ days)",
    subject: "New on Delulu: get paid for your streak 🔥",
    heading: "Your streak can pay you now 🔥",
    body: `Big news! You can now earn bonus money just for keeping your streak alive. Hit 14, 30, 60 and 90 days in a row and each one pays a bonus.

You've done {days} days before, so you know you can do it. This time every single day counts toward something bigger.

Start today and let's get that flame burning next to your name on the leaderboard.`,
    cta: "Start my streak",
    ctaPath: "/home",
  },
  {
    id: "top-10",
    label: "The top 10 just got paid",
    bestFor: "Competitive types",
    subject: "The top 10 just got paid. Want in? 🏆",
    heading: "This month's top 10 just got paid 🏆",
    body: `Real people, real money, and some of them started exactly where you are.

You've already shown up {days} days, so you know the drill. Show up every day this month, keep your flame lit, and that top 10 spot could have your name on it.

New rule: miss a day and you're out of that month's rewards. So start today, not tomorrow 😉`,
    cta: "See the leaderboard",
    ctaPath: "/leaderboard",
  },
  {
    id: "juicy-offer",
    label: "Juicy comeback offer",
    bestFor: "Your best old users",
    subject: "{name}, Lulu saved something for you 🎁",
    heading: "Psst… this one's just for you 🎁",
    body: `Okay, don't tell everyone. You're one of our OG dreamers ({days} days!), so I saved you something special:

[YOUR OFFER]

Come back by [DATE], prove one goal, and it's yours. That's it. That's the whole deal.`,
    cta: "Claim my offer",
    ctaPath: "/home",
  },
  {
    id: "blank",
    label: "Write your own",
    bestFor: "Anything else",
    subject: "",
    heading: "Hey {name} 👋",
    body: "",
    cta: "Open Delulu",
    ctaPath: "/home",
  },
];

export type MergeValues = { name: string; days: number; earned: string; lastActive: string };

export function formatEarned(gd: number, usdt: number): string {
  const parts: string[] = [];
  if (gd > 0) parts.push(`${gd.toLocaleString("en-US")} G$`);
  if (usdt > 0) parts.push(`${usdt.toLocaleString("en-US")} USDT`);
  return parts.join(" + ");
}

/** "August" for an older date, "2 weeks ago"-style for recent ones. */
export function formatLastActive(day: string, now = new Date()): string {
  const d = new Date(`${day}T12:00:00Z`);
  const daysAgo = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (daysAgo <= 1) return "yesterday";
  if (daysAgo < 14) return `${daysAgo} days ago`;
  if (daysAgo < 45) return `${Math.round(daysAgo / 7)} weeks ago`;
  return d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

export function fillTemplate(text: string, v: MergeValues): string {
  return text
    .replace(/\{name\}/g, v.name)
    .replace(/\{days\}/g, String(v.days))
    .replace(/\{earned\}/g, v.earned || "some money")
    .replace(/\{lastActive\}/g, v.lastActive);
}

/** Unfilled "[LIKE THIS]" blanks left in any field. */
export function findBlanks(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(/\[[A-Z][A-Z0-9 _-]{1,40}\]/g)) found.add(m[0]);
  return [...found];
}

export const usesEarned = (...texts: string[]) => texts.some((t) => t.includes("{earned}"));
