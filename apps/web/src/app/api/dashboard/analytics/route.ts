import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { WEEK1_RETENTION_TARGET, loadRetention, type RetentionCohort } from "@/lib/analytics/retention";
import { FUNNEL, loadPeople, reachedStep, stageOf, type FunnelKey, type Person } from "@/lib/nudges/people";
import { NUDGE_RULES, RULE_LABEL, pickNudge, type NudgeRule } from "@/lib/nudges/rules";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;

export type AnalyticsPerson = {
  wallet: string;
  username: string | null;
  hasEmail: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  installed: boolean;
  pushOn: boolean;
  stage: FunnelKey;
  nextNudge: NudgeRule | null;
};

export type AnalyticsDto = {
  days: number;
  generatedAt: string;
  totals: { signups: number; installed: number; pushOn: number; hasEmail: number; activeToday: number; playingNow: number };
  funnel: { key: FunnelKey; label: string; count: number; pct: number }[];
  cohorts: { day: string; signups: number; onboarded: number; started: number; day1: number; day3: number; completed: number }[];
  installSplit: { group: "Installed" | "Not installed"; people: number; day1Pct: number; day3Pct: number; completedPct: number }[];
  stuck: Record<FunnelKey, AnalyticsPerson[]>;
  nudges: { rule: NudgeRule; label: string; sent7d: number; acted7d: number; dueNow: number }[];
  trackingSince: string | null;
  /** Weekly signup cohorts: how many were still keeping days in their second week (target 10%). */
  weekly: { cohorts: RetentionCohort[]; activeLast7d: number; target: number };
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const lagosDay = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10);

/** GET /api/dashboard/analytics?days=14 — signups, drop-off, installs and nudges for people who joined recently. */
export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const days = Math.min(90, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 14) || 14));
  const now = Date.now();
  let people: Person[];
  try {
    people = await loadPeople(admin, new Date(now - days * DAY).toISOString(), now);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 });
  }

  const funnel = FUNNEL.map((s) => {
    const count = people.filter((p) => reachedStep(p, s.key, now)).length;
    return { key: s.key, label: s.label, count, pct: pct(count, people.length) };
  });

  const byDay = new Map<string, Person[]>();
  for (const p of people) byDay.set(lagosDay(p.createdAt), [...(byDay.get(lagosDay(p.createdAt)) ?? []), p]);
  const cohorts = [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, ps]) => ({
      day,
      signups: ps.length,
      onboarded: ps.filter((p) => reachedStep(p, "onboarded")).length,
      started: ps.filter((p) => reachedStep(p, "started")).length,
      day1: ps.filter((p) => reachedStep(p, "day1")).length,
      day3: ps.filter((p) => reachedStep(p, "day3")).length,
      completed: ps.filter((p) => reachedStep(p, "completed")).length,
    }));

  const split = (installed: boolean) => {
    const ps = people.filter((p) => !!p.installedAt === installed);
    return {
      group: (installed ? "Installed" : "Not installed") as "Installed" | "Not installed",
      people: ps.length,
      day1Pct: pct(ps.filter((p) => reachedStep(p, "day1")).length, ps.length),
      day3Pct: pct(ps.filter((p) => reachedStep(p, "day3")).length, ps.length),
      completedPct: pct(ps.filter((p) => reachedStep(p, "completed")).length, ps.length),
    };
  };

  // "Stuck at" = furthest step reached, signed up over a day ago (still has a step to go).
  const stuck = Object.fromEntries(FUNNEL.map((s) => [s.key, [] as AnalyticsPerson[]])) as Record<FunnelKey, AnalyticsPerson[]>;
  const dueNow = new Map<NudgeRule, number>();
  for (const p of people) {
    const next = pickNudge(p, now);
    if (next) dueNow.set(next.rule, (dueNow.get(next.rule) ?? 0) + 1);
    if (now - Date.parse(p.createdAt) < DAY) continue;
    const stage = stageOf(p, now);
    if (stage === "week2") continue;
    if (stuck[stage].length < 100) {
      stuck[stage].push({
        wallet: p.wallet,
        username: p.username,
        hasEmail: !!p.email,
        createdAt: p.createdAt,
        lastSeenAt: p.lastSeenAt,
        installed: !!p.installedAt,
        pushOn: p.pushOn,
        stage,
        nextNudge: next?.rule ?? null,
      });
    }
  }

  const { data: log } = await admin
    .from("nudge_log")
    .select("rule, status, acted_at")
    .gte("sent_at", new Date(now - 7 * DAY).toISOString())
    .limit(20_000);
  const nudges = NUDGE_RULES.map((rule) => {
    const rows = (log ?? []).filter((l) => l.rule === rule && l.status === "sent");
    return { rule, label: RULE_LABEL[rule], sent7d: rows.length, acted7d: rows.filter((r) => r.acted_at).length, dueNow: dueNow.get(rule) ?? 0 };
  });

  const { data: firstSeen } = await admin.from("profiles").select("last_seen_at").not("last_seen_at", "is", null).order("last_seen_at", { ascending: true }).limit(1);
  const body: AnalyticsDto = {
    days,
    generatedAt: new Date(now).toISOString(),
    totals: {
      signups: people.length,
      installed: people.filter((p) => p.installedAt).length,
      pushOn: people.filter((p) => p.pushOn).length,
      hasEmail: people.filter((p) => p.email).length,
      activeToday: people.filter((p) => [p.lastSeenAt, p.lastProofAt].some((d) => d && now - Date.parse(d) < DAY)).length,
      playingNow: people.filter((p) => p.activeCard).length,
    },
    funnel,
    cohorts,
    installSplit: [split(true), split(false)],
    stuck,
    nudges,
    trackingSince: (firstSeen?.[0]?.last_seen_at as string | undefined) ?? null,
    weekly: { ...(await loadRetention(admin, 10, now)), target: WEEK1_RETENTION_TARGET },
  };
  return NextResponse.json(body);
}
