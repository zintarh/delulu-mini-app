"use client";

import Link from "next/link";
import { Camera, FileText, MessageCircle, Plus, X } from "lucide-react";
import {
  Bolt,
  CheckDot,
  Chest,
  Coin,
  ConfettiStatic,
  Flame,
  Lulu,
  Medal,
  Trophy,
  gameButtonClass,
} from "@/components/ds";
import { Wordmark } from "@/components/wordmark";
import { TG_GROUP_URL } from "@/components/get-gas-modal";
import { cn } from "@/lib/utils";
import { APP_HOME } from "@/components/main-nav-config";

/* Copy and layout follow docs/redesign/screens/Main.dc.html. */

function SectionHead({ title, sub, center = true }: { title: React.ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3.5", center && "items-center text-center")}>
      <h2 className="reveal m-0 font-display text-[clamp(44px,5.6vw,84px)] font-extrabold uppercase leading-[0.9]">{title}</h2>
      {sub && <p style={revealDelay(0.1)} className="reveal m-0 max-w-[520px] text-lg leading-normal text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[38px] items-center gap-1.5 rounded-xl border-2 border-line bg-white px-3 text-[15px] font-extrabold shadow-edge", className)}>
      {children}
    </span>
  );
}

/** Inline style that delays a .reveal entrance, for staggering lists. */
const revealDelay = (seconds: number) => ({ "--reveal-delay": `${seconds}s` }) as React.CSSProperties;

/* ---------------------------------------------------------------- header */
export function LandingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header data-reveal="down" className="reveal sticky top-0 z-30 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link href="/" aria-label="Delulu" className="no-underline">
          <Wordmark size={26} />
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap gap-7 text-[15px] font-bold max-sm:hidden">
          <a href="#ways" className="no-underline hover:text-ink">Ways to play</a>
          <a href="#week" className="no-underline hover:text-ink">How it works</a>
          <a href="#faq" className="no-underline hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href={signedIn ? APP_HOME : "/sign-in"} className={gameButtonClass({ size: "sm" })}>
            {signedIn ? "Open app" : "Start now"}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- hero (text side) */
export function HeroCopy() {
  return (
    <div className="flex min-w-0 flex-[1_1_500px] flex-col gap-[26px]">
      <span className="animate-rise self-start">
        <Pill className="text-[13px]">
          <Flame size={18} />
          The habit contract
        </Pill>
      </span>
      <div className="flex flex-col gap-3.5">
        <h1 className="m-0 animate-rise font-display text-[clamp(46px,5.4vw,80px)] font-extrabold uppercase leading-[0.92] [animation-delay:.1s]">
          Build habits
          <br />
          you can&apos;t skip.
        </h1>
        <div className="flex animate-rise flex-wrap items-center gap-2.5 text-[clamp(20px,2vw,26px)] font-extrabold [animation-delay:.2s]">
          <span>Say it.</span>
          <span className="rounded-[10px] bg-yellow px-3 py-0.5 shadow-edge-yellow">Stake it.</span>
          <span>Prove it.</span>
        </div>
      </div>
      <p className="m-0 max-w-[470px] animate-rise text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-muted-foreground [animation-delay:.3s]">
        Pick a habit, put your word or a little money on it, and prove it each day with a photo. Free to start.
      </p>
      <div className="flex animate-rise flex-wrap gap-3.5 [animation-delay:.4s]">
        <Link href="/sign-in" className={gameButtonClass({ size: "lg" })}>
          Start now
        </Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- free money banner */
export function FreeMoneyBanner() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 pb-24">
      <div data-reveal="pop" className="reveal flex flex-wrap items-center gap-6 rounded-[28px] border-2 border-yellow-line bg-yellow-soft px-7 py-6 shadow-[0_6px_0_#e5b41c]">
        <span className="inline-block animate-wiggle">
          <Chest size={84} />
        </span>
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="text-2xl font-extrabold">No money? Start with free money.</div>
          <div className="mt-1.5 text-base leading-normal text-muted-foreground">
            Do a quick face check once, then claim free money every day from GoodDollar. Stake it on your habits, or keep it.
          </div>
        </div>
        <Link href="/sign-in" className={gameButtonClass({ variant: "ink" })}>
          Claim yours
        </Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- problem */
export function ProblemSection() {
  const xRow = (t: string) => (
    <div className="flex items-center gap-3 text-muted-foreground">
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#ecece7] text-faint">
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      {t}
    </div>
  );
  const okRow = (t: string) => (
    <div className="flex items-center gap-3 font-semibold">
      <CheckDot size={26} />
      {t}
    </div>
  );
  return (
    <section id="problem" className="mx-auto flex max-w-[1100px] flex-col gap-12 px-6 py-[110px]">
      <SectionHead title="Goals are free to quit." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-6">
        <div data-reveal="left" className="reveal flex flex-col gap-[18px] rounded-3xl border-2 border-dashed border-[#d6d6cf] bg-[#efefea] p-7">
          <div className="flex items-center gap-3">
            <Flame size={40} lit={false} />
            <span className="text-xl font-extrabold text-[#6b6b65]">Without stakes</span>
          </div>
          {xRow("Skip today, nobody notices")}
          {xRow("Nothing for showing up")}
          {xRow("Motivation fades fast")}
        </div>
        <div data-reveal="right" style={revealDelay(0.12)} className="reveal relative flex flex-col gap-[18px] rounded-[28px] border-2 border-yellow-line bg-white p-8 shadow-[0_8px_0_#e5b41c]">
          <span className="absolute -right-3.5 -top-[18px] animate-bounce-in">
            <Pill className="text-blue">
              <Bolt size={18} />
              Level up
            </Pill>
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex animate-bob">
              <Flame size={44} />
            </span>
            <span className="text-[22px] font-extrabold">With Delulu</span>
          </div>
          {okRow("Your word or money on the line")}
          {okRow("AI-checked proof, every day")}
          {okRow("Streaks, points and rewards")}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- two ways to play */
export function TwoWaysSection() {
  const row = (t: string) => (
    <div className="flex items-center gap-3">
      <CheckDot size={26} />
      <span>{t}</span>
    </div>
  );
  return (
    <section id="ways" className="border-y-2 border-line bg-white">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-14 px-6 py-[110px]">
        <SectionHead
          title={<>Stake your word.<br />Or stake money.</>}
          sub="Start free in a minute. Earn 10× the points when you add money."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-stretch gap-7">
          <div data-reveal="left" className="reveal flex flex-col gap-[22px] rounded-[28px] border-2 border-line bg-white p-8 shadow-[0_6px_0_#e6e6e0]">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-pink-soft text-pink">
                  <MessageCircle className="h-[26px] w-[26px]" strokeWidth={2.4} />
                </span>
                <span className="text-2xl font-extrabold">Stake your word</span>
              </span>
              <Pill className="h-[34px] text-[13px]">Free</Pill>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[72px] font-extrabold leading-[0.9]">+100</span>
              <span className="label-mono text-muted-foreground">points per day kept</span>
            </div>
            <div className="label-mono -mb-3 text-[10px] text-muted-foreground">If you miss, you might…</div>
            <div className="flex flex-wrap gap-2">
              {["Call my dad", "5,000 words to my boss", "Public post"].map((t, i) => (
                <span key={t} data-reveal="pop" style={revealDelay(0.3 + i * 0.08)} className="reveal inline-flex h-[34px] items-center rounded-xl border-2 border-pink-line bg-pink-soft px-3 text-[13px] font-extrabold shadow-[0_3px_0_#f6c3d6]">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {row("Start right away. No money needed.")}
              {row("AI checks every proof in seconds")}
              {row("Streaks, badges and share cards")}
            </div>
            <Link href="/sign-in" className={gameButtonClass({ variant: "line", full: true, className: "mt-auto" })}>
              Start now
            </Link>
          </div>

          <div data-reveal="right" style={revealDelay(0.12)} className="reveal relative flex flex-col gap-[22px] rounded-[28px] border-2 border-yellow-line bg-yellow-soft p-8 shadow-[0_8px_0_#e5b41c]">
            <span className="absolute -top-5 right-6 animate-bounce-in">
              <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-blue-edge bg-blue px-3 text-[15px] font-extrabold text-white shadow-edge-blue">
                <Bolt size={18} color="#FFFFFF" />
                10× points
              </span>
            </span>
            <div className="flex items-center gap-3">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-white">
                <Coin size={30} />
              </span>
              <span className="text-2xl font-extrabold">Stake money</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[72px] font-extrabold leading-[0.9]">+1,000</span>
              <span className="label-mono text-[#6b5300]">points per day kept</span>
            </div>
            <div className="flex flex-col gap-3">
              {row("Finish and get all your money back")}
              {row("Join challenges with cash prizes")}
              {row("Free daily money after a quick face check")}
            </div>
            <Link href="/sign-in" className={gameButtonClass({ variant: "ink", full: true, className: "mt-auto" })}>
              Start now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- a week with delulu */
function Tag({ children, tone }: { children: React.ReactNode; tone: "pts" | "grey" | "green" }) {
  const cls = { pts: "bg-blue-tint text-blue", grey: "bg-[#ecece7] text-ink", green: "bg-green-soft text-green-edge" }[tone];
  return <span className={cn("rounded-lg px-[7px] py-1 font-mono text-[9px] font-semibold", cls)}>{children}</span>;
}

const WEEK: { day: string; art: React.ReactNode; title: string; tag: React.ReactNode; up?: boolean }[] = [
  { day: "MON", art: <FileText className="h-10 w-10" strokeWidth={2.2} />, title: "Sign your contract", tag: <Tag tone="grey">Nº 0042</Tag> },
  { day: "TUE", art: <Camera className="h-10 w-10 text-blue" strokeWidth={2.2} />, title: "Snap a photo as proof. AI checks it.", tag: <Tag tone="pts">+1,000</Tag>, up: true },
  { day: "WED", art: <Flame size={48} />, title: "Day 2 in a row. Your streak begins.", tag: <Tag tone="pts">+1,000</Tag> },
  { day: "THU", art: <Lulu size={64} mood="worried" />, title: "A reminder saves the day. Photo in at 20:59.", tag: <Tag tone="pts">+1,000</Tag>, up: true },
  { day: "FRI", art: <Medal label="5" bg="#FFD9BF" edge="#E0915A" size={56} />, title: "Badge unlocked: 5-day streak", tag: <Tag tone="pts">+1,000</Tag> },
  { day: "SAT", art: <Trophy size={52} />, title: "You climb to #5 this week", tag: <Tag tone="green">▲ 3</Tag>, up: true },
  { day: "SUN", art: <Lulu size={64} mood="kept" />, title: "Done! Money back, plus 7,000 points", tag: <Tag tone="green">Kept</Tag> },
];

export function WeekSection() {
  return (
    <section id="week" className="border-y-[3px] border-ink bg-yellow">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-7 px-6 pb-[90px] pt-[100px]">
        <div className="flex flex-col gap-3.5">
          <h2 className="reveal m-0 font-display text-[clamp(48px,6vw,88px)] font-extrabold uppercase leading-[0.9]">A week with Delulu.</h2>
          <p style={revealDelay(0.1)} className="reveal m-0 text-[17px] font-medium leading-normal">One habit, seven days. Here&apos;s what it looks like.</p>
        </div>
        <div className="grid snap-x grid-cols-[repeat(7,minmax(168px,1fr))] gap-4 overflow-x-auto px-1 pb-6 pt-7 scrollbar-hide">
          {WEEK.map((d, i) => (
            <div
              key={d.day}
              style={revealDelay(i * 0.07)}
              className={cn(
                "reveal relative flex min-h-[220px] snap-start flex-col gap-3 rounded-[22px] border-2 border-ink bg-white p-4 shadow-[0_5px_0_#161615]",
                d.up && "-top-[18px]",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold">{d.day}</span>
                {d.tag}
              </div>
              <div className="flex h-[84px] items-center justify-center rounded-2xl bg-paper">{d.art}</div>
              <div className="text-[17px] font-extrabold leading-tight">{d.title}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- features */
function Feature({ title, line, delay = 0, children }: { title: string; line: string; delay?: number; children: React.ReactNode }) {
  return (
    <div style={revealDelay(delay)} className="reveal flex flex-col gap-[18px] rounded-3xl border-2 border-line bg-white p-6 shadow-[0_6px_0_#e6e6e0]">
      <div className="flex min-h-[150px] items-center justify-center rounded-[18px] bg-paper p-4">{children}</div>
      <div>
        <h3 className="m-0 text-[21px] font-extrabold">{title}</h3>
        <p className="mt-1.5 leading-normal text-muted-foreground">{line}</p>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const leagueRow = (n: number, l: string, bg: string, name: string, xp: string, you = false) => (
    <div className={cn("flex items-center gap-2 rounded-[10px] px-2 py-1.5", you && "border-2 border-yellow-line bg-yellow-soft")}>
      <span className="w-4 font-display text-base font-extrabold">{n}</span>
      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: bg }}>{l}</span>
      <span className="flex-1 text-[13px] font-bold">{name}</span>
      <span className="font-mono text-[9px]">{xp}</span>
    </div>
  );
  return (
    <section id="game" className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 py-[110px]">
      <SectionHead title="Every kept day counts." />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        <Feature title="Leaderboards" line="Weekly rankings and an all-time board.">
          <div className="flex w-full flex-col gap-1">
            <div className="mb-1 flex items-center gap-2">
              <Trophy size={32} />
              <span className="font-extrabold">Gold League</span>
            </div>
            {leagueRow(4, "S", "#ecece7", "@seun", "1,760")}
            {leagueRow(5, "F", "#fbece3", "@fola", "1,640")}
            {leagueRow(6, "A", "#fff", "You", "1,590", true)}
          </div>
        </Feature>
        <Feature title="Badges" delay={0.08} line="Earn badges for streaks and milestones.">
          <div className="flex gap-2.5">
            <Medal label="1ST" bg="#FDF1C7" edge="#E5B41C" size={50} className="text-base" />
            <Medal label="7D" bg="#FFD9BF" edge="#E0915A" size={50} className="text-base" />
            <Medal label="10" bg="#C9EBD7" edge="#7CC49C" size={50} className="text-base" />
            <Medal locked size={50} />
          </div>
        </Feature>
        <Feature title="Share cards" delay={0.16} line="Show off your streak on any app.">
          <div className="flex">
            <div className="flex h-[168px] w-[120px] -rotate-[5deg] flex-col rounded-[18px] bg-ink p-3 text-white shadow-lift">
              <span className="font-brand text-[13px] font-bold">delulu</span>
              <span className="mt-2.5 font-display text-[72px] font-extrabold leading-[0.8] text-yellow">12</span>
              <span className="mt-1.5 font-display text-[13px] font-extrabold uppercase">Day streak</span>
              <span className="mt-auto font-mono text-[7px] text-[#a3a39c]">@ada</span>
            </div>
            <div className="-ml-10 flex h-[168px] w-[120px] rotate-[6deg] flex-col rounded-[18px] bg-yellow p-3 shadow-lift">
              <span className="font-brand text-[13px] font-bold">delulu</span>
              <span className="mt-3.5 font-display text-[60px] font-extrabold leading-[0.8]">6/7</span>
              <span className="mt-1.5 font-display text-[13px] font-extrabold uppercase">This week</span>
              <span className="mt-auto font-mono text-[7px]">@kemi</span>
            </div>
          </div>
        </Feature>
        <Feature title="Free daily money" delay={0.24} line="Verified people claim free money every day.">
          <div className="flex items-center gap-[18px]">
            <span className="inline-block animate-wiggle">
              <Chest size={84} />
            </span>
            <span className={gameButtonClass({ variant: "ink", size: "sm" })}>Open</span>
          </div>
        </Feature>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- stories */
/**
 * Real member quotes go here. The section stays hidden until this has
 * entries, so placeholder quotes never ship.
 */
const TESTIMONIALS: { name: string; tag: string; streak: number; quote: string; initial: string; bg: string }[] = [];

export function StoriesSection() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section id="stories" className="border-y-2 border-line bg-paper">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-6 py-[110px]">
        <SectionHead title="Proof, not promises." />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
          {TESTIMONIALS.map((t, i) => (
            <figure key={t.name} style={revealDelay(i * 0.1)} className="reveal m-0 flex flex-col gap-[18px] rounded-3xl border-2 border-line bg-white p-6 shadow-[0_6px_0_#e6e6e0]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full font-bold" style={{ background: t.bg }}>{t.initial}</span>
                <div className="flex-1">
                  <div className="font-bold">{t.name}</div>
                  <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">{t.tag}</div>
                </div>
                <Pill className="h-8 text-[13px]">
                  <Flame size={16} />
                  {t.streak}
                </Pill>
              </div>
              <blockquote className="m-0 text-[19px] font-medium leading-[1.45]">“{t.quote}”</blockquote>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- FAQ */
const FAQS: [string, string][] = [
  ["Do I need money to start?", "No. Stake your word for free. Want to stake money? Verify once and claim free money every day from GoodDollar."],
  ["How are proofs checked?", "AI checks your photo in seconds. You can add a friend as a witness if you like, but you don't have to."],
  ["What happens if I miss a day?", "You pay up. Do the consequence you picked, or your money goes to the friend, charity or community pool you chose."],
  ["Why the face check?", "It proves you're one real person, so rewards stay fair. It also unlocks free daily money, money stakes and 10× points."],
  ["Where does the free money come from?", "GoodDollar gives verified people a small amount of free money (G$) every day. Keep it, or stake it on your habits."],
];

export function FaqSection() {
  return (
    <section id="faq" className="border-y-2 border-line bg-white">
      <div className="mx-auto flex max-w-[820px] flex-col gap-10 px-6 py-[110px]">
        <div className="flex flex-wrap items-center justify-center gap-[18px] text-center">
          <span className="inline-flex">
            <Lulu size={72} />
          </span>
          <h2 className="reveal m-0 font-display text-[clamp(44px,5.4vw,76px)] font-extrabold uppercase leading-[0.9]">Questions?</h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQS.map(([q, a], i) => (
            <details key={q} style={revealDelay(i * 0.06)} className="faq reveal group overflow-hidden rounded-[20px] border-2 border-line bg-white shadow-edge">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow shadow-[0_3px_0_#c99a0a] transition-transform duration-300 group-open:rotate-45">
                  <Plus className="h-[18px] w-[18px]" strokeWidth={2.8} />
                </span>
              </summary>
              <p className="m-0 px-[22px] pb-[22px] text-base leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- final CTA */
export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 py-[110px]">
      <div data-reveal="pop" className="reveal relative flex flex-wrap items-center justify-between gap-8 overflow-hidden rounded-[36px] bg-ink px-[clamp(24px,6vw,72px)] py-[clamp(40px,6vw,80px)] text-white shadow-[0_10px_0_#000]">
        <ConfettiStatic
          pieces={[
            { left: "6%", top: "14%", color: "#F6C324", rotate: 20 },
            { left: "46%", top: "8%", color: "#2DB36F", rotate: -30, w: 10, h: 16 },
            { left: "58%", top: "84%", color: "#EC5B8D", rotate: 25 },
            { left: "92%", top: "12%", color: "#2DB36F", rotate: -15 },
            { left: "30%", top: "88%", color: "#F6C324", rotate: 40, w: 10, h: 16 },
          ]}
        />
        <div className="relative flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
          <h2 className="m-0 font-display text-[clamp(52px,7vw,108px)] font-extrabold uppercase leading-[0.9] text-white">
            Your streak
            <br />
            <span className="text-yellow">starts today.</span>
          </h2>
          <p className="m-0 text-lg text-[#c9c9c2]">Start free with your word. Earn 10× the points with money.</p>
          <div className="flex flex-wrap gap-3.5">
            <Link href="/sign-in" className={gameButtonClass({ size: "lg" })}>
              Start now
            </Link>
          </div>
        </div>
        <span className="relative inline-flex">
          <Lulu size={200} mood="kept" wave className="lu-sticker" />
        </span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- footer */
export function LandingFooter() {
  return (
    <footer className="reveal">
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-10 px-6 pt-10">
        <p className="label-mono m-0 text-muted-foreground">The habit contract · Built on Celo</p>
        <div className="flex flex-wrap gap-14">
          <div className="flex flex-col gap-3">
            <span className="label-mono text-muted-foreground">Product</span>
            <a href="#week" className="no-underline">How it works</a>
            <Link href="/explore" className="no-underline">Challenges</Link>
            <Link href="/profile/flex" className="no-underline">Share cards</Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="label-mono text-muted-foreground">Company</span>
            <Link href="/terms" className="no-underline">Terms</Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="label-mono text-muted-foreground">Follow</span>
            <a href={TG_GROUP_URL} target="_blank" rel="noreferrer" className="no-underline">Telegram</a>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 pb-8 pt-14">
        <Wordmark size={34} />
        <span className="label-mono text-muted-foreground">Keep your word</span>
      </div>
      <div className="label-mono flex flex-wrap justify-between gap-2 border-t-2 border-line px-6 py-4 text-muted-foreground">
        <span>© 2026 Delulu</span>
        <span>Built on Celo</span>
      </div>
    </footer>
  );
}
