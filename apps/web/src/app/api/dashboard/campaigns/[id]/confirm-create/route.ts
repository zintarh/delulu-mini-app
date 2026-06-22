import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { logCampaignEvent } from "@/lib/dashboard/log-campaign-event";
import { parseCommunityChallengeCreatedFromTx } from "@/lib/dashboard/parse-challenge-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";

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
  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }

  const { id } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, status, content_hash, on_chain_challenge_id")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.on_chain_challenge_id != null) {
    return NextResponse.json({
      campaign: { id: campaign.id, on_chain_challenge_id: campaign.on_chain_challenge_id },
      alreadyLinked: true,
    });
  }
  if (!["approved", "pending_approval"].includes(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not ready for on-chain create." }, { status: 400 });
  }

  let challengeId: bigint | null;
  try {
    challengeId = await parseCommunityChallengeCreatedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (challengeId == null) {
    return NextResponse.json({ error: "CommunityChallengeCreated event not found in transaction." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("community_campaigns")
    .update({
      status: "approved",
      on_chain_challenge_id: Number(challengeId),
      updated_at: now,
    })
    .eq("id", id)
    .select("id, status, on_chain_challenge_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Challenge ID already linked to another campaign." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logCampaignEvent(id, "on_chain_created", session.userId, {
    tx_hash: txHash,
    on_chain_challenge_id: Number(challengeId),
  });

  return NextResponse.json({ campaign: data });
}
