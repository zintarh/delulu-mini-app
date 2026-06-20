import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { computeDisplayEndsAt } from "@/lib/community/campaign-types";
import {
  parseChallengeIdFromTx,
  parseCommunityChallengeFundedFromTx,
} from "@/lib/dashboard/parse-challenge-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { formatUnits } from "viem";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPlatformAdminRole(session.staffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim() as `0x${string}`;
  const poolAmount = Number(body.poolAmount ?? 0);
  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }
  if (!Number.isFinite(poolAmount) || poolAmount <= 0) {
    return NextResponse.json({ error: "poolAmount must be > 0" }, { status: 400 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, status, content_hash, proposed_pool_amount, duration_days, display_ends_at, on_chain_challenge_id")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["approved", "funding", "active"].includes(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not ready to fund." }, { status: 400 });
  }

  let challengeId: bigint | null = null;
  let confirmedPool = poolAmount;

  if (campaign.on_chain_challenge_id) {
    try {
      const funded = await parseCommunityChallengeFundedFromTx(txHash);
      if (!funded || Number(funded.challengeId) !== campaign.on_chain_challenge_id) {
        return NextResponse.json({ error: "CommunityChallengeFunded event not found." }, { status: 400 });
      }
      challengeId = funded.challengeId;
      confirmedPool = Number(formatUnits(funded.totalPool, 18));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to read transaction" },
        { status: 400 },
      );
    }
  } else {
    if (!campaign.content_hash) {
      return NextResponse.json({ error: "Campaign has no content hash." }, { status: 400 });
    }
    try {
      challengeId = await parseChallengeIdFromTx(txHash);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to read transaction" },
        { status: 400 },
      );
    }
    if (challengeId == null) {
      return NextResponse.json({ error: "ChallengeCreated event not found in transaction." }, { status: 400 });
    }
  }

  const durationDays = Number(campaign.duration_days ?? 30) || 30;
  const displayEndsAt =
    campaign.display_ends_at ??
    computeDisplayEndsAt(durationDays);

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: "active",
    proposed_pool_amount: confirmedPool,
    display_ends_at: displayEndsAt,
    updated_at: now,
  };
  if (!campaign.on_chain_challenge_id && challengeId != null) {
    updatePayload.on_chain_challenge_id = Number(challengeId);
  }

  const { data, error } = await admin
    .from("community_campaigns")
    .update(updatePayload)
    .eq("id", id)
    .select("id, status, on_chain_challenge_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Challenge ID already linked to another campaign." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logCampaignEvent(id, "funded", session.userId, {
    tx_hash: txHash,
    pool_amount: confirmedPool,
    on_chain_challenge_id: data.on_chain_challenge_id,
  });

  return NextResponse.json({ campaign: data });
}
