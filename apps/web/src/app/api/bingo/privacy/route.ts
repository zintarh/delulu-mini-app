import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requireAuthenticatedWallet, walletAuthErrorResponse } from "@/lib/auth/wallet-session";
import { viewerWallet } from "@/lib/bingo/viewer";
import { arePhotosPrivate, photoPrivacyReady, setPhotosPrivate } from "@/lib/bingo/privacy";

export const dynamic = "force-dynamic";

/** GET → { private, ready } for the viewer. POST { private: boolean } switches it (session wallet only). */
export async function GET(request: NextRequest) {
  const wallet = viewerWallet(request);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ private: false, ready: false });
  const ready = await photoPrivacyReady(admin);
  if (!wallet || !ready) return NextResponse.json({ private: false, ready });
  return NextResponse.json({ private: await arePhotosPrivate(admin, wallet), ready });
}

export async function POST(request: NextRequest) {
  let wallet: string;
  try {
    wallet = requireAuthenticatedWallet(request);
  } catch (e) {
    return walletAuthErrorResponse(e);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.private !== "boolean") return NextResponse.json({ error: "Missing setting." }, { status: 400 });
  const res = await setPhotosPrivate(admin, wallet, body.private);
  if (!res.ok) {
    if (res.setupPending) return NextResponse.json({ error: "Private photos are almost ready — try again soon." }, { status: 503 });
    console.error("[bingo/privacy] update failed", res.error);
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ private: body.private });
}
