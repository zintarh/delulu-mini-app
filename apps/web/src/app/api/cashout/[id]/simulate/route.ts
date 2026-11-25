import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { cashOutEnabled, gc, gcConfig, syncCashOut, toView, ID_RE, type GcCashOut } from "@/lib/cashout/goodcash-server";

export const dynamic = "force-dynamic";

// POST /api/cashout/:id/simulate → TEST KEYS ONLY. Stands in for the wallet
// sending the transaction: GoodCash moves it to processing, then to its
// outcome, with no money or chain involved.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!cashOutEnabled() || gcConfig()?.mode !== "test") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id } = params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await gc<GcCashOut>(`/v1/test/cashouts/${id}/simulate`, { method: "POST" });
  if (!r.ok) return NextResponse.json({ error: r.error.message, code: r.error.code }, { status: r.error.status });
  const admin = getSupabaseAdmin();
  const row = admin ? await syncCashOut(admin, r.data).catch(() => null) : null;
  return NextResponse.json({ cashOut: toView(r.data, row) });
}
