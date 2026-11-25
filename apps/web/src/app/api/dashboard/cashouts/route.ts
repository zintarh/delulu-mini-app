import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { cashOutHealth, connectWebhook, gcConfig, type CashOutRow } from "@/lib/cashout/goodcash-server";

export const dynamic = "force-dynamic";

function webhookUrl(req: NextRequest) {
  const base = (process.env.NEXT_PUBLIC_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
  return `${base}/api/goodcash/webhook`;
}

/**
 * GET /api/dashboard/cashouts → everything players have cashed out (G$ and the
 * naira the bank got), the latest cash outs, and whether GoodCash is wired up.
 * Only rows in the current key's mode: test cash outs never mix with live ones.
 */
export async function GET(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const cfg = gcConfig();
  const health = await cashOutHealth(admin);
  if (!cfg) return NextResponse.json({ configured: false, health, webhookUrl: webhookUrl(req) });

  const [paid, recent] = await Promise.all([
    admin.from("cashouts").select("wallet, amount_g, naira").eq("mode", cfg.mode).eq("status", "paid").limit(50_000),
    admin.from("cashouts").select("*").eq("mode", cfg.mode).neq("status", "awaiting_signature").order("created_at", { ascending: false }).limit(50),
  ]);
  if (paid.error) {
    const hint = /cashouts/.test(paid.error.message) ? " — run docs/migrations/20261124_cashouts.sql" : "";
    return NextResponse.json({ error: `${paid.error.message}${hint}` }, { status: 500 });
  }
  const rows = paid.data ?? [];
  return NextResponse.json({
    configured: true,
    mode: cfg.mode,
    count: rows.length,
    g: rows.reduce((n, r) => n + Number(r.amount_g), 0),
    naira: rows.reduce((n, r) => n + Number(r.naira), 0),
    people: new Set(rows.map((r) => r.wallet)).size,
    recent: ((recent.data ?? []) as CashOutRow[]).map((r) => ({
      id: r.id, wallet: r.wallet, amountG: Number(r.amount_g), naira: Number(r.naira), status: r.status,
      bank: `${r.bank_name} ••${r.account_last4}`, txHash: r.tx_hash, createdAt: r.created_at, paidAt: r.paid_at,
    })),
    health,
    webhookUrl: webhookUrl(req),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

/** POST { action: "connect-webhook" } → register our webhook with GoodCash; the secret never leaves the server. */
export async function POST(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "connect-webhook") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const r = await connectWebhook(admin, webhookUrl(req));
  return NextResponse.json(r.ok ? r : { error: r.error }, { status: r.ok ? 200 : 502 });
}
