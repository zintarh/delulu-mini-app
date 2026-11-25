import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";

export const dynamic = "force-dynamic";

/**
 * "I'm here" from the app: last seen, plus whether it's running installed
 * (home-screen app) — the signal retention analytics and nudges target on.
 */
export async function POST(request: NextRequest) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const body = await request.json().catch(() => ({}));
  const standalone = body.standalone === true;
  const installed = body.installed === true;
  const platform = typeof body.platform === "string" ? body.platform.slice(0, 20) : null;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });
  const now = new Date().toISOString();

  const update: Record<string, string> = { last_seen_at: now };
  if (standalone) update.last_standalone_at = now;
  if (platform) update.platform = platform;
  await admin.from("profiles").update(update).eq("address", wallet);
  // A row per day the app was open (Lagos calendar day): "came back on N days" for referral partners.
  const lagosDay = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
  await admin.from("presence_days").upsert({ wallet: wallet.toLowerCase(), day: lagosDay }, { onConflict: "wallet,day", ignoreDuplicates: true }).then(() => {}, () => {});
  if (standalone || installed) {
    await admin.from("profiles").update({ pwa_installed_at: now }).eq("address", wallet).is("pwa_installed_at", null);
  }
  return NextResponse.json({ ok: true });
}
