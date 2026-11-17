/**
 * "What do I do next?" — the one line every screen ends on. Pure functions
 * so the copy is the same on the card, the proof sheet and Home, and so it's
 * testable. Every state has a next step; none is a dead end.
 */
import type { BingoView } from "@/lib/bingo/view";

const DAY_MS = 86_400_000;

export type NextStep = {
  tone: "go" | "wait" | "win" | "warn";
  title: string;
  body?: string;
  /** Countdown target ("opens in 5h", "closes in 2h"). */
  until?: string;
  untilLabel?: "opens" | "closes";
  /** Offer push reminders when the next step is "come back later". */
  remind?: boolean;
  cta?: { label: string; href?: string; action?: "join" | "today" };
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
