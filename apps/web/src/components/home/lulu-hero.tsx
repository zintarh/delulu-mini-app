"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatUnits } from "viem";
import { Coin, Flame, GameLink, LuluScene, luluWeatherFor, type LuluWeather } from "@/components/ds";
import { useTodayQuests } from "@/components/home/home-progress";
import { destinationLabel, formatStakeAmount } from "@/components/forfeit/forfeit-day-card";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useJoinedCampaignDashboard, type JoinedDashboardCampaign } from "@/hooks/use-user-campaign-milestones";
import { usePendingReward } from "@/hooks/use-reward-vault";
import { useUserStore } from "@/stores/useUserStore";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { getTokenSymbol } from "@/lib/token-amounts";
import { getActiveMilestone } from "@/lib/community/milestone-submit-eligibility";
import { forfeitProgress, formatStake, getForfeitTerms } from "@/lib/community/campaign-forfeit";
import { fireConfetti } from "@/lib/celebrate";
import { useReportHomeReady } from "@/components/home/home-ready";
import { capitalizeFirst, cn, formatGAmount } from "@/lib/utils";

/* ─────────────────────────────── Messages ─────────────────────────────── */

export type LuluTone = "urgent" | "bad" | "reward" | "progress" | "happy" | "tip";

export type LuluMessage = {
  id: string;
  tone: LuluTone;
  /** Bold lead-in, e.g. a countdown ("2h 14m left"). */
  lead?: string;
  text: string;
  /** Bold trailing bit, e.g. the countdown in "Next one closes in 2h 14m". */
  tail?: string;
  /** Under an hour to go — the countdown turns orange. */
  hot?: boolean;
  cta?: { label: string; href: string };
  /** Called when the person acts on it (e.g. marks a miss as seen). */
  onAct?: () => void;
};

/** A personal goal still to prove today. */
export type LuluGoal = {
  id: string;
  title: string;
  deadlineMs: number;
  /** "500 G$" — null when nothing's staked. */
  stake: string | null;
  /** "your friend @ada", "Charity", "the pool"; null / "you" = nobody else gets it. */
  destination: string | null;
};

export type LuluInput = {
  kept: number;
  total: number;
  streak: number;
  goals: LuluGoal[];
  /** Joined campaigns, from the same source Home's quest rows use. */
  campaigns: JoinedDashboardCampaign[];
  /** Missed counts already acknowledged, per campaign. */
  seenMissed: Record<string, number>;
  onSeenMissed?: (_campaignId: string, _missed: number) => void;
  /** Message ids already acted on today — Lulu doesn't nag about them again. */
  doneToday?: Set<string>;
  /** Whole G$ sitting in the RewardVault for this wallet. */
  pendingReward: number;
  name?: string;
  now?: Date;
};

/** Messages shown at most — more than this and the dots stop meaning anything. */
const MAX_MESSAGES = 5;
const HOUR = 3_600_000;

const campaignHref = (c: JoinedDashboardCampaign) => `/communities/${c.community.slug}/campaigns/${c.campaign_id}`;

/** 8_040_000 → "2h 14m", 18_000_000 → "5h", 2_700_000 → "45m", under a minute → "<1m". */
export function formatCountdown(ms: number): string {
  if (ms < 60_000) return "<1m";
  const h = Math.floor(ms / HOUR);
  const m = Math.floor((ms % HOUR) / 60_000);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * When something closes, said the way a person would: a countdown when it's
 * close ("in 2h 14m"), otherwise a clock time ("at 11:59 PM",
 * "tomorrow at 9:00 AM", "Fri at 9:00 AM").
 */
export function formatCloses(at: number, now: Date): string {
  const ms = at - now.getTime();
  if (ms < 3 * HOUR) return `in ${formatCountdown(ms)}`;
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (dayDiff <= 0) return `at ${time}`;
  if (dayDiff === 1) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} at ${time}`;
}

/** Lowest priority: one rotating tip a day, so Lulu also teaches how Delulu works. */
const TIPS: { text: string; cta?: { label: string; href: string } }[] = [
  { text: "Tip: a friend can check your proofs for you. It's harder to fool a friend.", cta: { label: "New delulu", href: "/forfeit" } },
  { text: "Tip: campaigns are habits with a crew. More people, fewer excuses.", cta: { label: "Explore", href: "/explore" } },
  { text: "Tip: put a little money on a habit and you'll actually show up.", cta: { label: "Try it", href: "/forfeit" } },
  { text: "Tip: every proof you post earns points. Keep the streak and they pile up." },
];

/** Things Lulu says when you tap her. */
const QUIPS = [
  "Hi! Still here. Still believing in you.",
  "Boop. That tickles.",
  "You showing up is my favourite thing.",
  "One proof at a time. We've got this.",
  "Delulu is the solulu.",
];

/**
 * What Lulu should say, most important first. Pure, so every state can be
 * previewed (dev/preview) and tested without a wallet.
 */
export function pickLuluMessages(input: LuluInput): LuluMessage[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const done = input.doneToday ?? new Set<string>();
  const day = Math.floor(nowMs / 86_400_000);
  // Use their name now and then, not on every line.
  const hey = input.name && day % 2 === 0 ? `${capitalizeFirst(input.name)}, ` : "";

  // 1. Due today, soonest deadline first: campaign milestones + personal goals, with what a miss costs.
  const due: (LuluMessage & { at: number })[] = [];
  for (const c of input.campaigns) {
    const active = getActiveMilestone(c.next_milestones, nowMs);
    if (!active || active.completed) continue;
    const at = new Date(active.deadline).getTime();
    if (!Number.isFinite(at) || at <= nowMs) continue;
    const terms = getForfeitTerms({
      isFreeToJoin: c.is_free_to_join,
      joinAmount: c.join_amount,
      forfeitPct: c.forfeit_pct,
      joinToken: c.join_token,
      milestoneCount: c.milestone_count,
    });
    due.push({
      at,
      id: `due:${c.campaign_id}:${active.milestone_id}`,
      tone: terms ? "urgent" : "progress",
      lead: `${formatCountdown(at - nowMs)} left`,
      hot: at - nowMs < HOUR,
      text: terms
        ? `to prove "${capitalizeFirst(c.title)}". Miss it and ${formatStake(terms.perMiss)} ${terms.token} goes to the Delulu pool.`
        : `to prove "${capitalizeFirst(c.title)}".`,
      cta: { label: "Prove", href: campaignHref(c) },
    });
  }
  for (const g of input.goals) {
    if (!(g.deadlineMs > nowMs)) continue;
    const loses = g.stake && g.destination && g.destination !== "you";
    due.push({
      at: g.deadlineMs,
      id: `goal:${g.id}`,
      tone: loses ? "urgent" : "progress",
      lead: `${formatCountdown(g.deadlineMs - nowMs)} left`,
      hot: g.deadlineMs - nowMs < HOUR,
      text: loses
        ? `for "${capitalizeFirst(g.title)}". Miss it and ${g.stake} goes to ${g.destination}.`
        : `for "${capitalizeFirst(g.title)}". Keep it and I'll be sunny.`,
      cta: { label: "Prove", href: `/forfeit/${g.id}` },
    });
  }
  // One nudge for everything due, not a line per item — the quest cards right
  // below already list each one with its own Prove button.
  const out: LuluMessage[] = [];
  const left = Math.max(0, input.total - input.kept);
  if (due.length > 0) {
    const next = due.reduce((a, b) => (b.at < a.at ? b : a));
    const ms = next.at - nowMs;
    const n = due.length;
    const head =
      input.kept > 0
        ? `${hey}${input.kept} down, ${n} to go.`
        : n === 1
          ? `${hey}one proof to go today.`
          : `${hey}${n} proofs to go today.`;
    out.push({
      // Stable per count so "acted today" and the dots don't churn every tick.
      id: `due:${n}:${input.kept}`,
      tone: due.some((d) => d.tone === "urgent") ? "urgent" : "progress",
      text: `${capitalizeFirst(head)} ${n === 1 ? "It closes" : "Next one closes"}`,
      lead: undefined,
      hot: ms < HOUR,
      // Rendered as a bold countdown after the sentence.
      tail: formatCloses(next.at, now),
    });
  }

  // 2. Bad news, told once: a missed campaign milestone and what it cost.
  for (const c of input.campaigns) {
    const missed = c.missed_count ?? 0;
    const seen = input.seenMissed[c.campaign_id] ?? 0;
    if (missed <= seen) continue;
    const terms = getForfeitTerms({
      isFreeToJoin: c.is_free_to_join,
      joinAmount: c.join_amount,
      forfeitPct: c.forfeit_pct,
      joinToken: c.join_token,
      milestoneCount: c.milestone_count,
    });
    if (!terms) continue;
    const lostNow = Math.min(terms.stake, terms.perMiss * (missed - seen));
    const { left } = forfeitProgress(terms, missed);
    out.push({
      id: `missed:${c.campaign_id}:${missed}`,
      tone: "bad",
      text: `You missed "${capitalizeFirst(c.title)}". ${formatStake(lostNow)} ${terms.token} went to the Delulu pool, ${formatStake(left)} left.`,
      cta: { label: "See it", href: campaignHref(c) },
      onAct: () => input.onSeenMissed?.(c.campaign_id, missed),
    });
  }

  // 3. Money waiting in the vault.
  if (input.pendingReward > 0) {
    out.push({
      id: "reward",
      tone: "reward",
      text: `${formatGAmount(input.pendingReward)} G$ is waiting for you. You earned it.`,
      cta: { label: "Claim", href: "/rewards" },
    });
  }

  // 4. Where you stand today.
  if (input.total > 0 && left === 0) {
    out.push({
      id: "all-done",
      tone: "happy",
      text:
        input.streak >= 2
          ? `${hey}all done today. ${input.streak} days in a row. I'm so proud of you.`
          : `${hey}all done today. I'm so proud of you.`,
    });
  } else if (input.kept > 0 && left > 0 && due.length === 0) {
    out.push({ id: `progress:${input.kept}`, tone: "progress", text: `${hey}${input.kept} down, ${left} to go. One more makes my day.` });
  } else if (input.total === 0 && input.campaigns.length === 0) {
    out.push({
      id: "start",
      tone: "progress",
      text: `${hey}make one promise to yourself. I'll help you keep it.`,
      cta: { label: "New delulu", href: "/forfeit" },
    });
  }

  const real = out.filter((m) => !done.has(m.id)).map((m) => ({ ...m, text: m.lead ? m.text : capitalizeFirst(m.text) }));

  // 5. A tip only when there's room — real news always wins the slot.
  if (real.length < 2) {
    const tip = TIPS[day % TIPS.length]!;
    real.push({ id: `tip:${day % TIPS.length}`, tone: "tip", ...tip });
  }
  return real.slice(0, MAX_MESSAGES);
}

/* ─────────────────────────────── The scene ─────────────────────────────── */

type Sky = "morning" | "day" | "evening" | "night" | "grey" | "storm";

function skyFor(weather: LuluWeather, now: Date): Sky {
  if (weather === "storm" || weather === "sad") return "storm";
  if (weather === "gloomy") return "grey";
  const h = now.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}

/** Our palette only: yellow / pink / paper tints by day, ink at night, greys when Lulu's down. */
const SKY: Record<Sky, string> = {
  morning: "bg-gradient-to-b from-[#fff3c4] via-[#fdf1c7] to-[#fde6ef]",
  day: "bg-gradient-to-b from-[#ffe08a] via-[#fdf1c7] to-[#fffaf0]",
  evening: "bg-gradient-to-b from-[#f7c6d9] via-[#fde6ef] to-[#fdf1c7]",
  night: "bg-gradient-to-b from-ink via-ink-2 to-ink-3",
  grey: "bg-gradient-to-b from-[#e3e4df] to-[#f5f5f1]",
  storm: "bg-gradient-to-b from-[#c9cdd0] to-[#eceeee]",
};

const TONE_CTA: Record<LuluTone, "yellow" | "ink" | "green" | "line"> = {
  urgent: "ink",
  bad: "line",
  reward: "green",
  progress: "yellow",
  happy: "yellow",
  tip: "line",
};

/** Today's progress as a ring around Lulu. */
function ProgressRing({ value, done, onDark, burst }: { value: number; done: boolean; onDark: boolean; burst: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className={cn("absolute inset-0 h-full w-full -rotate-90", burst && "animate-bounce-in")} aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" strokeWidth="7" className={onDark ? "stroke-white/15" : "stroke-ink/10"} />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
        className={cn("transition-[stroke-dashoffset] duration-700 ease-out", done ? "stroke-green" : "stroke-yellow")}
      />
    </svg>
  );
}

function Stars() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {[
        [12, 18], [28, 8], [46, 22], [64, 10], [80, 26], [90, 12], [72, 40], [20, 44],
      ].map(([x, y], i) => (
        <circle key={i} cx={`${x}%`} cy={`${y}%`} r={i % 3 === 0 ? 1.6 : 1} className="animate-pulse fill-white/70" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </svg>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export type LuluHeroViewProps = {
  weather: LuluWeather;
  kept: number;
  total: number;
  streak: number;
  pendingReward: number;
  messages: LuluMessage[];
  now?: Date;
  /** Set right after a proof lands: sunny sky, a ring burst and a cheer. */
  celebrating?: string | null;
  /** Called when a message's button is used, so it can be retired for today. */
  onActed?: (_id: string) => void;
  /** Play the entrance animation (first time this session only). */
  intro?: boolean;
};

/**
 * Lulu as the voice of Home: a scene whose sky follows the time of day and
 * Lulu's mood, today's progress as a ring around Lulu, and one speech bubble
 * with the single most useful thing to do now. Swipe or tap the dots for more;
 * tap Lulu to say hi.
 */
export function LuluHeroView({
  weather,
  kept,
  total,
  streak,
  pendingReward,
  messages,
  now = new Date(),
  celebrating = null,
  onActed,
  intro = true,
}: LuluHeroViewProps) {
  const [index, setIndex] = useState(0);
  const [quip, setQuip] = useState<string | null>(null);
  const [poke, setPoke] = useState(0);
  const touchX = useRef<number | null>(null);
  const quipTimer = useRef<number | null>(null);

  const mood: LuluWeather = celebrating ? "sunny" : weather;
  const sky = skyFor(mood, now);
  const onDark = sky === "night";
  const safeIndex = Math.min(index, Math.max(0, messages.length - 1));
  const msg = messages[safeIndex];
  const done = total > 0 && kept >= total;

  // New top message (e.g. a proof just landed) → show it.
  const topId = messages[0]?.id;
  useEffect(() => setIndex(0), [topId]);
  useEffect(() => () => {
    if (quipTimer.current) window.clearTimeout(quipTimer.current);
  }, []);

  const go = (d: number) => setIndex((i) => (i + d + messages.length) % Math.max(1, messages.length));

  const tapLulu = () => {
    setPoke((p) => p + 1);
    setQuip(QUIPS[(poke + now.getDate()) % QUIPS.length]!);
    if (quipTimer.current) window.clearTimeout(quipTimer.current);
    quipTimer.current = window.setTimeout(() => setQuip(null), 2600);
  };

  // What the bubble shows: a cheer beats a quip beats the queue.
  const bubble: LuluMessage | undefined = celebrating
    ? { id: "cheer", tone: "happy", text: celebrating }
    : quip
      ? { id: `quip:${poke}`, tone: "happy", text: quip }
      : msg;

  return (
    <section
      aria-label="Lulu"
      className={cn(
        "relative overflow-hidden rounded-[28px] border-2 p-5 shadow-edge transition-colors duration-700",
        intro && "animate-rise",
        SKY[sky],
        onDark ? "border-ink-3 text-white" : "border-line text-ink",
      )}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || Math.abs(end - start) < 40 || messages.length < 2) return;
        go(end < start ? 1 : -1);
      }}
    >
      {sky === "night" ? <Stars /> : null}
      {sky === "day" || sky === "morning" ? (
        <span aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-yellow/40 blur-2xl" />
      ) : null}

      <div className="relative flex items-center gap-4">
        {/* Lulu inside today's ring — tap to say hi */}
        <button
          type="button"
          onClick={tapLulu}
          aria-label="Say hi to Lulu"
          className="relative h-[120px] w-[120px] shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <ProgressRing value={total > 0 ? kept / total : 0} done={done} onDark={onDark} burst={Boolean(celebrating)} />
          <span
            key={`${poke}:${celebrating ?? ""}`}
            className={cn("absolute inset-0 flex items-end justify-center pb-4", (poke > 0 || celebrating) && "animate-bounce-in")}
          >
            <LuluScene weather={mood} wave={Boolean(quip || celebrating)} className="origin-bottom scale-[1.15]" />
          </span>
          {total > 0 ? (
            <span
              className={cn(
                "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums shadow-sm",
                done ? "bg-green text-ink" : "bg-white text-ink",
              )}
            >
              {kept}/{total}
            </span>
          ) : null}
        </button>

        {/* Speech bubble */}
        {bubble ? (
          <div className="relative min-w-0 flex-1">
            <span aria-hidden className="absolute -left-2 top-6 h-4 w-4 rotate-45 rounded-[3px] bg-white" />
            {/* w-fit: the bubble hugs its words like a chat message instead of filling the row. */}
            <div className="relative w-fit max-w-full rounded-2xl rounded-tl-md bg-white px-3.5 py-3 text-ink shadow-[0_6px_18px_-8px_rgba(22,22,21,0.35)]">
              <p
                key={bubble.id}
                aria-live="polite"
                className={cn("m-0 animate-rise text-[15px] font-bold leading-snug", bubble.tone === "bad" && "text-orange")}
              >
                {bubble.lead ? (
                  <span className={cn("font-extrabold tabular-nums", bubble.hot ? "text-orange" : "text-ink")}>{bubble.lead} </span>
                ) : null}
                {bubble.text}
                {bubble.tail ? (
                  <>
                    {" "}
                    <span className={cn("font-extrabold", bubble.hot ? "text-orange" : "text-ink")}>{bubble.tail}</span>.
                  </>
                ) : null}
              </p>
              {bubble.cta ? (
                <GameLink
                  href={bubble.cta.href}
                  variant={TONE_CTA[bubble.tone]}
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    bubble.onAct?.();
                    onActed?.(bubble.id);
                  }}
                >
                  {bubble.cta.label}
                </GameLink>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Stats + message dots */}
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/streaks"
            className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold no-underline", onDark ? "bg-white/10 text-white" : "bg-white/70 text-ink")}
          >
            <Flame size={16} lit={streak > 0} />
            {streak} day{streak === 1 ? "" : "s"}
          </Link>
          {pendingReward > 0 ? (
            <Link
              href="/rewards"
              className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold no-underline", onDark ? "bg-white/10 text-white" : "bg-white/70 text-ink")}
            >
              <Coin size={16} />
              {formatGAmount(pendingReward)}
            </Link>
          ) : null}
        </div>
        {messages.length > 1 && !celebrating && !quip ? (
          <div className="flex items-center gap-1.5">
            {messages.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Message ${i + 1} of ${messages.length}`}
                aria-current={i === safeIndex}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === safeIndex ? "w-5" : "w-2",
                  i === safeIndex ? (onDark ? "bg-white" : "bg-ink") : onDark ? "bg-white/30" : "bg-ink/20",
                )}
              />
            ))}
            <button
              type="button"
              aria-label="Next message"
              onClick={() => go(1)}
              className={cn("ml-1 flex h-7 w-7 items-center justify-center rounded-full", onDark ? "bg-white/10" : "bg-white/70")}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.6} />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LuluHeroSkeleton() {
  return <div className="h-[212px] animate-pulse rounded-[28px] border-2 border-line bg-white/60" aria-busy="true" />;
}

/* ─────────────────────────────── Live data ─────────────────────────────── */

const SEEN_KEY = (id: string) => `delulu:campaign-missed-seen:${id}`;
const DONE_KEY = () => `delulu:lulu-done:${new Date().toDateString()}`;

function readDoneToday(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DONE_KEY()) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Home's Lulu, wired to real data. Replaces the Daily goal card and the missed-milestone banner. */
/** Lulu's entrance plays once per session, not every time Home is opened again. */
let luluIntroPlayed = false;

export function LuluHero({ address }: { address: string }) {
  const { kept, total, pendingItems, isLoading } = useTodayQuests(address);
  const { currentStreak, daysSinceKept, isLoading: streakLoading } = useUserStreak(address);
  const { data: campaigns, isLoading: campaignsLoading } = useJoinedCampaignDashboard(address);
  const { pending, isLoading: rewardLoading } = usePendingReward(
    address as `0x${string}`,
    GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
  );
  const user = useUserStore((s) => s.user);
  const [seenMissed, setSeenMissed] = useState<Record<string, number>>({});
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const [celebrating, setCelebrating] = useState<string | null>(null);

  // Countdowns tick (minute precision, so every 30s is plenty).
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setDoneToday(readDoneToday()), []);

  // Acknowledged misses live in localStorage (client only).
  useEffect(() => {
    if (!campaigns) return;
    const next: Record<string, number> = {};
    for (const c of campaigns) {
      try {
        next[c.campaign_id] = Number(window.localStorage.getItem(SEEN_KEY(c.campaign_id)) ?? 0) || 0;
      } catch {
        next[c.campaign_id] = 0;
      }
    }
    setSeenMissed(next);
  }, [campaigns]);

  // A proof landed while Home is open (goal kept, or a campaign proof counted) → celebrate.
  const campaignProofs = (campaigns ?? []).reduce((n, c) => n + (c.completed_count ?? 0), 0);
  const last = useRef<{ kept: number; proofs: number } | null>(null);
  useEffect(() => {
    if (isLoading || !campaigns) return;
    const prev = last.current;
    last.current = { kept, proofs: campaignProofs };
    if (!prev || (kept <= prev.kept && campaignProofs <= prev.proofs)) return;
    const streak = currentStreak ?? 0;
    setCelebrating(streak >= 2 ? `Kept! ${streak} days in a row. Look at you go.` : "Kept! That's how it's done.");
    if (!prefersReducedMotion()) {
      void fireConfetti();
      try {
        navigator.vibrate?.(40);
      } catch {
        /* not supported */
      }
    }
    const id = window.setTimeout(() => setCelebrating(null), 4500);
    return () => window.clearTimeout(id);
  }, [kept, campaignProofs, isLoading, campaigns, currentStreak]);

  const pendingReward = Number(formatUnits(pending, 18));

  const goals = useMemo<LuluGoal[]>(
    () =>
      pendingItems
        .filter((f) => f.onChainCommitmentId != null && f.onChain)
        .map((f) => {
          const amount = formatStakeAmount(f);
          return {
            id: String(f.onChainCommitmentId),
            title: f.title || "your goal",
            deadlineMs: Number(f.onChain!.currentPeriodDeadline) * 1000,
            stake: amount ? `${amount} ${getTokenSymbol(f.onChain!.token)}` : null,
            destination: destinationLabel(f),
          };
        }),
    [pendingItems],
  );

  const messages = useMemo(
    () =>
      pickLuluMessages({
        kept,
        total,
        streak: currentStreak ?? 0,
        goals,
        campaigns: campaigns ?? [],
        seenMissed,
        doneToday,
        pendingReward,
        name: user?.username || user?.displayName || undefined,
        now,
        onSeenMissed: (id, missed) => {
          try {
            window.localStorage.setItem(SEEN_KEY(id), String(missed));
          } catch {
            /* storage blocked — it shows again next visit */
          }
          setSeenMissed((s) => ({ ...s, [id]: missed }));
        },
      }),
    [kept, total, currentStreak, goals, campaigns, seenMissed, doneToday, pendingReward, user?.username, user?.displayName, now],
  );

  // First load waits for everything Lulu talks about, so her line doesn't switch a
  // second after she appears. After that she never falls back to the skeleton —
  // background refetches just update her.
  const hasShown = useRef(false);
  const firstLoadDone = !isLoading && !streakLoading && !campaignsLoading && !rewardLoading;
  if (firstLoadDone) hasShown.current = true;
  const ready = hasShown.current;
  useReportHomeReady("lulu", ready);
  const [intro] = useState(() => !luluIntroPlayed);
  useEffect(() => {
    if (ready) luluIntroPlayed = true;
  }, [ready]);

  if (!ready) return <LuluHeroSkeleton />;

  const weather = luluWeatherFor({ keptToday: total > 0 && kept >= total, daysSinceKept: daysSinceKept ?? null });
  return (
    <LuluHeroView
      weather={weather}
      kept={kept}
      total={total}
      streak={currentStreak ?? 0}
      pendingReward={pendingReward}
      messages={messages}
      now={now}
      celebrating={celebrating}
      intro={intro}
      onActed={(id) => {
        // Only soft nudges retire on tap (claim, get started). Countdowns stay until the proof
        // actually lands — tapping Prove and backing out mustn't hide a deadline. Misses use onAct.
        if (/^(due|goal|missed|tip):/.test(id)) return;
        setDoneToday((prev) => {
          const next = new Set(prev).add(id);
          try {
            window.localStorage.setItem(DONE_KEY(), JSON.stringify([...next]));
          } catch {
            /* storage blocked — fine for this visit */
          }
          return next;
        });
      }}
    />
  );
}
