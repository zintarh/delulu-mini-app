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
