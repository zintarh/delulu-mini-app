"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
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
import { useEffect, useState } from "react";
import { fmtMoney, fmtNgn, type EarnFacts } from "@/lib/earn/format";

/* Copy and layout follow docs/redesign/screens/Main.dc.html. */

/** Live earn numbers for the landing page (no app providers here, so a plain fetch). */
function useLandingFacts(): EarnFacts | null {
  const [facts, setFacts] = useState<EarnFacts | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/earn/facts")
      .then((r) => (r.ok ? r.json() : null))
      .then((f) => alive && setFacts(f))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return facts;
}
const ngnOf = (facts: EarnFacts | null, g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);

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
          <a href="#faq" className="no-underline hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href={APP_HOME} className={gameButtonClass({ size: "sm" })}>
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
        {/* Lulu says the headline, the same way she speaks on Home: a speech
            bubble with its tail pointing down at a happy, waving Lulu. */}
        <div className="flex animate-rise flex-col items-start [animation-delay:.1s]">
          {/* Phones: chat-message sized (30px, tight padding). Grows at sm and lg. */}
          <div className="relative w-fit max-w-full rounded-[22px] rounded-bl-md border-2 border-line bg-white px-4 py-3 shadow-edge sm:rounded-[28px] sm:rounded-bl-lg sm:px-6 sm:py-4 lg:px-7 lg:py-5">
            <h1 className="m-0 font-display text-[30px] font-extrabold uppercase leading-[0.95] sm:text-[44px] lg:text-[clamp(52px,5vw,80px)] lg:leading-[0.92]">
              Build habits
              <br />
              you can&apos;t skip.
            </h1>
            <span
              aria-hidden
              className="absolute -bottom-[8px] left-7 h-3.5 w-3.5 rotate-45 rounded-[3px] border-b-2 border-r-2 border-line bg-white sm:-bottom-[9px] sm:left-9 sm:h-4 sm:w-4"
            />
          </div>
          <Lulu size={84} mood="kept" wave className="ml-2 mt-1.5 h-16 w-16 sm:ml-3 sm:mt-2 sm:h-[84px] sm:w-[84px]" />
        </div>
        <div className="flex animate-rise flex-wrap items-center gap-2.5 text-[clamp(20px,2vw,26px)] font-extrabold [animation-delay:.2s]">
          <span>Say it.</span>
          <span className="rounded-[10px] bg-yellow px-3 py-0.5 shadow-edge-yellow">Stake it.</span>
          <span>Prove it.</span>
        </div>
      </div>
      <p className="m-0 max-w-[470px] animate-rise text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-muted-foreground [animation-delay:.3s]">
        Pick a Bingo, post one photo a day, and get paid for showing up — your stake back plus cashback. Free money to start.
      </p>
      <HeroChips />
      <div className="flex animate-rise flex-wrap gap-3.5 [animation-delay:.4s]">
        <Link href={APP_HOME} className={gameButtonClass({ size: "lg" })}>
          Start now
        </Link>
      </div>
    </div>
  );
}

function HeroChips() {
  const facts = useLandingFacts();
  const chip = "inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-line bg-white px-3 text-[13px] font-extrabold shadow-edge-sm";
  return (
    <div className="flex animate-rise flex-wrap gap-2 [animation-delay:.35s]">
      {facts?.firstWeek ? (
        <span className={cn(chip, "border-yellow-line bg-yellow-soft")}>🎁 Your first week pays ≈ {fmtNgn(facts.firstWeek.entry.ngn)}</span>
      ) : null}
      <span className={chip}>📸 Paid every photo</span>
      <span className={chip}>🏆 Stake back + cashback</span>
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

/* ---------------------------------------------------------------- how you earn */
/** Cashback on finishing (stake back + this), as the Bingos are set up: 3-day light stakes, 7-day bigger ones. */
const CASHBACK_LADDER: { days: 3 | 7; stake: number; back: number }[] = [
  { days: 3, stake: 2_000, back: 80 },
  { days: 3, stake: 5_000, back: 200 },
  { days: 7, stake: 10_000, back: 800 },
  { days: 7, stake: 20_000, back: 2_000 },
  { days: 7, stake: 30_000, back: 3_000 },
];

export function TwoWaysSection() {
  const facts = useLandingFacts();
  const k = (n: number) => `${n / 1000}k`;
  const card = "reveal flex flex-col gap-3 rounded-[28px] border-2 border-line bg-white p-7 shadow-[0_6px_0_#e6e6e0]";
  return (
    <section id="ways" className="border-y-2 border-line bg-white">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-12 px-6 py-[110px]">
        <SectionHead title={<>Show up.<br />Get paid.</>} sub="One photo a day. Every kept day pays — and finishing pays the most." />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
          {/* First Week — the way in */}
          <div data-reveal="left" className="reveal relative flex flex-col gap-3 rounded-[28px] border-2 border-yellow-line bg-yellow-soft p-7 shadow-[0_8px_0_#e5b41c]">
            <span className="label-mono text-[11px] text-[#6b5300]">New here</span>
            <span className="text-2xl font-extrabold">Your first week pays you</span>
            <span className="font-display text-[56px] font-extrabold leading-[0.9]">{facts?.firstWeek ? fmtMoney(facts.firstWeek.entry) : "≈ ₦1,000"}</span>
            <span className="text-[15px] leading-snug text-[#5c4a0a]">Show up 7 days in a row on Your First Week — paid as you go, plus a bonus when you finish. Once per person.</span>
          </div>

          {/* The ladder */}
          <div data-reveal="right" style={revealDelay(0.1)} className={card}>
            <span className="flex items-center gap-2 text-2xl font-extrabold">
              <Coin size={28} /> Stake more, get more back
            </span>
            <span className="text-[15px] text-muted-foreground">Finish a Bingo: your stake comes back with cashback on top.</span>
            <div className="mt-1 flex flex-col gap-1.5">
              {CASHBACK_LADDER.map((r) => (
                <div key={r.stake} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-[14px] font-bold">
                  <span>
                    {k(r.stake)} G$ <span className="font-semibold text-muted-foreground">· {r.days} days</span>
                  </span>
                  <span className="text-green-edge">
                    +{r.back.toLocaleString("en-US")} back{ngnOf(facts, r.back) ? ` ≈ ${ngnOf(facts, r.back)}` : ""}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground">Bigger stakes earn more points too — the higher your stake, the higher you rank (top 10 share 250,000 G$ every 2 weeks).</span>
          </div>

          <div data-reveal="left" style={revealDelay(0.15)} className={card}>
            <span className="text-2xl font-extrabold">📸 Every photo pays</span>
            <span className="text-[15px] text-muted-foreground">100 G$ for each day you keep{ngnOf(facts, 100) ? ` (≈ ${ngnOf(facts, 100)})` : ""}, the same day. Miss a day and the card ends — you keep everything you earned.</span>
          </div>
          <div data-reveal="right" style={revealDelay(0.2)} className={card}>
            <span className="text-2xl font-extrabold">🤝 Invite friends</span>
            <span className="text-[15px] text-muted-foreground">5,000 G$ for each friend who joins and shows up{ngnOf(facts, 5000) ? ` (≈ ${ngnOf(facts, 5000)})` : ""}. Fresh spots every Tuesday.</span>
          </div>
          <div data-reveal="left" style={revealDelay(0.25)} className={card}>
            <span className="text-2xl font-extrabold">🇳🇬 Turn it into naira</span>
            <span className="text-[15px] text-muted-foreground">Cash out from 5,000 G$. Start with free money every day from GoodDollar after one face check.</span>
          </div>
        </div>
        <p className="m-0 text-center text-[13px] text-muted-foreground">G$ is a token, so its price moves — naira amounts are at today&apos;s rate.</p>
        <div className="flex justify-center">
          <Link href={APP_HOME} className={gameButtonClass({ size: "lg" })}>
            Start now
          </Link>
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
        <Feature title="Leaderboards" line="A weekly board, and every 2 weeks the top 10 share 250,000 G$.">
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
  ["Do I need money to start?", "No. After one quick face check you can claim free money every day from GoodDollar — and new players' first week pays them."],
  ["How much can I earn?", "Every photo pays 100 G$. Finish a Bingo and your stake comes back with cashback on top — bigger stakes get more. Invite friends for 5,000 G$ each."],
  ["What happens if I miss a day?", "The card ends and that stake goes to the community pool. You keep everything you've earned so far, and you can start another Bingo."],
  ["How are proofs checked?", "AI checks your photo in seconds. Each day runs midnight to midnight, so you have the whole day to post."],
  ["Can I turn it into naira?", "Yes — from 5,000 G$. G$ is a token, so its naira value moves with the market."],
  ["Why the face check?", "It proves you're one real person, so rewards stay fair. It also unlocks free daily money and rewards."],
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
          <p className="m-0 text-lg text-[#c9c9c2]">One photo a day. Your stake back plus cashback when you finish. Free money to start.</p>
          <div className="flex flex-wrap gap-3.5">
            <Link href={APP_HOME} className={gameButtonClass({ size: "lg" })}>
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
            <a href="#ways" className="no-underline">How it works</a>
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
