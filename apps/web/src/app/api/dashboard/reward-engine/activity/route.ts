import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import type { RewardCategory } from "@/lib/rewards/rules";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const CATEGORIES: RewardCategory[] = ["daily_proof", "weekly_consistency", "campaign_completion", "goal_completion"];
const STATUS_GROUPS = {
  pending: ["pending", "processing", "submitted"],
  confirmed: ["confirmed"],
  failed: ["failed"],
} as const;

export type RewardActivityRow = {
  id: string;
  wallet: string;
  username: string | null;
  category: RewardCategory;
  amount: number;
  status: string;
  goalKind: "campaign" | "forfeit" | null;
  goalRef: string | null;
  goalTitle: string | null;
  periodKey: string | null;
  rewardDay: string;
  txHash: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type RewardActivityDto = {
  rows: RewardActivityRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Sums over every row matching the filters (not just this page). */
  sums: { confirmed: number; pending: number; failed: number };
};

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const clean = (v: string) => v.replace(/[%_,()]/g, "").trim();

/**
 * GET /api/dashboard/reward-engine/activity
 *   ?user=        wallet (or part of one) or username
 *   &campaign=    campaign id or title
 *   &category=    daily_proof | weekly_consistency | campaign_completion | goal_completion
 *   &status=      pending | confirmed | failed
 *   &from=&to=    YYYY-MM-DD (inclusive, UTC, by grant time)
 *   &page=
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const p = request.nextUrl.searchParams;
  const user = clean(p.get("user") ?? "").toLowerCase();
  const campaign = clean(p.get("campaign") ?? "");
  const category = p.get("category") ?? "";
  const status = p.get("status") ?? "";
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);

  if (category && !CATEGORIES.includes(category as RewardCategory)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (status && !(status in STATUS_GROUPS)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  if ((from && !isDay(from)) || (to && !isDay(to))) {
    return NextResponse.json({ error: "Dates must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    // Resolve user / campaign text to ids first; an unmatched filter means no rows.
    let wallets: string[] | null = null;
    let walletLike: string | null = null;
    if (user) {
      if (/^0x[0-9a-f]*$/.test(user)) {
        walletLike = user;
      } else {
        const { data } = await admin.from("profiles").select("address").ilike("username", `%${user}%`).limit(100);
        wallets = (data ?? []).map((r) => String(r.address).toLowerCase());
      }
    }
    let campaignIds: string[] | null = null;
    if (campaign) {
      if (/^[0-9a-f-]{36}$/i.test(campaign)) {
        campaignIds = [campaign];
      } else {
        const { data } = await admin.from("community_campaigns").select("id").ilike("title", `%${campaign}%`).limit(100);
        campaignIds = (data ?? []).map((r) => r.id as string);
      }
    }
    const empty: RewardActivityDto = { rows: [], total: 0, page, pageSize: PAGE_SIZE, sums: { confirmed: 0, pending: 0, failed: 0 } };
    if ((wallets && wallets.length === 0) || (campaignIds && campaignIds.length === 0)) return NextResponse.json(empty);

    // Same filters for the page and for the sums.
    const filtered = <Q extends { eq: any; in: any; ilike: any; gte: any; lt: any }>(q: Q): Q => {
      let r = q;
      if (walletLike) r = r.ilike("wallet", `%${walletLike}%`);
      if (wallets) r = r.in("wallet", wallets);
      if (campaignIds) r = r.eq("goal_kind", "campaign").in("goal_ref", campaignIds);
      if (category) r = r.eq("category", category);
      if (status) r = r.in("status", [...STATUS_GROUPS[status as keyof typeof STATUS_GROUPS]]);
      if (from) r = r.gte("created_at", `${from}T00:00:00Z`);
      if (to) {
        const end = new Date(`${to}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        r = r.lt("created_at", end.toISOString());
      }
      return r;
    };

    const start = (page - 1) * PAGE_SIZE;
    const [pageRes, sumRes] = await Promise.all([
      filtered(
        admin
          .from("reward_payouts")
          .select(
            "id, wallet, category, amount, status, goal_kind, goal_ref, period_key, reward_day, tx_hash, attempts, last_error, created_at, confirmed_at",
            { count: "exact" },
          ),
      )
        .order("created_at", { ascending: false })
        .range(start, start + PAGE_SIZE - 1),
      filtered(admin.from("reward_payouts").select("amount, status")).limit(20_000),
    ]);
    if (pageRes.error) throw new Error(pageRes.error.message);
    if (sumRes.error) throw new Error(sumRes.error.message);

    const sums = { confirmed: 0, pending: 0, failed: 0 };
    for (const r of sumRes.data ?? []) {
      const amount = Number(r.amount);
      if (r.status === "confirmed") sums.confirmed += amount;
      else if (r.status === "failed") sums.failed += amount;
      else sums.pending += amount;
    }

    const rows = pageRes.data ?? [];
    const addrs = [...new Set(rows.map((r) => r.wallet as string))];
    const forfeitIds = [...new Set(rows.filter((r) => r.goal_kind === "forfeit").map((r) => r.goal_ref as string))];
    const campIds = [...new Set(rows.filter((r) => r.goal_kind === "campaign").map((r) => r.goal_ref as string))];
    const [profiles, forfeits, camps] = await Promise.all([
      addrs.length ? admin.from("profiles").select("address, username").in("address", addrs) : { data: [] },
      forfeitIds.length ? admin.from("forfeit_commitments").select("id, title").in("id", forfeitIds) : { data: [] },
      campIds.length ? admin.from("community_campaigns").select("id, title").in("id", campIds) : { data: [] },
    ]);
    const usernames = new Map((profiles.data ?? []).map((r: { address: string; username: string | null }) => [r.address.toLowerCase(), r.username]));
    const titles = new Map<string, string>();
    for (const f of (forfeits.data ?? []) as { id: string; title: string }[]) titles.set(`forfeit:${f.id}`, f.title);
    for (const c of (camps.data ?? []) as { id: string; title: string }[]) titles.set(`campaign:${c.id}`, c.title);

    const body: RewardActivityDto = {
      rows: rows.map((r) => ({
        id: r.id as string,
        wallet: r.wallet as string,
        username: usernames.get(String(r.wallet)) ?? null,
        category: r.category as RewardCategory,
        amount: Number(r.amount),
        status: r.status as string,
        goalKind: (r.goal_kind as "campaign" | "forfeit" | null) ?? null,
        goalRef: (r.goal_ref as string | null) ?? null,
        goalTitle: r.goal_kind && r.goal_ref ? titles.get(`${r.goal_kind}:${r.goal_ref}`) ?? null : null,
        periodKey: (r.period_key as string | null) ?? null,
        rewardDay: r.reward_day as string,
        txHash: (r.tx_hash as string | null) ?? null,
        attempts: Number(r.attempts ?? 0),
        lastError: (r.last_error as string | null) ?? null,
        createdAt: r.created_at as string,
        confirmedAt: (r.confirmed_at as string | null) ?? null,
      })),
      total: pageRes.count ?? rows.length,
      page,
      pageSize: PAGE_SIZE,
      sums,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[dashboard/reward-engine/activity] failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load activity" }, { status: 500 });
  }
}
