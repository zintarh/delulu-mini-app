import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { invalidateRewardsConfigCache } from "@/lib/rewards/config";
import { diffRewardsConfig, validateRewardsConfig } from "@/lib/rewards/config-schema";
import { DEFAULT_REWARDS_CONFIG, resolveRewardsConfig, type RewardsConfig } from "@/lib/rewards/rules";

export const dynamic = "force-dynamic";

export type RewardEngineConfigDto = {
  /** What the engine enforces right now (stored overrides on top of defaults). */
  config: RewardsConfig;
  defaults: RewardsConfig;
  updatedAt: string | null;
  updatedBy: string | null;
};

async function readConfig(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<RewardEngineConfigDto> {
  const { data, error } = await admin
    .from("reward_config")
    .select("config, updated_at, updated_by")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    config: resolveRewardsConfig(data?.config),
    defaults: DEFAULT_REWARDS_CONFIG,
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    updatedBy: (data?.updated_by as string | undefined) ?? null,
  };
}

/** GET /api/dashboard/reward-engine/config — the live settings. */
export async function GET() {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  try {
    return NextResponse.json(await readConfig(admin));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load settings" }, { status: 500 });
  }
}

/**
 * PUT /api/dashboard/reward-engine/config
 * Body: { config: RewardsConfig, expectedUpdatedAt: string | null, reason: string }
 *
 * Strictly validated (lib/rewards/config-schema.ts), saved together with its
 * audit entry in one transaction, and rejected with 409 if someone else
 * saved since this admin loaded the page.
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

  const validated = validateRewardsConfig(body?.config);
  if (!validated.ok) {
    return NextResponse.json({ error: "Some settings are invalid.", issues: validated.issues }, { status: 400 });
  }

  try {
    const current = await readConfig(admin);
    const changes = diffRewardsConfig(current.config, validated.config);
    if (changes.length === 0) return NextResponse.json({ error: "Nothing changed." }, { status: 400 });

    const { data, error } = await admin.rpc("update_reward_config", {
      p_config: validated.config,
      p_expected_updated_at: body?.expectedUpdatedAt ?? null,
      p_actor_id: session.userId,
      p_actor_email: session.email,
      p_reason: reason,
      p_details: { changes, before: current.config, after: validated.config },
    });
    if (error) throw new Error(error.message);
    const result = data as { outcome: string; updated_by?: string | null };
    if (result.outcome === "conflict") {
      return NextResponse.json(
        {
          error: `${result.updated_by ?? "Someone"} saved new settings while you were editing. Reload to see them, then reapply your change.`,
        },
        { status: 409 },
      );
    }

    invalidateRewardsConfigCache();
    return NextResponse.json({ ...(await readConfig(admin)), changes });
  } catch (err) {
    console.error("[dashboard/reward-engine/config] save failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to save" }, { status: 500 });
  }
}
