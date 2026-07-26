import { NextRequest, NextResponse } from "next/server";
import { keccak256 } from "viem";
import { parseForfeitCommitmentCreatedFromTx } from "@/lib/dashboard/parse-forfeit-tx";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  sendForfeitDestinationTaggedEmail,
  sendVerifierInviteEmail,
  sendVerifierTaggedEmail,
} from "@/lib/email/send-verifier-invite";
import { normalizeMarketingAppUrl } from "@/lib/marketing-email-template";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";
import { resolveUsernameForAddress } from "@/lib/resolve-username";

export const dynamic = "force-dynamic";
/** Allow RPC retries — stake is already locked; finishing the save can take a bit. */
export const maxDuration = 60;

const EVIDENCE_TYPES = ["photo", "camera", "gps", "gps-checkin", "strava", "self"] as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Called by the client right after its own `waitForTransactionReceipt` on the
 * ForfeitMarket.createCommitment tx. Independently re-derives the CommitmentCreated
 * event server-side (never trusts the client's claim) before writing anything to
 * Supabase.
 *
 * Money-safety rules:
 * - Once the tx is verified on-chain for this wallet, we ALWAYS try to persist
 *   the commitment row. Invite email / reminders are best-effort and must never
 *   block or invalidate a successful stake.
 * - Responses for verified txs are retryable so the client can resume after
 *   refresh without staking again.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const txHash = String(body.txHash ?? "").trim() as `0x${string}`;
  const walletAddress = String(body.walletAddress ?? "").trim().toLowerCase();
  const title = String(body.title ?? "").trim().slice(0, 100) || "Forfeit";
  const description = String(body.description ?? "").trim().slice(0, 500) || title;
  const evidenceType = String(body.evidenceType ?? "photo").trim();
  const verificationMethodRaw = String(body.verificationMethod ?? "ai").trim();
  const verificationMethod = ["self", "friend", "ai"].includes(verificationMethodRaw)
    ? verificationMethodRaw
    : "ai";
  const isPrivate = true;
  const remindEnabled = body.remindEnabled !== false;
  const verifierUsername = body.verifierUsername ? String(body.verifierUsername).trim() : null;
  const verifierEmail = body.verifierEmail ? String(body.verifierEmail).trim() : null;
  const verifierInviteCode = body.verifierInviteCode ? String(body.verifierInviteCode).trim() : null;
  const isCharityIntent = Boolean(body.isCharityIntent);
  let destinationFriendUsername = body.destinationFriendUsername
    ? String(body.destinationFriendUsername).trim().slice(0, 64)
    : null;
  let destinationFriendEmail = body.destinationFriendEmail
    ? String(body.destinationFriendEmail).trim().slice(0, 200)
    : null;

  if (!txHash.startsWith("0x")) {
    return NextResponse.json({ error: "txHash is required", retryable: false }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required", retryable: false }, { status: 400 });
  }

  const normalizedEvidenceType = (
    EVIDENCE_TYPES as readonly string[]
  ).includes(evidenceType)
    ? evidenceType === "self"
      ? "photo"
      : evidenceType === "gps-checkin"
        ? "gps"
        : evidenceType
    : "photo";

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "DB unavailable — retry in a moment", retryable: true },
      { status: 503 },
    );
  }

  // Idempotency: a retried confirm-create for the same tx returns the existing row.
  const { data: existing } = await admin
    .from("forfeit_commitments")
    .select("id, on_chain_commitment_id")
    .eq("create_tx_hash", txHash)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, commitmentId: existing.id, alreadyConfirmed: true });
  }

  // Also idempotent on commitment id if a prior insert used a different path.
  // (Handled after parse once we know the id.)

  // Server RPC can lag the wallet RPC. Retry until the receipt/event is visible.
  let parsed: Awaited<ReturnType<typeof parseForfeitCommitmentCreatedFromTx>> = null;
  let parseError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      parsed = await parseForfeitCommitmentCreatedFromTx(txHash);
      if (parsed) break;
    } catch (err) {
      parseError = err;
    }
    await new Promise((r) => setTimeout(r, 500 + attempt * 800));
  }

  if (!parsed) {
    const message =
      parseError instanceof Error
        ? parseError.message
        : "Transaction not indexed yet — retrying will not stake again.";
    return NextResponse.json({ error: message, retryable: true }, { status: 503 });
  }

  if (parsed.creator !== walletAddress) {
    return NextResponse.json(
      {
        error: "This transaction was not created by your wallet.",
        retryable: false,
      },
      { status: 400 },
    );
  }

  // Second idempotency check by on-chain id (covers race / partial writes).
  const { data: existingByChainId } = await admin
    .from("forfeit_commitments")
    .select("id")
    .eq("on_chain_commitment_id", Number(parsed.commitmentId))
    .maybeSingle();
  if (existingByChainId) {
    return NextResponse.json({
      ok: true,
      commitmentId: existingByChainId.id,
      alreadyConfirmed: true,
    });
  }

  const hasResolvedVerifier = parsed.verifier !== ZERO_ADDRESS.toLowerCase();

  // Friend destination: always try to snapshot a real @username / email so the
  // feed never falls back to the generic "a friend" label.
  if (
    parsed.destinationType === 2 &&
    parsed.destinationAddr &&
    parsed.destinationAddr !== ZERO_ADDRESS.toLowerCase()
  ) {
    if (!destinationFriendUsername) {
      destinationFriendUsername = await resolveUsernameForAddress(
        admin,
        parsed.destinationAddr,
      );
    }
    if (!destinationFriendEmail) {
      const { data: destProfile } = await admin
        .from("profiles")
        .select("email")
        .ilike("address", parsed.destinationAddr)
        .maybeSingle();
      const email =
        !!destProfile?.email && !String(destProfile.email).endsWith("@wallet.local")
          ? String(destProfile.email)
          : null;
      destinationFriendEmail = email;
    }
  }

  const baseRow = {
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
  };

  const snapshotRow = {
    stake_amount_wei: parsed.stakeAmount.toString(),
    token: parsed.token,
    destination_type: parsed.destinationType,
    destination_addr: parsed.destinationAddr,
    destination_friend_username: destinationFriendUsername,
    destination_friend_email: destinationFriendEmail,
    is_charity_intent: isCharityIntent,
  };

  // Persist commitment first — money is already locked. Strip unknown columns
  // if migrations aren't applied yet so we never fail the stake save.
  let commitment: { id: string } | null = null;
  let insertError: { message: string } | null = null;
  {
    const attempts: Record<string, unknown>[] = [
      { ...baseRow, ...snapshotRow },
      {
        ...baseRow,
        is_charity_intent: isCharityIntent,
        stake_amount_wei: snapshotRow.stake_amount_wei,
        token: snapshotRow.token,
        destination_type: snapshotRow.destination_type,
        destination_addr: snapshotRow.destination_addr,
      },
      { ...baseRow, is_charity_intent: isCharityIntent },
      baseRow,
    ];

    for (const payload of attempts) {
      const result = await admin
        .from("forfeit_commitments")
        .insert(payload)
        .select("id")
        .single();
      if (!result.error && result.data) {
        commitment = result.data;
        insertError = null;
        break;
      }
      insertError = result.error;
      const msg = result.error?.message ?? "";
      // Unique = parallel retry already saved — treat as success below.
      if (/duplicate|unique/i.test(msg)) break;
      const missingCol =
        /is_charity_intent|stake_amount_wei|destination_type|destination_addr|destination_friend|column .* does not exist/i.test(
          msg,
        );
      if (!missingCol) break;
    }
  }

  if (insertError || !commitment) {
    if (insertError && /duplicate|unique/i.test(insertError.message)) {
      const { data: raced } = await admin
        .from("forfeit_commitments")
        .select("id")
        .or(
          `create_tx_hash.eq.${txHash},on_chain_commitment_id.eq.${Number(parsed.commitmentId)}`,
        )
        .maybeSingle();
      if (raced) {
        return NextResponse.json({ ok: true, commitmentId: raced.id, alreadyConfirmed: true });
      }
    }
    // Stake is on-chain — always ask the client to retry the save, never to recreate.
    return NextResponse.json(
      {
        error: insertError?.message ?? "Failed to save commitment",
        retryable: true,
        onChainCommitmentId: Number(parsed.commitmentId),
      },
      { status: 503 },
    );
  }

  // ---- Best-effort side effects (never fail the request) ----
  const appUrl = normalizeMarketingAppUrl(
    process.env.NEXT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.staydelulu.xyz",
  );

  if (verificationMethod === "friend") {
    try {
      const creatorUsername = await resolveUsernameForAddress(admin, walletAddress);

      if (hasResolvedVerifier) {
        const reviewUrl = `${appUrl}/forfeit/verify/${parsed.commitmentId.toString()}`;
        const { data: verifierProfile } = await admin
          .from("profiles")
          .select("email")
          .ilike("address", parsed.verifier)
          .maybeSingle();
        const profileEmail =
          !!verifierProfile?.email && !verifierProfile.email.endsWith("@wallet.local")
            ? (verifierProfile.email as string)
            : null;
        const notifyEmail = profileEmail ?? verifierEmail;
        const creatorLabel = creatorUsername ? `@${creatorUsername}` : "Someone";

        if (notifyEmail) {
          await sendVerifierTaggedEmail(notifyEmail, {
            creatorUsername,
            creatorWallet: walletAddress,
            commitmentTitle: title,
            reviewUrl,
            appUrl,
          }).catch((err) => {
            console.error("[forfeit/confirm-create] tagged email failed", err);
          });
        }

        await notifyManyRecipients(admin, [parsed.verifier], {
          title: `${creatorLabel} tagged you as a verifier`,
          body: `You'll review proof for "${title}" when it's submitted.`,
          url: reviewUrl,
          type: "forfeit_verifier_tagged",
          message: `**${creatorLabel}** tagged you to verify **${title}**.`,
          eventKeyFor: (addr) => `forfeit_verifier_tagged:${commitment.id}:${addr}`,
        }).catch((err) => {
          console.error("[forfeit/confirm-create] verifier notification failed", err);
        });
      } else if (verifierEmail && verifierInviteCode) {
        const inviteCodeHash = keccak256(verifierInviteCode as `0x${string}`);
        const { error: inviteErr } = await admin.from("forfeit_verifier_invites").insert({
          commitment_id: commitment.id,
          friend_username: verifierUsername,
          friend_email: verifierEmail,
          invite_code_hash: inviteCodeHash,
          status: "pending",
        });
        if (inviteErr) {
          console.error("[forfeit/confirm-create] invite row failed", inviteErr);
        } else {
          const inviteUrl = `${appUrl}/forfeit/verify/${parsed.commitmentId.toString()}?code=${verifierInviteCode}`;
          await sendVerifierInviteEmail(verifierEmail, {
            creatorUsername,
            creatorWallet: walletAddress,
            commitmentTitle: title,
            inviteUrl,
            appUrl,
          }).catch((err) => {
            console.error("[forfeit/confirm-create] invite email failed", err);
          });
        }
      } else {
        // Friend verify requested but invite details incomplete — commitment is still
        // saved. Creator can re-invite later; never roll back the stake save.
        console.warn(
          "[forfeit/confirm-create] friend verify without invite details",
          commitment.id,
        );
      }
    } catch (err) {
      console.error("[forfeit/confirm-create] friend side-effects failed", err);
    }
  }

  // Friend forfeit-destination: they always have a resolved wallet already
  // (on-chain Friend destinationAddr can't be zero), unlike friend-verify, which
  // can point at an email with no wallet yet — so this is always a real user,
  // never an invite-by-email flow.
  if (
    parsed.destinationType === 2 &&
    parsed.destinationAddr &&
    parsed.destinationAddr !== ZERO_ADDRESS.toLowerCase()
  ) {
    try {
      const creatorUsername = await resolveUsernameForAddress(admin, walletAddress);

      if (destinationFriendEmail) {
        await sendForfeitDestinationTaggedEmail(destinationFriendEmail, {
          creatorUsername,
          creatorWallet: walletAddress,
          commitmentTitle: title,
          appUrl,
        }).catch((err) => {
          console.error("[forfeit/confirm-create] destination email failed", err);
        });
      }

      const creatorLabel = creatorUsername ? `@${creatorUsername}` : "Someone";
      await notifyManyRecipients(admin, [parsed.destinationAddr], {
        title: `${creatorLabel} set you as their forfeit destination`,
        body: `If they miss "${title}", the stake comes to you.`,
        url: "/",
        type: "forfeit_destination_tagged",
        message: `**${creatorLabel}** set you as where their forfeit stake goes if they miss it.`,
        eventKeyFor: (addr) => `forfeit_destination_tagged:${commitment.id}:${addr}`,
      }).catch((err) => {
        console.error("[forfeit/confirm-create] destination notification failed", err);
      });
    } catch (err) {
      console.error("[forfeit/confirm-create] destination side-effects failed", err);
    }
  }

  if (remindEnabled) {
    await admin
      .from("forfeit_reminders")
      .insert({
        commitment_id: commitment.id,
        reminder_type: "period_deadline",
        next_fire_at: new Date(Number(parsed.firstDeadline) * 1000).toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("[forfeit/confirm-create] reminder insert failed", error);
      });
  }

  return NextResponse.json({
    ok: true,
    commitmentId: commitment.id,
    onChainCommitmentId: Number(parsed.commitmentId),
  });
}
