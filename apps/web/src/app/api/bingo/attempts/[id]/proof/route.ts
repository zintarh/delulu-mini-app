import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { loadAttempt, recountAttempt } from "@/lib/bingo/attempts";
import { readJoined, readMilestoneCompleted } from "@/lib/bingo/chain";
import { loadVersion } from "@/lib/bingo/cycles";
import { bonusTierKey, cyclePhase, daySlot, rollingAttemptOver, rollingMissedDay } from "@/lib/bingo/types";
import { readPeriodOutcome } from "@/lib/bingo/rolling";
import { parseTzOffset } from "@/lib/proof-integrity/check";
import { reviewProof } from "@/lib/proof-integrity/review";
import { recordApprovedProof } from "@/lib/proof-reward/grant";
import { isServerVerified } from "@/lib/bingo/server-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const err = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

/**
 * Reviews one photo for one square. Required squares then need the player's
 * on-chain proof for today's day slot (the stake rules live there) and only
 * fill once /confirm sees that tx; bonus squares fill straight away.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const squareIndex = Number(body.squareIndex);
  const proofUrls: string[] = Array.isArray(body.proofUrls) ? body.proofUrls.map((u: unknown) => String(u).trim()).filter(Boolean) : [];
  if (!Number.isInteger(squareIndex)) return err("Pick a square first.", 400);
  if (proofUrls.length !== 1) return err("Add one photo for this square.", 400);

  const admin = getSupabaseAdmin();
  if (!admin) return err("Something went wrong on our side. Try again in a moment.", 500);

  const attempt = await loadAttempt(admin, id);
  if (!attempt || attempt.wallet !== wallet) return err("This Bingo card isn't yours.", 403);
  if (attempt.cycle_id == null) {
    return rollingProof(admin, attempt, wallet, squareIndex, proofUrls, parseTzOffset(body.tzOffsetMinutes));
  }
  if (attempt.status !== "active" || !attempt.cycle || !attempt.tier) return err("This Bingo has ended.", 400);
  const phase = cyclePhase(attempt.cycle);
  if (phase === "upcoming") return err("This Bingo hasn't started yet.", 400);
  if (phase === "ended") return err("This Bingo has ended.", 400);

  const version = await loadVersion(admin, attempt.version_id);
  const mission = version.missions[squareIndex];
  if (!mission) return err("That square doesn't exist.", 404);

  const { data: existing } = await admin
    .from("bingo_squares")
    .select("id, status, slot_index")
    .eq("attempt_id", attempt.id)
    .eq("square_index", squareIndex)
    .maybeSingle();
  if (existing?.status === "filled") return err("You've already filled this square.", 409);

  const challengeId = attempt.tier.on_chain_challenge_id;
  const campaignRowId = attempt.tier.community_campaign_id;
  if (challengeId == null || !campaignRowId) return err("This Bingo is still being set up. Try again shortly.", 503);

  // Bonus square: its own free campaign, one window across the cycle (points, no G$).
  let bonus: { challengeId: number; campaignRowId: string; needsJoin: boolean } | null = null;
  if (mission.bonus) {
    const { data: bt } = await admin
      .from("bingo_cycle_tiers")
      .select("on_chain_challenge_id, community_campaign_id, setup_step")
      .eq("cycle_id", attempt.cycle.id)
      .eq("tier_key", bonusTierKey(squareIndex))
      .maybeSingle();
    if (!bt || bt.setup_step !== "ready" || bt.on_chain_challenge_id == null || !bt.community_campaign_id) {
      return err("Bonus squares are still being set up. Try again shortly.", 503);
    }
    const bonusChallenge = Number(bt.on_chain_challenge_id);
    if (await readMilestoneCompleted(bonusChallenge, 0, wallet)) {
      if (existing?.status === "confirming") {
        await admin.from("bingo_squares").update({ status: "filled", filled_at: new Date().toISOString() }).eq("id", existing.id);
        await recountAttempt(admin, attempt.id);
        return NextResponse.json({ filled: true, recovered: true });
      }
      return err("You've already filled this square.", 409);
    }
    bonus = { challengeId: bonusChallenge, campaignRowId: bt.community_campaign_id as string, needsJoin: !(await readJoined(bonusChallenge, wallet)) };
  }

  let slot: number | null = null;
  if (!mission.bonus) {
    slot = daySlot(attempt.cycle.starts_at, attempt.cycle.ends_at);
    if (slot == null) return err("This Bingo isn't running right now.", 400);
    const { data: usedToday } = await admin
      .from("bingo_squares")
      .select("id")
      .eq("attempt_id", attempt.id)
      .eq("slot_index", slot)
      .eq("status", "filled")
      .limit(1);
    if (usedToday?.length) return err("You've filled today's square. Your next one opens tomorrow.", 409, { code: "slot_used" });

    // A proof that reached the chain but never got confirmed here: settle it now.
    if (existing?.status === "confirming" && existing.slot_index === slot && (await readMilestoneCompleted(challengeId, slot, wallet))) {
      await admin.from("bingo_squares").update({ status: "filled", filled_at: new Date().toISOString() }).eq("id", existing.id);
      await recountAttempt(admin, attempt.id);
      return NextResponse.json({ filled: true, recovered: true });
    }
    if (await readMilestoneCompleted(challengeId, slot, wallet)) {
      return err("You've filled today's square. Your next one opens tomorrow.", 409, { code: "slot_used" });
    }
  }

  let review;
  try {
    review = await reviewProof(
      admin,
      {
        wallet,
        kind: "campaign",
        refId: campaignRowId,
        // Same key the campaign route uses, so a retry of today's photo isn't a "reused" photo.
        periodKey: mission.bonus ? `bingo:${attempt.id}:${squareIndex}` : `${campaignRowId}:${slot}`,
        tzOffsetMinutes: parseTzOffset(body.tzOffsetMinutes),
      },
      proofUrls,
      { liveCamera: false, ai: { goal: mission.title } },
    );
  } catch (e) {
    console.error("[bingo/proof] review failed", e);
    return err("We couldn't check your photo right now. Please try again in a minute.", 503);
  }
  if (!review.ok) {
    return NextResponse.json({ verified: false, code: review.code, reason: review.reason, error: review.reason }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from("bingo_squares").upsert(
    {
      attempt_id: attempt.id,
      square_index: squareIndex,
      mission_title: mission.title,
      bonus: mission.bonus,
      slot_index: slot,
      proof_url: proofUrls[0],
      status: "confirming",
      proof_tx: null,
      review_note: review.reason?.slice(0, 300) ?? null,
      approved_at: now,
      filled_at: null,
    },
    { onConflict: "attempt_id,square_index" },
  );
  if (upsertError) return err("Couldn't save your square. Try again.", 500);

  if (bonus) {
    // Proven on-chain like any square; the free campaign awards points (no G$ reward row).
    return NextResponse.json({
      verified: true,
      requiresOnChain: true,
      challengeId: bonus.challengeId,
      milestoneId: 0,
      proofUrl: proofUrls[0],
      bonusCampaignId: bonus.campaignRowId,
      needsJoin: bonus.needsJoin,
      reason: review.reason,
    });
  }

  // Lets the on-chain proof of this exact photo earn the per-proof G$ reward.
  await recordApprovedProof(admin, { wallet, kind: "campaign", proofUrl: proofUrls[0], refId: campaignRowId });

  return NextResponse.json({
    verified: true,
    requiresOnChain: true,
    challengeId,
    milestoneId: slot,
    proofUrl: proofUrls[0],
    reason: review.reason,
  });
}

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Rolling (3-day) card: the attempt is the player's own AI-verified Forfeit
 * goal, so today's square is today's period — reviewed against the day's
 * mission, then proven and resolved on ForfeitMarket exactly like a personal
 * goal (same rewards, same deadline/forfeit handling).
 */
async function rollingProof(
  admin: Admin,
  attempt: NonNullable<Awaited<ReturnType<typeof loadAttempt>>>,
  wallet: string,
  squareIndex: number,
  proofUrls: string[],
  tzOffsetMinutes: number | null,
) {
  const { data: campaign } = await admin.from("bingo_campaigns").select("duration_days").eq("id", attempt.campaign_id).single();
  const days = Number(campaign?.duration_days ?? 3);
  if (attempt.status !== "active" || attempt.forfeit_commitment_id == null) return err("This card has ended.", 400);
  if (rollingMissedDay(attempt)) return err("A day was missed, so this card has ended. Start a fresh one.", 400, { code: "missed_day" });
  if (rollingAttemptOver(attempt, days)) return err("This card has ended.", 400);

  const slot = daySlot(attempt.started_at, attempt.ends_at);
  if (slot == null) return err("This card has ended.", 400);
  const version = await loadVersion(admin, attempt.version_id);
  const mission = version.missions[squareIndex];
  if (!mission) return err("That square doesn't exist.", 404);
  if (squareIndex !== slot) {
    return err(`Today is day ${slot + 1}: “${version.missions[slot]?.title ?? ""}”.`, 409, { code: "wrong_day" });
  }

  const { data: existing } = await admin
    .from("bingo_squares")
    .select("id, status, proof_url")
    .eq("attempt_id", attempt.id)
    .eq("square_index", squareIndex)
    .maybeSingle();
  if (existing?.status === "filled") return err("You've filled today's square. Your next one opens tomorrow.", 409, { code: "slot_used" });

  const onChainId = Number(attempt.forfeit_commitment_id);
  const outcome = await readPeriodOutcome(onChainId, slot);
  if (outcome === 1) {
    // Proven and resolved on-chain but never confirmed here: settle it now.
    if (existing) {
      await admin.from("bingo_squares").update({ status: "filled", filled_at: new Date().toISOString() }).eq("id", existing.id);
      await recountAttempt(admin, attempt.id);
      return NextResponse.json({ filled: true, recovered: true });
    }
    return err("You've filled today's square. Your next one opens tomorrow.", 409, { code: "slot_used" });
  }
  if (outcome === 2) return err("A day was missed, so this card has ended. Start a fresh one.", 400, { code: "missed_day" });

  // Cards that still name Delulu's server as verifier: the player takes that role and signs the day.
  const serverVerified = await isServerVerified(onChainId).catch(() => false);
  // Photo already approved, day not finished (cancelled signature or a timeout): no second review —
  // the player signs the proof again (their own on-chain activity), then Delulu finishes the day.
  if (serverVerified && existing?.status === "confirming") {
    return NextResponse.json({
      verified: true,
      requiresOnChain: true,
      kind: "forfeit",
      serverVerified: true,
      onChainCommitmentId: onChainId,
      proofUrl: existing.proof_url ?? proofUrls[0],
    });
  }

  const { data: goal } = await admin.from("forfeit_commitments").select("id").eq("on_chain_commitment_id", onChainId).maybeSingle();
  if (!goal) return err("Your card is still syncing. Try again in a moment.", 503);

  let review;
  try {
    review = await reviewProof(
      admin,
      { wallet, kind: "forfeit", refId: goal.id as string, periodKey: `${goal.id}:${slot}`, tzOffsetMinutes },
      proofUrls,
      { liveCamera: false, ai: { goal: mission.title } },
    );
  } catch (e) {
    console.error("[bingo/proof] review failed", e);
    return err("We couldn't check your photo right now. Please try again in a minute.", 503);
  }
  if (!review.ok) {
    return NextResponse.json({ verified: false, code: review.code, reason: review.reason, error: review.reason }, { status: 422 });
  }

  const { error: upsertError } = await admin.from("bingo_squares").upsert(
    {
      attempt_id: attempt.id,
      square_index: squareIndex,
      mission_title: mission.title,
      bonus: false,
      slot_index: slot,
      proof_url: proofUrls[0],
      status: "confirming",
      proof_tx: null,
      review_note: review.reason?.slice(0, 300) ?? null,
      approved_at: new Date().toISOString(),
      filled_at: null,
    },
    { onConflict: "attempt_id,square_index" },
  );
  if (upsertError) return err("Couldn't save your square. Try again.", 500);

  // Same reward path as a personal goal: this exact photo, proven on-chain, earns.
  await recordApprovedProof(admin, { wallet, kind: "forfeit", proofUrl: proofUrls[0], refId: goal.id as string });

  // The player signs the proof and the day. A card that still names the server comes back
  // with serverVerified so the wallet can take the verifier role first.
  return NextResponse.json({
    verified: true,
    requiresOnChain: true,
    kind: "forfeit",
    ...(serverVerified ? { serverVerified: true } : {}),
    onChainCommitmentId: onChainId,
    proofUrl: proofUrls[0],
    reason: review.reason,
  });
}
