import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const addressRaw = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
    const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!addressRaw.startsWith("0x") || addressRaw.length !== 42) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    if (!EMAIL_RE.test(emailRaw) || emailRaw.endsWith("@wallet.local")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    // Use limit(1) instead of maybeSingle() — maybeSingle() throws PGRST116 when
    // multiple rows match, which surfaces as a 500. limit(1) is always safe.
    const { data: takenRows, error: takenErr } = await supabase
      .from("profiles")
      .select("address")
      .eq("email", emailRaw)
      .limit(1);

    if (takenErr) throw takenErr;

    const taken = takenRows?.[0] ?? null;
    if (taken && String((taken as { address: string }).address).toLowerCase() !== addressRaw) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({
        email: emailRaw,
        updated_at: new Date().toISOString(),
      })
      .eq("address", addressRaw)
      .select("address");

    if (updateErr) {
      // Unique constraint violation — another address claimed this email between
      // our check and the update (race condition).
      if ((updateErr as any).code === "23505") {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      throw updateErr;
    }

    if (!updated?.length) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[profile/email] error:", e);
    return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
  }
}
