import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// Required Supabase table (run once in your Supabase SQL editor):
//
// create table if not exists public.profiles (
//   address text primary key,
//   username text,
//   email text not null unique,
//   pfp_url text,
//   referral_code text,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );

/** PATCH — update pfp_url only, works whether or not a profile row exists yet */
export async function PATCH(request: NextRequest) {
  try {
    const { address, pfpUrl } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }
    if (!pfpUrl || typeof pfpUrl !== "string") {
      return NextResponse.json({ error: "pfpUrl is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const normalizedAddress = address.toLowerCase();

    // Try UPDATE first — only touches existing rows, avoids email NOT NULL issue
    const { data: updatedRows, error: updateError } = await supabase
      .from("profiles")
      .update({ pfp_url: pfpUrl, updated_at: new Date().toISOString() })
      .eq("address", normalizedAddress)
      .select("address");

    if (updateError) throw updateError;

    // No existing row — insert a minimal stub so the pfp is stored
    // email is nullable in the stub; the full profile POST will fill it in later
    if ((updatedRows?.length ?? 0) === 0) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          address: normalizedAddress,
          pfp_url: pfpUrl,
          email: `${normalizedAddress}@wallet.local`, // placeholder satisfies NOT NULL
          updated_at: new Date().toISOString(),
        });

      // Ignore duplicate — means a concurrent request already created the row
      if (insertError && insertError.code !== "23505") throw insertError;

      // If duplicate, retry the update
      if (insertError?.code === "23505") {
        const { error: retryError } = await supabase
          .from("profiles")
          .update({ pfp_url: pfpUrl, updated_at: new Date().toISOString() })
          .eq("address", normalizedAddress);
        if (retryError) throw retryError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[profile] patch error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { address, username, email, pfpUrl, referralCode } = await request.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        address: address.toLowerCase(),
        username: username || null,
        email,
        pfp_url: pfpUrl || null,
        referral_code: referralCode || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "address" }
    );

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[profile] save error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
