import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

/** POST — mark a wallet address as onboarded */
export async function POST(request: NextRequest) {
  try {
    const { address, auth_provider = "privy" } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const normalizedAddress = address.toLowerCase();

    const nowIso = new Date().toISOString();

    // Update existing profile first to avoid NOT NULL email constraint on insert paths.
    const { data: updatedRows, error: updateError } = await supabase
      .from("profiles")
      .update({
        onboarded_at: nowIso,
        updated_at: nowIso,
        auth_provider,
      })
      .eq("address", normalizedAddress)
      .select("address");

    if (updateError) throw updateError;

    // If row doesn't exist yet, insert a minimal profile with placeholder email.
    if ((updatedRows?.length ?? 0) === 0) {
      const { error: insertError } = await supabase.from("profiles").insert({
        address: normalizedAddress,
        email: `${normalizedAddress}@wallet.local`,
        onboarded_at: nowIso,
        updated_at: nowIso,
        auth_provider,
      });

      // Ignore duplicate conflict from race conditions.
      if (insertError && insertError.code !== "23505") throw insertError;

      if (insertError?.code === "23505") {
        const { error: retryError } = await supabase
          .from("profiles")
          .update({
            onboarded_at: nowIso,
            updated_at: nowIso,
            auth_provider,
          })
          .eq("address", normalizedAddress);
        if (retryError) throw retryError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[onboarding] error:", error);
    return NextResponse.json({ error: "Failed to mark onboarding" }, { status: 500 });
  }
}

/** GET — check if a wallet address has completed onboarding */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.toLowerCase();

    if (!address) {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // If DB isn't configured, don't block onboarding
      return NextResponse.json({ onboarded: false });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("address", address)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ onboarded: !!data?.onboarded_at });
  } catch (error) {
    console.error("[onboarding] check error:", error);
    // On error, don't block — assume not onboarded
    return NextResponse.json({ onboarded: false });
  }
}
