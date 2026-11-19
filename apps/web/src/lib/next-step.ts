/**
 * "What do I do next?" — the one line every screen ends on. Pure functions
 * so the copy is the same on the card, the proof sheet and Home, and so it's
 * testable. Every state has a next step; none is a dead end.
 */
import type { BingoView } from "@/lib/bingo/view";

const DAY_MS = 86_400_000;
/** Same as FIRST_WEEK_SLUG (lib/bingo/first-week) — that module pulls in server code, this one stays pure. */
const FIRST_WEEK = "first-week";

/** In-page actions a next step can trigger (links use `href`). */
export type NextStepAction = "join" | "today" | "verify";

export type NextStep = {
  tone: "go" | "wait" | "win" | "warn";
  /** "first-week": Home shows the First Week offer card instead of the plain card. */
  kind?: "first-week";
  title: string;
  body?: string;
  /** Countdown target ("opens in 5h", "closes in 2h"). */
  until?: string;
  untilLabel?: "opens" | "closes";
  /** Offer push reminders when the next step is "come back later". */
  remind?: boolean;
  cta?: { label: string; href?: string; action?: NextStepAction };
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** The next Bingo to point a player at: a 7-day one first (bigger rewards), else any open one. */
export function nextBingoFor(current: BingoView | null, all: BingoView[]): BingoView | null {
  const others = all.filter((b) => b.id !== current?.id && b.joinable && !(b.me && b.me.status === "active" && b.me.phase !== "ended"));
  return others.find((b) => b.durationDays === 7) ?? others[0] ?? null;
}

function nextBingoCta(next: BingoView | null) {
  return next ? { label: next.durationDays === 7 ? `Join ${next.title}` : `Start ${next.title}`, href: `/bingo/${next.slug}` } : { label: "See Bingos", href: "/explore" };
}

/** The everyday habit a Bingo grows into, for "make it yours". */
export function habitFor(bingoTitle: string): string {
  if (/pray/i.test(bingoTitle)) return "Pray every day";
  if (/work ?out|fit|gym|run|walk/i.test(bingoTitle)) return "Workout";
  if (/read|book/i.test(bingoTitle)) return "Read every day";
  return "One good photo of my day";
}

export function bingoNextStep(b: BingoView, all: BingoView[] = []): NextStep {
  const me = b.me;
  const required = b.missions.filter((m) => !m.bonus).length;
  const rolling = b.enrollment === "rolling";
  const stake = Math.min(...b.tiers.map((t) => t.stake));
  const next = nextBingoFor(b, all);

  if (!me) {
    if (b.joinable) {
      return rolling
        ? { tone: "go", title: `${required} days · ${required} photos`, body: `Stake ${fmt(stake)} G$, get it back when you finish.`, cta: { label: `Start · ${fmt(stake)} G$`, action: "join" } }
        : { tone: "go", title: "One photo a day fills your card", body: `Join from ${fmt(stake)} G$.`, cta: { label: `Join · from ${fmt(stake)} G$`, action: "join" } };
    }
    if (b.cycle?.phase === "upcoming") {
      const day = new Date(b.cycle.startsAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
      return { tone: "wait", title: `Starts ${day}`, body: "Joining opens soon — check back shortly.", until: b.cycle.startsAt, untilLabel: "opens" };
    }
    return { tone: "wait", title: "Joining is closed", body: next ? `${next.title} is open now.` : undefined, cta: nextBingoCta(next) };
  }

  const complete = me.requiredFilled >= required;
  if (complete) {
    // A whole week done: turn it into their own habit, at their own pace.
    if (rolling && b.durationDays === 7) {
      return {
        tone: "win",
        title: "You did 7 days! 🎉",
        body: `Your ${fmt(me.stake)} G$ is back. Make it yours — start a personal delulu and keep going.`,
        cta: { label: "Make it a habit", href: `/forfeit?habit=${encodeURIComponent(habitFor(b.title))}` },
      };
    }
    if (rolling) {
      return {
        tone: "win",
        title: `You finished ${b.title}!`,
        body: `Your ${fmt(me.stake)} G$ is back. Ready for more? A 7-day Bingo pays bigger rewards.`,
        cta: next ? nextBingoCta(next) : b.joinable ? { label: "Play again", action: "join" } : nextBingoCta(null),
      };
    }
    const lastDay = b.cycle ? new Date(Date.parse(b.cycle.endsAt) - 1) : null;
    return {
      tone: "win",
      title: "BINGO! Your card is complete",
      body: b.cycle?.phase === "ended" ? "Reclaim your stake in Rewards." : `Your stake comes back after ${lastDay?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}.`,
      cta: b.cycle?.phase === "ended" ? { label: "Go to Rewards", href: "/rewards" } : next ? nextBingoCta(next) : undefined,
    };
  }

  if (me.missedDay) {
    return {
      tone: "warn",
      title: "A day was missed",
      body: b.joinable
        ? `This card ended and the ${fmt(me.stake)} G$ went to the community pool. Start fresh — ${required} days, ${required} photos.`
        : `This card ended and the ${fmt(me.stake)} G$ went to the community pool.${next ? ` Keep going with ${next.title}.` : ""}`,
      cta: b.joinable ? { label: "Start a fresh card", action: "join" } : nextBingoCta(next),
    };
  }

  if (me.phase === "upcoming") {
    return { tone: "wait", title: "You're in!", body: "Your card opens soon.", until: me.nextSquareAt ?? me.startedAt, untilLabel: "opens", remind: true };
  }

  if (me.phase === "ended") {
    return {
      tone: "wait",
      title: `${me.requiredFilled}/${required} squares`,
      body: rolling ? undefined : "Reclaim what's left of your stake in Rewards.",
      cta: rolling ? (b.joinable ? { label: "Start a fresh card", action: "join" } : nextBingoCta(next)) : { label: "Go to Rewards", href: "/rewards" },
    };
  }

  // Live.
  const today = me.today ?? 0;
  const base = rolling ? Date.parse(me.startedAt) : Date.parse(b.cycle?.startsAt ?? me.startedAt);
  const dayEnd = new Date(base + (today + 1) * DAY_MS).toISOString();
  const lastDay = today >= required - 1;

  if (!me.todayUsed) {
    const mission = me.dayOrdered ? b.missions[today]?.title : null;
    return lastDay
      ? { tone: "go", title: "Last square today!", body: mission ? `Finish your card: “${mission}”.` : "Fill one more square to finish your card.", until: dayEnd, untilLabel: "closes", cta: { label: "Add today's photo", action: "today" } }
      : { tone: "go", title: mission ? `Day ${today + 1}: ${mission}` : "Pick any square for today", body: `${me.requiredFilled}/${required} done`, until: dayEnd, untilLabel: "closes", cta: { label: "Add today's photo", action: "today" } };
  }

  // Done for today.
  if (lastDay) {
    // Last required square is done but the weekly card isn't full (late joiner / earlier misses).
    return { tone: "wait", title: "Done for today 🎉", body: next ? `Next up: ${next.title}.` : undefined, cta: next ? nextBingoCta(next) : undefined };
  }
  const tomorrow = me.dayOrdered ? b.missions[today + 1]?.title : null;
  return {
    tone: "wait",
    title: "Done for today 🎉",
    body: tomorrow ? `Come back tomorrow for day ${today + 2}: “${tomorrow}”.` : "Come back tomorrow for your next square.",
    until: me.nextSquareAt ?? dayEnd,
    untilLabel: "opens",
    remind: true,
  };
}

/** After a proof on a personal goal or campaign (the shared success card). */
export function proofNextStep(input: { milestoneIndex?: number | null; milestoneCount?: number | null; nextBingo?: BingoView | null }): NextStep {
  const i = input.milestoneIndex;
  const n = input.milestoneCount ?? 0;
  if (i != null && n > 0 && i + 1 >= n) {
    return {
      tone: "win",
      title: "Goal complete!",
      body: input.nextBingo ? `Keep it going: ${input.nextBingo.title} pays bigger rewards.` : "Keep it going with your next goal.",
      cta: input.nextBingo ? nextBingoCta(input.nextBingo) : { label: "Find a Bingo", href: "/explore" },
    };
  }
  return {
    tone: "wait",
    title: "Come back tomorrow",
    body: i != null && n > 0 ? `Day ${i + 2} of ${n} opens tomorrow — keep your streak.` : "Your next proof keeps your streak going.",
    remind: true,
  };
}

const playingNow = (b: BingoView) => !!b.me && b.me.status === "active" && b.me.phase !== "ended" && !b.me.missedDay;

/**
 * Home's single next step — the spine of the whole app. Same order as the
 * nudges: today's square → just finished / missed → verify → start the
 * starter Bingo → the 7-day one → explore. `featuredSlug` is the Bingo this
 * step is about, so Home doesn't show it a second time below.
 */
export function homeNextStep(input: {
  bingos: BingoView[];
  /** Face-verified (rewards and the welcome gift need it). null = still checking. */
  verified: boolean | null;
}): { step: NextStep; featuredSlug: string | null } {
  const { bingos } = input;

  // 1. A card in play: today's square, or "done for today".
  const playing = bingos
    .filter(playingNow)
    .sort((a, b) => Number(a.me!.todayUsed) - Number(b.me!.todayUsed) || Date.parse(a.me!.startedAt) - Date.parse(b.me!.startedAt));
  if (playing[0]) return { step: bingoNextStep(playing[0], bingos), featuredSlug: playing[0].slug };

  // 2. Just finished or missed a card → its own next step (level up, make it a habit, fresh start).
  const recent = bingos.find((b) => b.me && (b.me.requiredFilled >= b.missions.filter((m) => !m.bonus).length || b.me.missedDay));
  if (recent) return { step: bingoNextStep(recent, bingos), featuredSlug: recent.slug };

  // 3. Not verified yet — the one thing every reward (and the welcome gift) needs.
  if (input.verified === false) {
    return {
      step: {
        tone: "go",
        title: "One quick face check unlocks your rewards",
        body: "Verify once — then every Bingo photo pays G$, and new players get 1,000 G$ free to start.",
        cta: { label: "Verify now", action: "verify" },
      },
      featuredSlug: null,
    };
  }

  // 4. The way in: First Week (7 days + the welcome money, new and invited players only —
  // the list only has it for them), else a 7-day Bingo, else anything open. Never a
  // 3-day one first: the habit (and the money) is in the week.
  const starter = bingos.find((b) => b.slug === FIRST_WEEK && b.joinable);
  if (starter) {
    return {
      step: {
        tone: "go",
        kind: "first-week",
        title: `Start here: ${starter.title}`,
        body: "7 days, one photo a day — paid as you go.",
        cta: { label: "Start my first week", href: `/bingo/${starter.slug}` },
      },
      featuredSlug: starter.slug,
    };
  }
  const weekly = bingos.find((b) => b.durationDays === 7 && b.joinable);
  const pick = weekly ?? bingos.find((b) => b.joinable) ?? null;
  if (pick) {
    const stake = Math.min(...pick.tiers.map((t) => t.stake));
    const days = pick.durationDays;
    return {
      step: {
        tone: "go",
        title: `Next up: ${pick.title}`,
        body: `${days} days, one photo a day${pick.rewards.perProof > 0 ? `, ${fmt(pick.rewards.perProof)} G$ a photo` : ""} — stake ${fmt(stake)} G$ and get it back when you finish.`,
        cta: { label: `Start · ${fmt(stake)} G$`, href: `/bingo/${pick.slug}` },
      },
      featuredSlug: pick.slug,
    };
  }

  return { step: { tone: "wait", title: "New Bingos are on the way", body: "Explore missions while you wait.", cta: { label: "Explore", href: "/explore" } }, featuredSlug: null };
}
