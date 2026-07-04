import { NextRequest, NextResponse } from "next/server";
import {
  isCampaignEndedByDate,
  isCampaignParticipatable,
} from "@/lib/community/campaign-types";
import { verifyImageProof } from "@/lib/ai/verify-image-proof";
import { fetchCommunityCampaignMilestonesFromGraph } from "@/lib/community/campaign-subgraph";
import { canSubmitMilestone } from "@/lib/community/milestone-submit-eligibility";
import { isValidOnChainChallengeId } from "@/lib/community/campaign-milestone-counts";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const proofUrls = Array.isArray(body.proofUrls)
    ? body.proofUrls.map((u: unknown) => String(u).trim()).filter(Boolean)
    : [];
  const milestoneIdRaw = body.milestoneId;
  const milestoneId =
    milestoneIdRaw != null && milestoneIdRaw !== "" ? Number(milestoneIdRaw) : null;

  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  if (proofUrls.length === 0) return NextResponse.json({ error: "proofUrls is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select(
      "id, community_id, status, title, proof_instructions, proof_cadence, display_ends_at, on_chain_challenge_id, proof_type",
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!isCampaignParticipatable(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not open for participation" }, { status: 400 });
  }
  if (isCampaignEndedByDate(campaign.display_ends_at)) {
    return NextResponse.json({ error: "Campaign has ended" }, { status: 400 });
  }

  if (!isValidOnChainChallengeId(campaign.on_chain_challenge_id)) {
    return NextResponse.json(
      {
        error:
          "This campaign requires on-chain proof submission. Ask the community owner to finish on-chain registration.",
      },
      { status: 403 },
    );
  }

  const challengeId = campaign.on_chain_challenge_id;
  if (milestoneId == null || Number.isNaN(milestoneId)) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
  }

  const milestones = await fetchCommunityCampaignMilestonesFromGraph(
    challengeId,
    walletAddress,
    true,
  );
  const milestone = milestones.find((m) => m.milestone_id === milestoneId);
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (milestone.completed) {
    return NextResponse.json({ error: "Milestone already completed" }, { status: 409 });
  }
  if (!canSubmitMilestone(milestone)) {
    return NextResponse.json(
      { error: "This milestone is not open for submission yet. Check back when its day starts." },
      { status: 400 },
    );
  }

  const isLiveCamera = campaign.proof_type === "live_camera";
  if (isLiveCamera && proofUrls.length < 2) {
    return NextResponse.json(
      { error: "At least 2 frames are required for live camera proof." },
      { status: 400 },
    );
  }
  if (!isLiveCamera && proofUrls.length !== 1) {
    return NextResponse.json({ error: "Exactly one proof image is required." }, { status: 400 });
  }

  let verdict;
  try {
    verdict = await verifyImageProof({
      imageUrl: isLiveCamera ? proofUrls : proofUrls[0],
      goal: campaign.title,
      milestone: milestone.label,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 503 },
    );
  }

  if (!verdict.verified) {
    return NextResponse.json(
      { verified: false, reason: verdict.reason ?? "Proof was not accepted." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    verified: true,
    requiresOnChain: true,
    challengeId,
    milestoneId,
    reason: verdict.reason,
    proofUrl: proofUrls[0],
  });
}
