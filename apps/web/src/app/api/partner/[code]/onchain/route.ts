import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { loadPartner } from "@/lib/referral/partners";
import { buildPartnerOnchain } from "@/lib/referral/partner-onchain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/partner/:code/onchain — the partner's friends counted from the Celo blockchain
 * (today and all time). Same access as the partner page: the partner or a platform admin.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Something went wrong on our side." }, { status: 500 });
  const partner = await loadPartner(admin, code).catch(() => null);
  if (!partner) return NextResponse.json({ error: "This partner link doesn't exist." }, { status: 404 });

  const wallet = getAuthenticatedWallet(request)?.toLowerCase() ?? null;
  const isOwner = !!wallet && !!partner.ownerWallet && wallet === partner.ownerWallet.toLowerCase();
  let isAdmin = false;
  if (!isOwner) {
    const session = await readAdminSession().catch(() => null);
    isAdmin = !!session && isPlatformAdminRole(session.staffRole);
  }
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Not yours to see." }, { status: wallet ? 403 : 401 });

  try {
    return NextResponse.json(await buildPartnerOnchain(admin, partner), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[partner/onchain] failed", err);
    return NextResponse.json({ error: "Couldn't read the blockchain right now. Try again in a minute." }, { status: 502 });
  }
}
