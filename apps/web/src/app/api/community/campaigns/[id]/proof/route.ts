import { NextRequest, NextResponse } from "next/server";
import { computeProofPoints } from "@/lib/community/campaign-points";
import {
  isCampaignEndedByDate,
  isCampaignParticipatable,
} from "@/lib/community/campaign-types";
import { verifyImageProof } from "@/lib/ai/verify-image-proof";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  fetchCommunityCampaignMilestonesFromGraph,
} from "@/lib/community/campaign-subgraph";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await params;
  const body = await request.json().catch(() => ({}));
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const proofUrl = String(body.proofUrl ?? "").trim();
  const milestoneIdRaw = body.milestoneId;
  const milestoneId =
    milestoneIdRaw != null && milestoneIdRaw !== "" ? Number(milestoneIdRaw) : null;

  if (!walletAddress) return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  if (!proofUrl) return NextResponse.json({ error: "proofUrl is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin
    .from("community_campaigns")
    .select("id, community_id, status, title, proof_instructions, proof_cadence, display_ends_at, on_chain_challenge_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!isCampaignParticipatable(campaign.status)) {
    return NextResponse.json({ error: "Campaign is not open for participation" }, { status: 400 });
  }
  if (isCampaignEndedByDate(campaign.display_ends_at)) {
    return NextResponse.json({ error: "Campaign has ended" }, { status: 400 });
  }

  if (campaign.on_chain_challenge_id) {
    if (milestoneId == null || Number.isNaN(milestoneId)) {
      return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
    }
    const milestones = await fetchCommunityCampaignMilestonesFromGraph(
      campaign.on_chain_challenge_id,
      walletAddress,
    );
    const milestone = milestones.find((m) => m.milestone_id === milestoneId);
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    if (milestone.completed) {
      return NextResponse.json({ error: "Milestone already completed" }, { status: 409 });
    }

    let verdict;
    try {
      verdict = await verifyImageProof({
        imageUrl: proofUrl,
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
      challengeId: campaign.on_chain_challenge_id,
      milestoneId,
      reason: verdict.reason,
    });
  }

  let verdict;
  try {
    verdict = await verifyImageProof({
      imageUrl: proofUrl,
      goal: campaign.title,
      milestone: campaign.proof_instructions ?? campaign.title,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 503 },
    );
  }

  const verified = verdict.verified;

  if (!verified) {
    if (!campaign.on_chain_challenge_id) {
      const { data: participant } = await admin
        .from("campaign_participants")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("wallet_address", walletAddress)
        .eq("status", "joined")
        .maybeSingle();

      if (participant) {
        const rejectedAt = new Date().toISOString();
        await admin.from("campaign_proof_submissions").insert({
          campaign_id: campaignId,
          participant_id: participant.id,
          wallet_address: walletAddress,
          proof_url: proofUrl,
          status: "rejected",
          points_awarded: 0,
          ai_verdict: verdict,
          submitted_at: rejectedAt,
          reviewed_at: rejectedAt,
        });
      }
    }

    return NextResponse.json(
      { verified: false, reason: verdict.reason ?? "Proof was not accepted." },
      { status: 422 },
    );
  }

  const { data: participant } = await admin
    .from("campaign_participants")
    .select("id, points_total, current_streak, status")
    .eq("campaign_id", campaignId)
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!participant || participant.status !== "joined") {
    return NextResponse.json({ error: "Join the campaign before submitting proof." }, { status: 403 });
  }

  // Cadence cooldown — prevent multiple submissions within the same period
  const { data: lastApproved } = await admin
    .from("campaign_proof_submissions")
    .select("submitted_at")
    .eq("campaign_id", campaignId)
    .eq("wallet_address", walletAddress)
    .eq("status", "approved")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastApproved?.submitted_at) {
    const windowMs = campaign.proof_cadence === "weekly" ? 604800000 : 86400000;
    const elapsed = Date.now() - new Date(lastApproved.submitted_at).getTime();
    if (elapsed < windowMs) {
      const hoursLeft = Math.ceil((windowMs - elapsed) / 3600000);
      return NextResponse.json(
        {
          error: "cooldown",
          message: `Already submitted ${campaign.proof_cadence === "weekly" ? "this week" : "today"}. Next milestone available in ${hoursLeft}h.`,
        },
        { status: 429 },
      );
    }
  }

  const { points, nextStreak } = computeProofPoints({
    currentStreak: participant.current_streak ?? 0,
  });

  const now = new Date().toISOString();
  const { error: proofError } = await admin.from("campaign_proof_submissions").insert({
    campaign_id: campaignId,
    participant_id: participant.id,
    wallet_address: walletAddress,
    proof_url: proofUrl,
    status: "approved",
    points_awarded: points,
    ai_verdict: verdict,
    submitted_at: now,
    reviewed_at: now,
  });

  if (proofError) return NextResponse.json({ error: proofError.message }, { status: 500 });

  const newTotal = (participant.points_total ?? 0) + points;
  await admin
    .from("campaign_participants")
    .update({
      points_total: newTotal,
      current_streak: nextStreak,
    })
    .eq("id", participant.id);

  return NextResponse.json({
    verified: true,
    pointsAwarded: points,
    pointsTotal: newTotal,
    currentStreak: nextStreak,
    reason: verdict.reason,
  });
}
