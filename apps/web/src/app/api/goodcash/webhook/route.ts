import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { firstSight, gcConfig, syncCashOut, verifySignature, webhookSecret, type GcCashOut } from "@/lib/cashout/goodcash-server";

export const dynamic = "force-dynamic";

// POST /api/goodcash/webhook ← GoodCash. Signed with our webhook secret (HMAC
// over the RAW body, within 5 minutes). Each event is handled once; the same
// event may arrive twice and that's fine. We answer fast.
export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();
  const cfg = gcConfig();
  if (!admin || !cfg) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const secret = await webhookSecret(admin);
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("goodcash-signature"), secret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event: { id?: string; type?: string; mode?: string; data?: GcCashOut };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad body" }, { status: 400 }); }
  if (!event.id || !event.type) return NextResponse.json({ error: "Bad body" }, { status: 400 });

  // A test event can never touch live records, and the other way round.
  if (event.mode && event.mode !== cfg.mode) return NextResponse.json({ ok: true, ignored: "mode" });
  if (!event.type.startsWith("cashout.") || event.type === "cashout.test" || !event.data?.id) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (!(await firstSight(admin, event.id))) return NextResponse.json({ ok: true, duplicate: true });
    await syncCashOut(admin, event.data);
  } catch (e) {
    console.error("[goodcash webhook]", e);
    return NextResponse.json({ error: "Try again" }, { status: 500 }); // GoodCash retries
  }
  return NextResponse.json({ ok: true });
}
