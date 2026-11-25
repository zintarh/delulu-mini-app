import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { buildPartnerReport, loadPartner, type PartnerListFilter } from "@/lib/referral/partners";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/partner/:code — the partner's friends and how far each got.
 * Only for the partner themselves (signed in with the code's wallet) or a platform admin.
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
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: wallet ? "This page belongs to someone else." : "Sign in to see your referrals." }, { status: wallet ? 403 : 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.staydelulu.xyz";
  const page = Number(request.nextUrl.searchParams.get("page"));
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const filterRaw = request.nextUrl.searchParams.get("filter") ?? "all";
  const filter: PartnerListFilter = filterRaw === "claim" || filterRaw === "stake" || filterRaw === "join" ? filterRaw : "all";
  try {
    const report = await buildPartnerReport(admin, partner, appUrl, { page: Number.isFinite(page) ? page : 1, q, filter });
    return NextResponse.json({ ...report, viewer: isOwner ? "owner" : "admin" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[partner] report failed", err);
    return NextResponse.json({ error: "Couldn't load this page. Try again in a moment." }, { status: 500 });
  }
}
