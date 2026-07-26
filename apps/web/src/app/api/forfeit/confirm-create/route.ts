import { NextRequest, NextResponse } from "next/server";
import { keccak256 } from "viem";
import { parseForfeitCommitmentCreatedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { sendVerifierInviteEmail } from "@/lib/email/send-verifier-invite";
import { normalizeMarketingAppUrl } from "@/lib/marketing-email-template";

export const dynamic = "force-dynamic";

const EVIDENCE_TYPES = ["photo", "camera", "timelapse", "gps", "strava", "google_health", "self"] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Called by the client right after its own `waitForTransactionReceipt` on the
 * ForfeitMarket.createCommitment tx. Independently re-derives the CommitmentCreated
 * event server-side (never trusts the client's claim) before writing anything to
 * Supabase, matching the confirm-create/confirm-join pattern used for campaigns.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim() as `0x${string}`;
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const title = String(body.title ?? "").trim().slice(0, 100);
  const description = String(body.description ?? "").trim().slice(0, 500);
  const evidenceType = String(body.evidenceType ?? "").trim();
  const verificationMethod = String(body.verificationMethod ?? "ai").trim();
  const isPrivate = Boolean(body.isPrivate);
  const remindEnabled = body.remindEnabled !== false;
  const verifierUsername = body.verifierUsername ? String(body.verifierUsername).trim() : null;
  const verifierEmail = body.verifierEmail ? String(body.verifierEmail).trim() : null;
  const verifierInviteCode = body.verifierInviteCode ? String(body.verifierInviteCode).trim() : null;

  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required" }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }
  if (!title || !description) {
    return NextResponse.json({ error: "title and description are required" }, { status: 400 });
  }
  const normalizedEvidenceType = (
    // "self" evidence maps to the "self" verification method, not a distinct evidence type,
    // but the mock UI's evidenceId can legitimately be "self" — accept it here too.
    EVIDENCE_TYPES as readonly string[]
  ).includes(evidenceType)
    ? evidenceType === "self"
      ? "photo"
      : evidenceType
    : null;
  if (!normalizedEvidenceType) {
    return NextResponse.json({ error: "Invalid evidenceType" }, { status: 400 });
  }
  if (!["self", "friend", "ai"].includes(verificationMethod)) {
    return NextResponse.json({ error: "Invalid verificationMethod" }, { status: 400 });
  }
  if (verificationMethod === "friend" && (!verifierEmail || !verifierInviteCode)) {
    return NextResponse.json(
      { error: "verifierEmail and verifierInviteCode are required for friend verification" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  // Idempotency: a retried confirm-create for the same tx returns the existing row
  // instead of erroring or double-inserting.
  const { data: existing } = await admin
    .from("forfeit_commitments")
    .select("id, on_chain_commitment_id")
    .eq("create_tx_hash", txHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, commitmentId: existing.id, alreadyConfirmed: true });
  }

  let parsed;
  try {
    parsed = await parseForfeitCommitmentCreatedFromTx(txHash);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read transaction" },
      { status: 400 },
    );
  }

  if (!parsed || parsed.creator !== walletAddress) {
    return NextResponse.json(
      { error: "CommitmentCreated event not found for this wallet." },
      { status: 400 },
    );
  }

  const hasResolvedVerifier = parsed.verifier !== ZERO_ADDRESS.toLowerCase();

  const { data: commitment, error: insertError } = await admin
    .from("forfeit_commitments")
    .insert({
      on_chain_commitment_id: Number(parsed.commitmentId),
      creator_wallet: walletAddress,
      title,
      description,
      evidence_type: normalizedEvidenceType,
      verification_method: verificationMethod,
      is_private: isPrivate,
      remind_enabled: remindEnabled,
      verifier_wallet: hasResolvedVerifier ? parsed.verifier : null,
      status: "active",
      create_tx_hash: txHash,
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !commitment) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save commitment" },
      { status: 500 },
    );
  }

  if (verificationMethod === "friend" && verifierEmail && verifierInviteCode && !hasResolvedVerifier) {
    const inviteCodeHash = keccak256(verifierInviteCode as `0x${string}`);
    await admin.from("forfeit_verifier_invites").insert({
      commitment_id: commitment.id,
      friend_username: verifierUsername,
      friend_email: verifierEmail,
      invite_code_hash: inviteCodeHash,
      status: "pending",
    });

    const appUrl = normalizeMarketingAppUrl(
      process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.staydelulu.xyz",
    );
    const inviteUrl = `${appUrl}/forfeit/verify/${parsed.commitmentId.toString()}?code=${verifierInviteCode}`;

    try {
      await sendVerifierInviteEmail(verifierEmail, {
        creatorUsername: null,
        creatorWallet: walletAddress,
        commitmentTitle: title,
        inviteUrl,
        appUrl,
      });
    } catch (err) {
      // Non-fatal: the commitment and invite record already exist; the friend can still
      // be reached via reminder cron / resend later. Don't fail the whole confirm call.
      console.error("[forfeit/confirm-create] invite email failed", err);
    }
  }

  if (remindEnabled) {
    await admin.from("forfeit_reminders").insert({
      commitment_id: commitment.id,
      reminder_type: "period_deadline",
      next_fire_at: new Date(Number(parsed.firstDeadline) * 1000).toISOString(),
    });
  }

  return NextResponse.json({ ok: true, commitmentId: commitment.id });
}
