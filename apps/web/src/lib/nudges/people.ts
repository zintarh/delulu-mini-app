import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { DAY_MS, daySlot, rollingMissedDay } from "@/lib/bingo/types";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** One person's first-weeks journey — what analytics counts and nudges act on. */
export type Person = {
  wallet: string;
  username: string | null;
  /** Only real inboxes (not the @wallet.local placeholders). */
  email: string | null;
  createdAt: string;
  onboardedAt: string | null;
  /** The 1,000 G$ welcome gift was deposited (it requires face verification). */
  giftSent: boolean;
  giftClaimedAt: string | null;
  installedAt: string | null;
  lastSeenAt: string | null;
  platform: string | null;
  pushOn: boolean;
  everStartedBingo: boolean;
  bestDays: number; // most daily squares filled on any one card
  completedBingo: boolean;
  /** Longest Bingo they've finished (3 or 7 days), 0 if none. */
  completedDays: number;
  lastCompletedAt: string | null;
  lastProofAt: string | null;
  /** Signed up before the window and nothing since — the win-back crowd. */
  dormant: boolean;
  /** The card they're playing now (3- or 7-day, own clock), if any. */
  activeCard: null | {
    attemptId: string;
    slug: string;
    title: string;
    days: number;
    startedAt: string;
    today: number;
    todayFilled: boolean;
    todayMission: string | null;
    dayEndsAt: string;
  };
  /** Bingo slugs they've ever started. */
  playedSlugs: string[];
  /** Bingo slugs they've finished (all days filled) — a finished First Week is never offered again. */
  finishedSlugs: string[];
  /** Joined through a friend's invite link — we pay for these, so we keep them coming back. */
  referredBy: null | { wallet: string; username: string | null };
  /** A card that ended on a missed day in the last 2 days. */
  recentMiss: null | { attemptId: string; slug: string; title: string; oneTime: boolean };
};

export const FUNNEL = [
  { key: "signed_up", label: "Signed up" },
  { key: "onboarded", label: "Set up profile" },
  { key: "gift", label: "Got the 1,000 G$ gift (verified)" },
  { key: "started", label: "Started a Bingo" },
  { key: "day1", label: "Day 1 photo" },
  { key: "day2", label: "Day 2 photo" },
  { key: "day3", label: "Day 3 photo" },
  { key: "completed", label: "Finished a Bingo" },
  { key: "week2", label: "Back in week 2" },
] as const;
export type FunnelKey = (typeof FUNNEL)[number]["key"];

export function reachedStep(p: Person, key: FunnelKey, nowMs = Date.now()): boolean {
  switch (key) {
    case "signed_up":
      return true;
    case "onboarded":
      return !!p.onboardedAt;
    case "gift":
      return p.giftSent;
    case "started":
      return p.everStartedBingo;
    case "day1":
      return p.bestDays >= 1;
    case "day2":
      return p.bestDays >= 2;
    case "day3":
      return p.bestDays >= 3;
    case "completed":
      return p.completedBingo;
    case "week2": {
      const week2 = Date.parse(p.createdAt) + 7 * DAY_MS;
      if (nowMs < week2) return false;
      const seen = [p.lastSeenAt, p.lastProofAt].filter(Boolean).map((d) => Date.parse(d!));
      return seen.some((t) => t >= week2);
    }
  }
}

/** The furthest funnel step someone reached (for "stuck at" lists). */
export function stageOf(p: Person, nowMs = Date.now()): FunnelKey {
  let last: FunnelKey = "signed_up";
  for (const s of FUNNEL) if (reachedStep(p, s.key, nowMs)) last = s.key;
  return last;
}

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const realEmail = (e: unknown) => (typeof e === "string" && e.includes("@") && !e.endsWith("@wallet.local") ? e : null);

const chunks = <T,>(arr: T[], n = 300) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/**
 * Everyone who signed up since `sinceIso` — plus, with `includeActive`,
 * anyone older who played a Bingo or posted an approved proof since then
 * (most players joined before the window; they still need day reminders).
 */
export async function loadPeople(
  admin: Admin,
  sinceIso: string,
  nowMs = Date.now(),
  opts: { includeActive?: boolean; includeDormant?: boolean; includeReferred?: boolean } = {},
): Promise<Person[]> {
  const profiles = await all<Record<string, unknown>>((f, t) =>
    admin.from("profiles").select("*").gte("created_at", sinceIso).order("created_at", { ascending: true }).range(f, t),
  );
  if (opts.includeDormant) {
    // Everyone older who once set up an account and has a real inbox.
    const older = await all<Record<string, unknown>>((f, t) =>
      admin
        .from("profiles")
        .select("*")
        .lt("created_at", sinceIso)
        .not("onboarded_at", "is", null)
        .not("email", "is", null)
        .not("email", "like", "%@wallet.local")
        .order("created_at", { ascending: true })
        .range(f, t),
    );
    profiles.push(...older);
  }
  if (opts.includeReferred) {
    // Every invited friend with a real inbox, however old — many joined before
    // onboarding was tracked, so the dormant query above never sees them.
    const have = new Set(profiles.map((p) => String(p.address).toLowerCase()));
    const referred = await all<Record<string, unknown>>((f, t) =>
      admin
        .from("profiles")
        .select("*")
        .lt("created_at", sinceIso)
        .not("referred_by", "is", null)
        .order("created_at", { ascending: true })
        .range(f, t),
    );
    profiles.push(...referred.filter((p) => !have.has(String(p.address).toLowerCase())));
  }
  if (opts.includeActive) {
    const seen = new Set(profiles.map((p) => String(p.address).toLowerCase()));
    const [{ data: cards }, { data: provers }] = await Promise.all([
      admin.from("bingo_attempts").select("wallet").gte("created_at", sinceIso).limit(5000),
      admin.from("proof_image_fingerprints").select("wallet").eq("status", "accepted").gte("created_at", sinceIso).limit(10000),
    ]);
    const extra = [...new Set([...(cards ?? []), ...(provers ?? [])].map((r) => String(r.wallet).toLowerCase()))].filter((w) => !seen.has(w));
    for (const c of chunks(extra)) {
      const { data } = await admin.from("profiles").select("*").in("address", c);
      profiles.push(...((data ?? []) as Record<string, unknown>[]));
    }
  }
  const wallets = profiles.map((p) => String(p.address).toLowerCase());
  if (wallets.length === 0) return [];

  const [subs, attempts, proofs] = await Promise.all([
    Promise.all(chunks(wallets).map((c) => admin.from("push_subscriptions").select("address").in("address", c).is("disabled_at", null))),
    Promise.all(
      chunks(wallets).map((c) =>
        admin
          .from("bingo_attempts")
          .select("id, wallet, status, started_at, ends_at, required_filled, cycle_id, version_id, bingo_campaigns!inner(slug, title, duration_days, recurrence)")
          .in("wallet", c),
      ),
    ),
    Promise.all(
      chunks(wallets).map((c) =>
        admin.from("proof_image_fingerprints").select("wallet, created_at").eq("status", "accepted").in("wallet", c).gte("created_at", sinceIso),
      ),
    ),
  ]);
  const pushOn = new Set(subs.flatMap((r) => (r.data ?? []).map((s) => String(s.address).toLowerCase())));
  const lastProof = new Map<string, string>();
  for (const r of proofs.flatMap((x) => x.data ?? [])) {
    const w = String(r.wallet);
    if (!lastProof.has(w) || String(r.created_at) > lastProof.get(w)!) lastProof.set(w, String(r.created_at));
  }

  type A = {
    id: string;
    wallet: string;
    status: string;
    started_at: string;
    ends_at: string;
    required_filled: number;
    cycle_id: string | null;
    version_id: string;
    bingo_campaigns: { slug: string; title: string; duration_days: number; recurrence: string } | { slug: string; title: string; duration_days: number; recurrence: string }[];
  };
  const byWallet = new Map<string, A[]>();
  for (const a of attempts.flatMap((x) => (x.data ?? []) as unknown as A[])) {
    byWallet.set(a.wallet, [...(byWallet.get(a.wallet) ?? []), a]);
  }

  // Today's square for live rolling cards: filled yet? + the mission to name in nudges.
  const live = [...byWallet.values()].flat().filter((a) => a.cycle_id == null && a.status === "active" && Date.parse(a.ends_at) > nowMs);
  const liveIds = live.map((a) => a.id);
  const [{ data: filled }, { data: versions }] = await Promise.all([
    liveIds.length
      ? admin.from("bingo_squares").select("attempt_id, slot_index").in("attempt_id", liveIds).eq("status", "filled")
      : Promise.resolve({ data: [] as { attempt_id: string; slot_index: number | null }[] }),
    live.length
      ? admin.from("bingo_versions").select("id, missions").in("id", [...new Set(live.map((a) => a.version_id))])
      : Promise.resolve({ data: [] as { id: string; missions: { title: string }[] }[] }),
  ]);
  // Who invited whom — the nudge names the friend.
  const referrerWallets = [...new Set(profiles.map((p) => p.referred_by).filter(Boolean).map((w) => String(w).toLowerCase()))];
  const referrerNames = new Map<string, string | null>();
  for (const c of chunks(referrerWallets)) {
    const { data } = await admin.from("profiles").select("address, username").in("address", c);
    for (const r of data ?? []) referrerNames.set(String(r.address).toLowerCase(), (r.username as string) ?? null);
  }
  const filledSlots = new Set((filled ?? []).map((f) => `${f.attempt_id}:${f.slot_index}`));
  const missionsOf = new Map((versions ?? []).map((v) => [v.id as string, (v.missions as { title: string }[]).map((m) => m.title)]));

  return profiles.map((p) => {
    const wallet = String(p.address).toLowerCase();
    const cards = byWallet.get(wallet) ?? [];
    const camp = (a: A) => (Array.isArray(a.bingo_campaigns) ? a.bingo_campaigns[0] : a.bingo_campaigns);
    const active = cards
      .filter((a) => a.cycle_id == null && a.status === "active" && Date.parse(a.ends_at) > nowMs && !rollingMissedDay(a, nowMs))
      .sort((x, y) => Date.parse(y.started_at) - Date.parse(x.started_at))[0];
    const missed = cards.find(
      (a) => a.cycle_id == null && a.required_filled < camp(a).duration_days && rollingMissedDay(a, nowMs) && nowMs - (Date.parse(a.started_at) + (a.required_filled + 1) * DAY_MS) < 2 * DAY_MS,
    );
    let activeCard: Person["activeCard"] = null;
    if (active) {
      const today = daySlot(active.started_at, active.ends_at, nowMs) ?? 0;
      activeCard = {
        attemptId: active.id,
        slug: camp(active).slug,
        title: camp(active).title,
        days: camp(active).duration_days,
        startedAt: active.started_at,
        today,
        todayFilled: filledSlots.has(`${active.id}:${today}`),
        todayMission: missionsOf.get(active.version_id)?.[today] ?? null,
        dayEndsAt: new Date(Date.parse(active.started_at) + (today + 1) * DAY_MS).toISOString(),
      };
    }
    return {
      wallet,
      username: (p.username as string) ?? null,
      email: realEmail(p.email),
      createdAt: String(p.created_at),
      onboardedAt: (p.onboarded_at as string) ?? null,
      giftSent: p.onboarding_gift_status === "sent",
      giftClaimedAt: (p.onboarding_gift_claimed_at as string) ?? null,
      installedAt: (p.pwa_installed_at as string) ?? null,
      lastSeenAt: (p.last_seen_at as string) ?? null,
      platform: (p.platform as string) ?? null,
      pushOn: pushOn.has(wallet),
      everStartedBingo: cards.length > 0,
      bestDays: cards.reduce((m, a) => Math.max(m, a.required_filled), 0),
      completedBingo: cards.some((a) => a.status === "completed" || a.required_filled >= camp(a).duration_days),
      completedDays: cards.filter((a) => a.required_filled >= camp(a).duration_days).reduce((m, a) => Math.max(m, camp(a).duration_days), 0),
      lastCompletedAt:
        cards
          .filter((a) => a.required_filled >= camp(a).duration_days)
          .map((a) => a.ends_at)
          .sort()
          .at(-1) ?? null,
      lastProofAt: lastProof.get(wallet) ?? null,
      dormant: String(p.created_at) < sinceIso && !lastProof.has(wallet) && !active && cards.every((a) => Date.parse(a.started_at) < Date.parse(sinceIso)),
      activeCard,
      playedSlugs: [...new Set(cards.map((a) => camp(a).slug))],
      finishedSlugs: [...new Set(cards.filter((a) => a.required_filled >= camp(a).duration_days).map((a) => camp(a).slug))],
      referredBy: p.referred_by
        ? { wallet: String(p.referred_by).toLowerCase(), username: referrerNames.get(String(p.referred_by).toLowerCase()) ?? null }
        : null,
      recentMiss: missed ? { attemptId: missed.id, slug: camp(missed).slug, title: camp(missed).title, oneTime: camp(missed).recurrence === "one_time" } : null,
    };
  });
}
