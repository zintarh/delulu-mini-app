import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { normalizeMarketingAppUrl } from "@/lib/marketing-email-template";
import { sendRewardNotificationEmail } from "@/lib/email/send-reward-notification";

type GrantRow = {
  id: string;
  email_sent: boolean;
};

/**
 * Persist an admin RewardVault grant for audit, then email the recipient.
 * Recording is the critical path; email failure still returns the grant id.
 */
export async function POST(request: NextRequest) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    address?: string;
    amount?: number | string;
    amountWei?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
    reason?: string;
    txHash?: string;
    rewardId?: string;
    vaultAddress?: string;
    senderAddress?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawAddress = body.address?.trim() ?? "";
  if (!isAddress(rawAddress)) {
    return NextResponse.json({ error: "Valid wallet address is required" }, { status: 400 });
  }
  const recipientAddress = getAddress(rawAddress).toLowerCase();

  const amountNum = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const tokenSymbol = (body.tokenSymbol ?? "").trim();
  if (!tokenSymbol) {
    return NextResponse.json({ error: "tokenSymbol is required" }, { status: 400 });
  }

  const rawToken = body.tokenAddress?.trim() ?? "";
  if (!isAddress(rawToken)) {
    return NextResponse.json({ error: "Valid tokenAddress is required" }, { status: 400 });
  }
  const tokenAddress = getAddress(rawToken).toLowerCase();

  const txHash = (body.txHash ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "Valid txHash is required" }, { status: 400 });
  }

  const amountWei = (body.amountWei ?? "").trim();
  if (!/^\d+$/.test(amountWei)) {
    return NextResponse.json({ error: "amountWei is required" }, { status: 400 });
  }

  const rawSender = body.senderAddress?.trim() ?? "";
  if (!isAddress(rawSender)) {
    return NextResponse.json({ error: "Valid senderAddress is required" }, { status: 400 });
  }
  const senderAddress = getAddress(rawSender).toLowerCase();

  const reason = (body.reason ?? "").trim().slice(0, 120) || null;
  const rewardId = (body.rewardId ?? "").trim() || null;
  const vaultAddress =
    body.vaultAddress && isAddress(body.vaultAddress)
      ? getAddress(body.vaultAddress).toLowerCase()
      : null;

  const amountLabel = amountNum.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, username")
    .ilike("address", recipientAddress)
    .maybeSingle();

  const profileEmail = profile?.email?.trim().toLowerCase() ?? "";
  const hasRealEmail =
    !!profileEmail && profileEmail.includes("@") && !profileEmail.endsWith("@wallet.local");
  const recipientEmail = hasRealEmail ? profileEmail : null;
  const recipientUsername = profile?.username?.trim() || null;

  // Idempotent by tx_hash: insert, or load the existing row on conflict.
  // ignoreDuplicates + select returns null on conflict — that previously
  // skipped the email_sent guard and could re-send the notification email.
  let grant: GrantRow | null = null;
  let duplicate = false;

  const { data: existing } = await admin
    .from("admin_reward_grants")
    .select("id, email_sent")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existing) {
    grant = existing as GrantRow;
    duplicate = true;
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("admin_reward_grants")
      .insert({
        recipient_address: recipientAddress,
        recipient_username: recipientUsername,
        recipient_email: recipientEmail,
        token_address: tokenAddress,
        token_symbol: tokenSymbol,
        amount: amountNum,
        amount_wei: amountWei,
        reason,
        tx_hash: txHash,
        reward_id: rewardId,
        vault_address: vaultAddress,
        sender_address: senderAddress,
        staff_user_id: session.userId,
        staff_email: session.email,
        email_sent: false,
      })
      .select("id, email_sent")
      .maybeSingle();

    if (insertError) {
      // Race: another request inserted the same tx_hash between select and insert.
      if (insertError.code === "23505") {
        const { data: raced } = await admin
          .from("admin_reward_grants")
          .select("id, email_sent")
          .eq("tx_hash", txHash)
          .maybeSingle();
        if (raced) {
          grant = raced as GrantRow;
          duplicate = true;
        } else {
          console.error("[rewards/notify] unique race but row missing:", insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      } else {
        console.error("[rewards/notify] insert failed:", insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      grant = inserted as GrantRow | null;
    }
  }

  const grantId = grant?.id ?? null;
  if (!grantId) {
    return NextResponse.json({ error: "Failed to record reward grant" }, { status: 500 });
  }

  if (grant?.email_sent) {
    return NextResponse.json({
      recorded: true,
      sent: true,
      grantId,
      duplicate,
    });
  }

  if (!hasRealEmail || !recipientEmail) {
    return NextResponse.json({
      recorded: true,
      sent: false,
      grantId,
      duplicate,
      skipReason: "no_email",
    });
  }

  const appUrl = normalizeMarketingAppUrl(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://delulu.app",
  );
  const username =
    recipientUsername ||
    `${recipientAddress.slice(0, 6)}…${recipientAddress.slice(-4)}`;

  try {
    await sendRewardNotificationEmail(recipientEmail, {
      username,
      amountLabel,
      tokenSymbol,
      appUrl,
      claimUrl: `${appUrl}/rewards`,
      reason: reason ?? undefined,
    });

    await admin
      .from("admin_reward_grants")
      .update({ email_sent: true, email_error: null })
      .eq("id", grantId);

    return NextResponse.json({ recorded: true, sent: true, grantId, duplicate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    console.error("[rewards/notify] send failed:", err);
    await admin
      .from("admin_reward_grants")
      .update({ email_sent: false, email_error: message.slice(0, 500) })
      .eq("id", grantId);

    return NextResponse.json({
      recorded: true,
      sent: false,
      grantId,
      duplicate,
      skipReason: "send_failed",
    });
  }
}
