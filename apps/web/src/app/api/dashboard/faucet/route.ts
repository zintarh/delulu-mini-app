import { NextRequest, NextResponse } from "next/server";
import { formatGwei } from "viem";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { invalidateFaucetConfigCache } from "@/lib/faucet/config";
import { currentMaxFeePerGas, faucetAddress, faucetPublicClient } from "@/lib/faucet/chain";
import {
  DEFAULT_FAUCET_CONFIG,
  computeTopUp,
  faucetConfigIssues,
  resolveFaucetConfig,
  weiToCelo,
  type FaucetConfig,
  type FaucetStage,
} from "@/lib/faucet/rules";
import { reconcileFaucetClaims } from "@/lib/faucet/service";
import { captchaEnabled } from "@/lib/faucet/turnstile";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export type FaucetClaimRow = {
  id: string;
  address: string;
  stage: string | null;
  status: string;
  amountCelo: number | null;
  reason: string | null;
  ipSubnet: string | null;
  txHash: string | null;
  createdAt: string;
};

export type FaucetBlockRow = { id: string; kind: string; value: string; reason: string | null; createdAt: string };

export type FaucetOverviewDto = {
  config: FaucetConfig;
  defaults: FaucetConfig;
  updatedAt: string | null;
  updatedBy: string | null;
  faucet: { address: string | null; balanceCelo: number | null };
  /** Live price and what one empty-wallet drip costs per step right now. */
  gas: { maxFeeGwei: number | null; dripCelo: Record<FaucetStage, number> | null };
  last24h: { spentCelo: number; drips: number; budgetLeftCelo: number; rejected: Record<string, number> };
  /** Days the balance lasts at the last 7 days' average spend; null with no spend. */
  runwayDays: number | null;
  /** Signup drips in the last 7 days and how many of those wallets went on to create a profile. */
  conversion7d: { funded: number; madeProfile: number };
  captchaConfigured: boolean;
  recent: FaucetClaimRow[];
  blocklist: FaucetBlockRow[];
};

const SPENT = ["pending", "submitted", "sent"];

async function readConfigRow(admin: SupabaseAdmin) {
  const { data, error } = await admin
    .from("faucet_config")
    .select("config, updated_at, updated_by")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    config: resolveFaucetConfig(data?.config),
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    updatedBy: (data?.updated_by as string | undefined) ?? null,
  };
}

/** GET /api/dashboard/faucet — state of the gas sponsor. */
export async function GET() {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  try {
    await reconcileFaucetClaims(admin, { limit: 20 }).catch((err) => console.error("[dashboard/faucet] reconcile", err));
    const row = await readConfigRow(admin);
    const config = row.config;
    const day = new Date(Date.now() - 86_400_000).toISOString();
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const address = faucetAddress();

    const [balanceWei, maxFee, spent24, spent7, rejected24, signups7, recent, blocks] = await Promise.all([
      address ? faucetPublicClient.getBalance({ address }).catch(() => null) : Promise.resolve(null),
      currentMaxFeePerGas().catch(() => null),
      admin.from("gas_faucet_claims").select("amount_celo").in("status", SPENT).gte("created_at", day).limit(10_000),
      admin.from("gas_faucet_claims").select("amount_celo").in("status", SPENT).gte("created_at", week).limit(50_000),
      admin.from("gas_faucet_claims").select("agent_reasoning").eq("status", "rejected").gte("created_at", day).limit(10_000),
      admin.from("gas_faucet_claims").select("address").eq("stage", "signup").in("status", ["submitted", "sent"]).gte("created_at", week).limit(10_000),
      admin
        .from("gas_faucet_claims")
        .select("id, address, stage, status, amount_celo, agent_reasoning, ip_subnet, tx_hash, created_at")
        .order("created_at", { ascending: false })
        .limit(60),
      admin.from("faucet_blocklist").select("id, kind, value, reason, created_at").order("created_at", { ascending: false }).limit(500),
    ]);

    const sum = (rows: { amount_celo: unknown }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount_celo ?? 0), 0);
    const spentCelo = sum(spent24.data);
    const weekSpent = sum(spent7.data);
    const balanceCelo = balanceWei == null ? null : weiToCelo(balanceWei);

    const rejected: Record<string, number> = {};
    for (const r of rejected24.data ?? []) {
      const k = (r.agent_reasoning as string | null) ?? "unknown";
      rejected[k] = (rejected[k] ?? 0) + 1;
    }

    const funded = [...new Set((signups7.data ?? []).map((r) => r.address as string))];
    let madeProfile = 0;
    if (funded.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("address")
        .in("address", funded.slice(0, 1000))
        .not("username", "is", null);
      madeProfile = profiles?.length ?? 0;
    }

    const drip = (stage: FaucetStage) =>
      maxFee == null
        ? 0
        : weiToCelo(computeTopUp({ gasUnits: config.stages[stage].gasUnits, maxFeePerGasWei: maxFee, margin: config.gasMargin, balanceWei: 0n }).needWei);

    const body: FaucetOverviewDto = {
      config,
      defaults: DEFAULT_FAUCET_CONFIG,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
      faucet: { address, balanceCelo },
      gas: {
        maxFeeGwei: maxFee == null ? null : Number(formatGwei(maxFee)),
        dripCelo: maxFee == null ? null : { signup: drip("signup"), starter: drip("starter"), active: drip("active") },
      },
      last24h: {
        spentCelo,
        drips: spent24.data?.length ?? 0,
        budgetLeftCelo: Math.max(0, config.limits.dailyBudgetCelo - spentCelo),
        rejected,
      },
      runwayDays: balanceCelo != null && weekSpent > 0 ? Math.floor(balanceCelo / (weekSpent / 7)) : null,
      conversion7d: { funded: funded.length, madeProfile },
      captchaConfigured: captchaEnabled() && Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
      recent: (recent.data ?? []).map((r) => ({
        id: r.id as string,
        address: r.address as string,
        stage: (r.stage as string | null) ?? null,
        status: r.status as string,
        amountCelo: r.amount_celo == null ? null : Number(r.amount_celo),
        reason: (r.agent_reasoning as string | null) ?? null,
        ipSubnet: (r.ip_subnet as string | null) ?? null,
        txHash: (r.tx_hash as string | null) ?? null,
        createdAt: r.created_at as string,
      })),
      blocklist: (blocks.data ?? []).map((b) => ({
        id: b.id as string,
        kind: b.kind as string,
        value: b.value as string,
        reason: (b.reason as string | null) ?? null,
        createdAt: b.created_at as string,
      })),
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[dashboard/faucet] GET failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 });
  }
}

/**
 * PUT /api/dashboard/faucet
 * Body: { config: FaucetConfig, expectedUpdatedAt: string | null, reason: string }
 * Rejects out-of-range values (rather than silently defaulting them) and
 * saves that would overwrite someone else's newer change.
 */
export async function PUT(request: NextRequest) {
  const { session, error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    config?: unknown;
    expectedUpdatedAt?: string | null;
    reason?: unknown;
  } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json({ error: "Add a reason for this change (5–500 characters)." }, { status: 400 });
  }

  const resolved = resolveFaucetConfig(body?.config);
  if (JSON.stringify(resolved) !== JSON.stringify(body?.config)) {
    return NextResponse.json({ error: "Some values are missing or out of range." }, { status: 400 });
  }
  const issues = faucetConfigIssues(resolved);
  if (issues.length > 0) return NextResponse.json({ error: issues.join(". ") }, { status: 400 });

  try {
    const current = await readConfigRow(admin);
    if ((body?.expectedUpdatedAt ?? null) !== current.updatedAt) {
      return NextResponse.json({ error: "Someone else saved changes. Reload and try again." }, { status: 409 });
    }
    const { error } = await admin
      .from("faucet_config")
      .upsert({
        id: "default",
        config: resolved,
        reason,
        updated_by: session.email ?? session.userId ?? null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    invalidateFaucetConfigCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save" }, { status: 500 });
  }
}
