import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Read current count (defaults to 0 when missing) and increment.
    const { data: existing, error: selectError } = await supabase
      .from("profiles")
      .select("address, claim_count")
      .eq("address", normalizedAddress)
      .maybeSingle();
    if (selectError) throw selectError;

    const nextCount = (existing?.claim_count ?? 0) + 1;

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          address: normalizedAddress,
          claim_count: nextCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "address" },
      );
    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, claim_count: nextCount });
  } catch (error) {
    console.error("[profile/claim] increment error:", error);
    return NextResponse.json({ error: "Failed to increment claim count" }, { status: 500 });
  }
}

