import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { cashOutEnabled, gc, getCashOut, syncCashOut, toView, ID_RE, type GcCashOut } from "@/lib/cashout/goodcash-server";

export const dynamic = "force-dynamic";

// GET /api/cashout/:id → the cash out's current status, read from GoodCash with
// our secret key. Also brings our record up to date, so we never depend on the
// webhook alone.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!cashOutEnabled()) return NextResponse.json({ error: "Cash out isn't available yet." }, { status: 404 });
  const { id } = params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await gc<GcCashOut>(`/v1/cashouts/${id}`);
  if (!r.ok) return NextResponse.json({ error: r.error.message, code: r.error.code }, { status: r.error.status });
  const admin = getSupabaseAdmin();
  const row = admin
    ? (await syncCashOut(admin, r.data).catch(() => null)) ?? (await getCashOut(admin, id).catch(() => null))
    : null;
  return NextResponse.json({ cashOut: toView(r.data, row) }, { headers: { "Cache-Control": "private, no-store" } });
}
