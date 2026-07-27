import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getTokenSymbol, weiToTokenAmount } from "@/lib/token-amounts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const COMMITMENT_SELECT = `
  id,
  on_chain_commitment_id,
  creator_wallet,
  title,
  description,
  evidence_type,
  verification_method,
  is_private,
  remind_enabled,
  is_charity_intent,
  stake_amount_wei,
  token,
  destination_type,
  destination_addr,
  destination_friend_username,
  destination_friend_email,
  verifier_wallet,
  status,
  create_tx_hash,
  created_at,
  confirmed_at,
  forfeit_periods (
    id,
    period_index,
    proof_url,
    ai_verdict,
    verifier_action,
    resolved_at,
    tx_hash,
    created_at
  )
`.replace(/\s+/g, " ");

type PeriodRow = {
  id: string;
  period_index: number;
  proof_url: string | null;
  ai_verdict: unknown;
  verifier_action: string | null;
  resolved_at: string | null;
  tx_hash: string | null;
  created_at: string;
};

type CommitmentRow = {
  id: string;
  on_chain_commitment_id: number | null;
  creator_wallet: string;
  title: string;
  description: string | null;
  evidence_type: string;
  verification_method: string;
  is_private: boolean;
  remind_enabled: boolean;
  is_charity_intent: boolean | null;
  stake_amount_wei: string | null;
  token: string | null;
  destination_type: number | null;
  destination_addr: string | null;
  destination_friend_username: string | null;
  destination_friend_email: string | null;
  verifier_wallet: string | null;
  status: string;
  create_tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  forfeit_periods: PeriodRow[] | null;
};

type ChartPoint = { label: string; value: number; key: string };

async function requirePlatformAdminSession() {
  const session = await readAdminSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addUtcDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return utcDateKey(next);
}

/** Monday (UTC) for the week containing isoDate. */
function weekStartUtc(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  return addUtcDays(isoDate, offset);
}

function shortDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function shortWeekLabel(weekStart: string): string {
  return `W ${shortDayLabel(weekStart)}`;
}

function destinationLabel(
  type: number | null | undefined,
  isCharity: boolean | null | undefined,
): string {
  if (isCharity) return "Charity";
  switch (type) {
    case 0:
      return "Self return";
    case 1:
      return "Charity";
    case 2:
      return "Friend";
    case 3:
      return "Community pool";
    default:
      return "Unknown";
  }
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function mapToSortedPoints(
  map: Map<string, number>,
  order?: string[],
): ChartPoint[] {
  const keys = order ?? [...map.keys()].sort();
  return keys.map((key) => ({
    key,
    label: key,
    value: map.get(key) ?? 0,
  }));
}

function buildAnalytics(
  commitments: Array<{
    status: string;
    evidence_type: string;
    verification_method: string;
    destination_type: number | null;
    is_charity_intent: boolean | null;
    created_at: string;
  }>,
  periods: Array<{
    proof_url: string | null;
    verifier_action: string | null;
    resolved_at: string | null;
    created_at: string;
  }>,
) {
  const now = new Date();
  const todayKey = utcDateKey(now);
  const weekAgo = addUtcDays(todayKey, -6);
  const day30Start = addUtcDays(todayKey, -29);
  const week12Start = weekStartUtc(addUtcDays(todayKey, -7 * 11));

  const byStatus = new Map<string, number>();
  const byEvidence = new Map<string, number>();
  const byVerification = new Map<string, number>();
  const byDestination = new Map<string, number>();
  const createdByDay = new Map<string, number>();
  const createdByWeek = new Map<string, number>();
  const proofsByDay = new Map<string, number>();
  const proofsByWeek = new Map<string, number>();

  for (let i = 0; i < 30; i++) {
    createdByDay.set(addUtcDays(day30Start, i), 0);
    proofsByDay.set(addUtcDays(day30Start, i), 0);
  }
  for (let i = 0; i < 12; i++) {
    createdByWeek.set(addUtcDays(week12Start, i * 7), 0);
    proofsByWeek.set(addUtcDays(week12Start, i * 7), 0);
  }

  let createdToday = 0;
  let createdThisWeek = 0;

  for (const c of commitments) {
    bump(byStatus, c.status || "unknown");
    bump(byEvidence, c.evidence_type || "unknown");
    bump(byVerification, c.verification_method || "unknown");
    bump(
      byDestination,
      destinationLabel(c.destination_type, c.is_charity_intent),
    );

    const day = utcDateKey(new Date(c.created_at));
    if (createdByDay.has(day)) bump(createdByDay, day);
    const week = weekStartUtc(day);
    if (createdByWeek.has(week)) bump(createdByWeek, week);
    if (day === todayKey) createdToday += 1;
    if (day >= weekAgo && day <= todayKey) createdThisWeek += 1;
  }

  let proofsSubmitted = 0;
  let proofsApproved = 0;
  let proofsRejected = 0;
  let proofsResolved = 0;
  let proofsToday = 0;
  let proofsThisWeek = 0;

  for (const p of periods) {
    const hasProof = Boolean(p.proof_url);
    if (!hasProof && !p.resolved_at && !p.verifier_action) continue;

    if (hasProof) {
      proofsSubmitted += 1;
      const day = utcDateKey(new Date(p.created_at));
      if (proofsByDay.has(day)) bump(proofsByDay, day);
      const week = weekStartUtc(day);
      if (proofsByWeek.has(week)) bump(proofsByWeek, week);
      if (day === todayKey) proofsToday += 1;
      if (day >= weekAgo && day <= todayKey) proofsThisWeek += 1;
    }

    if (p.resolved_at || p.verifier_action) proofsResolved += 1;
    if (p.verifier_action === "approved") proofsApproved += 1;
    if (p.verifier_action === "rejected") proofsRejected += 1;
  }

  const statusOrder = [
    "pending_confirmation",
    "active",
    "completed",
    "forfeited",
    "cancelled",
  ];

  const createdDaily = [...createdByDay.entries()].map(([key, value]) => ({
    key,
    label: shortDayLabel(key),
    value,
  }));
  const createdWeekly = [...createdByWeek.entries()].map(([key, value]) => ({
    key,
    label: shortWeekLabel(key),
    value,
  }));
  const proofsDaily = [...proofsByDay.entries()].map(([key, value]) => ({
    key,
    label: shortDayLabel(key),
    value,
  }));
  const proofsWeekly = [...proofsByWeek.entries()].map(([key, value]) => ({
    key,
    label: shortWeekLabel(key),
    value,
  }));

  let cumulative = 0;
  const growthCumulative = createdDaily.map((d) => {
    cumulative += d.value;
    return { key: d.key, label: d.label, value: cumulative };
  });

  return {
    kpis: {
      total: commitments.length,
      active: byStatus.get("active") ?? 0,
      completed: byStatus.get("completed") ?? 0,
      forfeited: byStatus.get("forfeited") ?? 0,
      cancelled: byStatus.get("cancelled") ?? 0,
      pendingConfirmation: byStatus.get("pending_confirmation") ?? 0,
      createdToday,
      createdThisWeek,
      proofsSubmitted,
      proofsApproved,
      proofsRejected,
      proofsResolved,
      proofsToday,
      proofsThisWeek,
    },
    byStatus: statusOrder.map((key) => ({
      key,
      label: key.replace(/_/g, " "),
      value: byStatus.get(key) ?? 0,
      color:
        key === "active"
          ? "#2563eb"
          : key === "completed"
            ? "#10b981"
            : key === "forfeited"
              ? "#ef4444"
              : key === "cancelled"
                ? "#94a3b8"
                : "#f59e0b",
    })),
    byEvidence: mapToSortedPoints(byEvidence),
    byVerification: mapToSortedPoints(byVerification),
    byDestination: mapToSortedPoints(byDestination),
    createdDaily,
    createdWeekly,
    proofsDaily,
    proofsWeekly,
    growthCumulative,
  };
}

function serializeCommitment(
  row: CommitmentRow,
  usernameByWallet: Map<string, string | null>,
) {
  const periods = [...(row.forfeit_periods ?? [])].sort(
    (a, b) => a.period_index - b.period_index,
  );
  const proofsSubmitted = periods.filter((p) => Boolean(p.proof_url)).length;
  const proofsApproved = periods.filter(
    (p) => p.verifier_action === "approved",
  ).length;
  const proofsRejected = periods.filter(
    (p) => p.verifier_action === "rejected",
  ).length;
  const wallet = row.creator_wallet.toLowerCase();
  const stakeAmount =
    row.stake_amount_wei != null
      ? weiToTokenAmount(row.stake_amount_wei, row.token)
      : null;

  return {
    id: row.id,
    onChainId: row.on_chain_commitment_id,
    creatorWallet: row.creator_wallet,
    creatorUsername: usernameByWallet.get(wallet) ?? null,
    title: row.title,
    description: row.description,
    evidenceType: row.evidence_type,
    verificationMethod: row.verification_method,
    isPrivate: row.is_private,
    remindEnabled: row.remind_enabled,
    isCharityIntent: Boolean(row.is_charity_intent),
    stakeAmountWei: row.stake_amount_wei,
    stakeAmount,
    token: row.token,
    tokenSymbol: getTokenSymbol(row.token),
    destinationType: row.destination_type,
    destinationLabel: destinationLabel(
      row.destination_type,
      row.is_charity_intent,
    ),
    destinationAddr: row.destination_addr,
    destinationFriendUsername: row.destination_friend_username,
    destinationFriendEmail: row.destination_friend_email,
    verifierWallet: row.verifier_wallet,
    status: row.status,
    createTxHash: row.create_tx_hash,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    periodCount: periods.length,
    proofsSubmitted,
    proofsApproved,
    proofsRejected,
    periods: periods.map((p) => ({
      id: p.id,
      periodIndex: p.period_index,
      proofUrl: p.proof_url,
      aiVerdict: p.ai_verdict,
      verifierAction: p.verifier_action,
      resolvedAt: p.resolved_at,
      txHash: p.tx_hash,
      createdAt: p.created_at,
    })),
  };
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const searchQuery = (searchParams.get("query") ?? "").trim();
  const statusFilter = (searchParams.get("status") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  let listQuery = supabase
    .from("forfeit_commitments")
    .select(COMMITMENT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    listQuery = listQuery.eq("status", statusFilter);
  }

  if (searchQuery) {
    const term = searchQuery.replace(/,/g, " ");
    const termLower = term.toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(termLower)) {
      listQuery = listQuery.or(
        `creator_wallet.eq.${termLower},verifier_wallet.eq.${termLower},destination_addr.eq.${termLower}`,
      );
    } else if (/^\d+$/.test(term)) {
      listQuery = listQuery.eq("on_chain_commitment_id", Number(term));
    } else {
      listQuery = listQuery.or(
        `title.ilike.%${term}%,destination_friend_username.ilike.%${term}%,destination_friend_email.ilike.%${term}%,creator_wallet.ilike.%${termLower}%`,
      );
    }
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  listQuery = listQuery.range(from, to);

  const analyticsCommitmentsPromise = supabase
    .from("forfeit_commitments")
    .select(
      "status, evidence_type, verification_method, destination_type, is_charity_intent, created_at",
    )
    .order("created_at", { ascending: true })
    .limit(10000);

  const analyticsPeriodsPromise = supabase
    .from("forfeit_periods")
    .select("proof_url, verifier_action, resolved_at, created_at")
    .order("created_at", { ascending: true })
    .limit(20000);

  const [listResult, analyticsCommitmentsResult, analyticsPeriodsResult] =
    await Promise.all([
      listQuery,
      analyticsCommitmentsPromise,
      analyticsPeriodsPromise,
    ]);

  if (listResult.error) {
    console.error("[dashboard/forfeit] list", listResult.error);
    return NextResponse.json(
      { error: listResult.error.message || "Failed to load forfeits" },
      { status: 500 },
    );
  }

  if (analyticsCommitmentsResult.error) {
    console.error(
      "[dashboard/forfeit] analytics commitments",
      analyticsCommitmentsResult.error,
    );
    return NextResponse.json(
      {
        error:
          analyticsCommitmentsResult.error.message ||
          "Failed to load forfeit analytics",
      },
      { status: 500 },
    );
  }

  if (analyticsPeriodsResult.error) {
    console.error(
      "[dashboard/forfeit] analytics periods",
      analyticsPeriodsResult.error,
    );
    return NextResponse.json(
      {
        error:
          analyticsPeriodsResult.error.message ||
          "Failed to load forfeit analytics",
      },
      { status: 500 },
    );
  }

  const rows = (listResult.data ?? []) as unknown as CommitmentRow[];
  const wallets = [
    ...new Set(rows.map((r) => r.creator_wallet.toLowerCase()).filter(Boolean)),
  ];

  const usernameByWallet = new Map<string, string | null>();
  if (wallets.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("address, username")
      .in("address", wallets);
    for (const p of profiles ?? []) {
      if (p.address) {
        usernameByWallet.set(
          String(p.address).toLowerCase(),
          p.username ?? null,
        );
      }
    }
  }

  const commitments = rows.map((row) =>
    serializeCommitment(row, usernameByWallet),
  );
  const analytics = buildAnalytics(
    analyticsCommitmentsResult.data ?? [],
    analyticsPeriodsResult.data ?? [],
  );

  return NextResponse.json({
    commitments,
    total: listResult.count ?? commitments.length,
    page,
    pageSize: PAGE_SIZE,
    analytics,
  });
}
