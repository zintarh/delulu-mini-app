import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { SEASON_EPOCHS } from "@/lib/referral/campaign";
import { loadActivity } from "@/lib/analytics/retention";
import { loadSeasonReport } from "@/lib/analytics/season";
import { flowTally, flowVoteStates } from "@/lib/flow-state-tally";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * GoodDollar's scorecard next to ours (Admin → Season).
 *
 * GoodDollar's metrics and definitions are the GoodBuilders S4 dashboard's
 * (Data Studio "Goodbuilders S4 Overview"); Season 5 says it will judge on
 * three things — verified users per app, sustainability (users spend, stake
 * and reuse G$ rather than only receive rewards) and community participation
 * — with one shared dashboard agreed before kickoff. Until that dashboard's
 * definitions are out, these are the closest we can measure ourselves.
 *
 * Status per row: "tracked" (same definition as GoodDollar's), "estimate"
 * (close, from our own records) or "missing" (we don't measure it yet).
 */
export type ScoreStatus = "tracked" | "estimate" | "missing";
export type ScoreRow = {
  key: string;
  /** GoodDollar's metric name. */
  metric: string;
  /** How GoodDollar defines it. */
  definition: string;
  /** Last season's figure, for scale. */
  benchmark: string | null;
  /** Our figure this season, or null when we don't measure it yet. */
  ours: string | null;
  /** Where our figure comes from / what to do to get it. */
  note: string;
  status: ScoreStatus;
  /** For a colour: is our number in good shape against the benchmark. */
  tone?: "good" | "bad" | null;
};
export type ScoreGroup = { key: "users" | "sustainability" | "community"; title: string; focus: string; rows: ScoreRow[] };
export type GdScorecard = { generatedAt: string; since: string; groups: ScoreGroup[] };

const DAY = 86_400_000;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtG = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : a >= 10_000 ? `${Math.round(a / 1000)}k` : fmt(a);
  return `${n < 0 ? "−" : n > 0 ? "+" : ""}${s} G$`;
};
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

/** Our contracts' on-chain G$ in/out from the ecosystem-share tables, if that tracker has run. */
async function ecosystemFlows(admin: Admin, sinceDay: string) {
  const { data: us, error } = await admin.from("gd_share_projects").select("name").eq("is_us", true).maybeSingle();
  if (error || !us) return null;
  const [{ data: days, error: dErr }, { data: network, error: nErr }] = await Promise.all([
    admin.from("gd_share_days").select("day, g_in, g_out, volume").eq("project", us.name).gte("day", sinceDay).limit(1000),
    admin.from("gd_share_network").select("day, total_g").gte("day", sinceDay).limit(1000),
  ]);
  if (dErr || nErr || !days?.length) return null;
  const gIn = days.reduce((n, d) => n + Number(d.g_in), 0);
  const gOut = days.reduce((n, d) => n + Number(d.g_out), 0);
  const volume = days.reduce((n, d) => n + Number(d.volume), 0);
  const counted = new Set(days.map((d) => String(d.day)));
  const networkG = (network ?? []).filter((d) => counted.has(String(d.day))).reduce((n, d) => n + Number(d.total_g), 0);
  return { gIn, gOut, volume, networkG, days: days.length };
}

export async function loadGdScorecard(admin: Admin, nowMs = Date.now()): Promise<GdScorecard> {
  const seasonStart = Date.parse(SEASON_EPOCHS[0].start);
  const sinceIso = new Date(seasonStart).toISOString();
  const sinceDay = lagosDay(seasonStart);

  const [activity, stakers, season, flows, tally, cheers] = await Promise.all([
    loadActivity(admin, seasonStart),
    admin.from("bingo_attempts").select("wallet, started_at").gte("started_at", sinceIso).limit(50_000),
    loadSeasonReport(admin, nowMs),
    ecosystemFlows(admin, sinceDay).catch(() => null),
    flowTally(admin).catch(() => null),
    admin.from("card_cheers").select("from_wallet, amount").gte("created_at", sinceIso).limit(50_000),
  ]);

  // ── Users ────────────────────────────────────────────────────────────────
  // Active = did something on-chain with us this season: an approved photo/kept day, or a stake.
  const active = new Set(activity.keys());
  const dayWallets = new Map<string, Set<string>>();
  for (const [w, ts] of activity) for (const t of ts) {
    const d = lagosDay(t);
    if (!dayWallets.has(d)) dayWallets.set(d, new Set());
    dayWallets.get(d)!.add(w);
  }
  for (const s of stakers.data ?? []) {
    const w = String(s.wallet).toLowerCase();
    active.add(w);
    const d = lagosDay(Date.parse(String(s.started_at)));
    if (!dayWallets.has(d)) dayWallets.set(d, new Set());
    dayWallets.get(d)!.add(w);
  }
  // Average over finished days only (today is still filling up).
  const today = lagosDay(nowMs);
  const fullDays = Math.max(1, Math.floor((nowMs - seasonStart) / DAY));
  const dauTotal = [...dayWallets.entries()].filter(([d]) => d !== today).reduce((n, [, s]) => n + s.size, 0);
  const avgDau = dauTotal / fullDays;

  const states = await flowVoteStates([...active]).catch(() => new Map<string, string>());
  const known = [...active].filter((w) => states.has(w));
  const verified = known.filter((w) => states.get(w) !== "unverified").length;
  const verifiedRatio = known.length ? verified / known.length : null;

  // ── Sustainability ───────────────────────────────────────────────────────
  const staked = season.epochs.reduce((n, e) => n + e.gStaked, 0);
  const paidOut = season.epochs.reduce((n, e) => n + e.gPaidOut, 0);
  const netFlow = flows ? flows.gIn - flows.gOut : null;

  // ── Community ────────────────────────────────────────────────────────────
  const cheerRows = cheers.error ? [] : (cheers.data ?? []);
  const cheerers = new Set(cheerRows.map((c) => String(c.from_wallet).toLowerCase())).size;
  const cheerG = cheerRows.reduce((n, c) => n + Number(c.amount), 0);

  const groups: ScoreGroup[] = [
    {
      key: "users",
      title: "Users",
      focus: "Season 5 puts growing the number of verified people using each app at the centre. S4 reached ~3,900 users against a 10,000 target.",
      rows: [
        {
          key: "active",
          metric: "Unique active users",
          definition: "Wallets that interacted with the app's contracts: a direct contract call or a G$ transfer.",
          benchmark: "S4: 3,847 across all teams (target 10,000)",
          ours: fmt(active.size),
          note: "Wallets with an approved photo, a kept day or a Bingo stake this season. Doesn't yet count wallets that only received a reward.",
          status: "estimate",
        },
        {
          key: "dau",
          metric: "Average daily active users",
          definition: "Active users (as above) per day, averaged over the season.",
          benchmark: "S4: 105 a day across all teams",
          ours: avgDau.toFixed(1),
          note: `Same activity as above, per Lagos day, over ${fullDays} finished day${fullDays === 1 ? "" : "s"}.`,
          status: "estimate",
        },
        {
          key: "verified",
          metric: "Whitelisted (verified) user ratio",
          definition: "Share of active users who are GoodDollar face-verified.",
          benchmark: "S4: 56.7% across all teams",
          ours: verifiedRatio == null ? null : `${pct(verifiedRatio)} (${fmt(verified)} of ${fmt(known.length)})`,
          note: "Checked on-chain against GoodDollar's identity contract, for every active wallet.",
          status: verifiedRatio == null ? "missing" : "tracked",
          tone: verifiedRatio == null ? null : verifiedRatio >= 0.567 ? "good" : "bad",
        },
        {
          key: "onboarded",
          metric: "Users onboarded into GoodDollar",
          definition: "Used the app's contracts within 24h of getting verified — people the app brought into GoodDollar.",
          benchmark: "S4: 1,954 across all teams",
          ours: null,
          note: "Needs each wallet's verification time (identities().dateAuthenticated) next to their first action. scripts/onchain-metrics.ts does this offline; not on the dashboard yet.",
          status: "missing",
        },
      ],
    },
    {
      key: "sustainability",
      title: "Sustainability",
      focus: "S4's G$ was mostly rewards paid out. Season 5 backs apps where users also spend, stake and reuse G$, so the app creates value instead of relying on grants.",
      rows: [
        {
          key: "netflow",
          metric: "G$ net flow to the app",
          definition: "G$ into the app's contracts minus G$ out. Positive = users pay in more than the app pays out.",
          benchmark: "S4: −4.6M G$ across all teams (mostly rewards out)",
          ours: netFlow != null ? fmtG(netFlow) : fmtG(staked - paidOut),
          note:
            netFlow != null
              ? `On-chain, our 4 contracts, ${flows!.days} day${flows!.days === 1 ? "" : "s"} counted (Admin → Ecosystem). ${fmtG(flows!.gIn).replace("+", "")} in · ${fmtG(flows!.gOut).replace("+", "")} out.`
              : "Estimate: G$ staked minus rewards paid. Stakes returned aren't subtracted, so the real figure is lower. Exact once Admin → Ecosystem has run.",
          status: netFlow != null ? "tracked" : "estimate",
          // The estimate leaves out returned stakes, so it would flatter us — only colour the real figure.
          tone: netFlow == null ? null : netFlow >= 0 ? "good" : "bad",
        },
        {
          key: "ratio",
          metric: "Staked vs paid out (ours)",
          definition: "Not a GoodDollar metric — our quick check that players put in more than we hand out.",
          benchmark: null,
          ours: paidOut > 0 ? `${(staked / paidOut).toFixed(2)}× (${fmtG(staked).replace("+", "")} staked · ${fmtG(paidOut).replace("+", "")} paid)` : null,
          note: "Above 1× = players stake more than rewards pay out. Same figures as the epoch cards below.",
          status: paidOut > 0 ? "tracked" : "missing",
          tone: paidOut > 0 ? (staked >= paidOut ? "good" : "bad") : null,
        },
        {
          key: "volume",
          metric: "Share of G$ volume",
          definition: "The app's share of all G$ volume moved in the ecosystem.",
          benchmark: "S4: 0.62% average for the program",
          ours: flows && flows.networkG > 0 ? pct(flows.volume / flows.networkG, 2) : null,
          note: flows ? "Our contracts' volume ÷ all G$ moved on Celo, same days." : "Comes from Admin → Ecosystem once its tables exist and it has run.",
          status: flows && flows.networkG > 0 ? "tracked" : "missing",
        },
        {
          key: "senders",
          metric: "Share of ecosystem G$ senders",
          definition: "Of everyone who sent G$ on a day, the share who sent it to this app. Counts people paying in, not people paid.",
          benchmark: "S4: 4.69% average daily share",
          ours: null,
          note: "Needs unique daily G$ senders network-wide vs. senders into our contracts. The ecosystem tracker counts wallets both ways, not senders yet. Cheers go player-to-player, so they don't count for us.",
          status: "missing",
        },
      ],
    },
    {
      key: "community",
      title: "Community participation",
      focus: "The community takes a bigger part in building: using and testing the apps, and voting for the teams they back.",
      rows: [
        {
          key: "votes",
          metric: "Votes for the team",
          definition: "Verified people backing the app in the GoodBuilders vote (Flow State council).",
          benchmark: null,
          ours: tally ? `${fmt(tally.voters)} of ${fmt(tally.canVote)} eligible players (${tally.canVote ? pct(tally.voters / tally.canVote, 0) : "—"}) · ${fmt(tally.votes)} votes` : null,
          note: "Our players who voted for Delulu, of those verified (can vote). Read on-chain.",
          status: tally ? "tracked" : "missing",
        },
        {
          key: "cheers",
          metric: "Players backing each other",
          definition: "Not a named GoodDollar metric — community activity inside the app.",
          benchmark: null,
          ours: cheers.error ? null : `${fmt(cheerRows.length)} cheers · ${fmt(cheerers)} people · ${fmtG(cheerG).replace("+", "")}`,
          note: "Cheers sent on Bingo cards this season.",
          status: cheers.error ? "missing" : "tracked",
        },
        {
          key: "testing",
          metric: "Using and testing the app",
          definition: "Community members helping test and shape the app.",
          benchmark: null,
          ours: null,
          note: "No tester group or feedback loop yet. Ideas: an early-features group, a feedback prompt after a finished card.",
          status: "missing",
        },
      ],
    },
  ];

  return { generatedAt: new Date(nowMs).toISOString(), since: sinceIso, groups };
}
