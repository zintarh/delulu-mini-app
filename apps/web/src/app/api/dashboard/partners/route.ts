import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { CODE_RE, assignPartner } from "@/lib/referral/partners";

export const dynamic = "force-dynamic";

/** GET — every partner link, with its owner's username. */
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const { data, error: dbError } = await admin.from("referral_partners").select("*").order("created_at", { ascending: false });
  if (dbError) {
    const hint = /referral_partners/.test(dbError.message) ? " — run docs/migrations/20261125_referral_partners.sql" : "";
    return NextResponse.json({ error: `${dbError.message}${hint}` }, { status: 500 });
  }
  const owners = (data ?? []).map((p) => p.owner_wallet).filter(Boolean) as string[];
  const { data: profiles } = owners.length ? await admin.from("profiles").select("address, username").in("address", owners) : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [String(p.address).toLowerCase(), p.username as string | null]));
  const counts = await Promise.all(owners.map(async (w) => {
    const { count } = await admin.from("profiles").select("address", { count: "exact", head: true }).eq("referred_by", w);
    return [w, count ?? 0] as const;
  }));
  const brought = new Map(counts);
  return NextResponse.json({
    partners: (data ?? []).map((p) => ({
      code: p.code, name: p.name, minPoints: p.min_points, active: p.active,
      ownerWallet: p.owner_wallet, ownerUsername: p.owner_wallet ? names.get(p.owner_wallet) ?? null : null,
      brought: p.owner_wallet ? brought.get(p.owner_wallet) ?? 0 : 0,
    })),
  });
}

/**
 * POST { action: "save", code, name, minPoints } — create or edit a partner link.
 * POST { action: "assign", code, owner } — point it at a wallet or @username (they must have signed up).
 */
export async function POST(request: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "Codes are 3–20 capital letters or digits, like BIGJAY." }, { status: 400 });

  if (body.action === "save") {
    const name = String(body.name ?? "").trim();
    const minPoints = Math.round(Number(body.minPoints ?? 10000));
    if (!name) return NextResponse.json({ error: "Give the partner a name." }, { status: 400 });
    if (!(minPoints >= 0 && minPoints <= 1_000_000)) return NextResponse.json({ error: "Points target must be 0–1,000,000." }, { status: 400 });
    const { error: e } = await admin.from("referral_partners").upsert({ code, name, min_points: minPoints, active: body.active !== false, updated_at: new Date().toISOString() }, { onConflict: "code" });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign") {
    const owner = String(body.owner ?? "").trim();
    let wallet = /^0x[0-9a-fA-F]{40}$/.test(owner) ? owner.toLowerCase() : null;
    if (!wallet) {
      const { data } = await admin.from("profiles").select("address").ilike("username", owner.replace(/^@/, "")).maybeSingle();
      wallet = data?.address ? String(data.address).toLowerCase() : null;
    }
    if (!wallet) return NextResponse.json({ error: "No account with that wallet or username." }, { status: 404 });
    try {
      await assignPartner(admin, code, wallet);
      return NextResponse.json({ ok: true, wallet });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
