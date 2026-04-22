import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("address, auth_provider")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }

  return NextResponse.json({
    taken: !!data,
    auth_provider: (data?.auth_provider as "privy" | "web3auth") ?? null,
  });
}
