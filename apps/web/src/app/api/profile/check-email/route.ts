import { NextRequest, NextResponse } from "next/server";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import { getSupabaseAdmin } from "@/lib/push/supabase";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  // Optional: caller's own wallet address — excluded from the taken check so a
  // user re-visiting /welcome after a partial onboarding isn't blocked by their
  // own profile row.
  const excludeAddress = request.nextUrl.searchParams.get("excludeAddress")?.toLowerCase() ?? null;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  let query = supabase
    .from("profiles")
    .select("address, auth_provider")
    .eq("email", normalizeEmail(email));

  if (excludeAddress) {
    query = query.neq("address", excludeAddress);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    // Column missing or query failed — treat as unknown (route to web3auth)
    console.error("[check-email] supabase error:", error.message);
    return NextResponse.json({ taken: false, auth_provider: null });
  }

  return NextResponse.json({
    taken: !!data,
    auth_provider: (data?.auth_provider as "privy" | "web3auth") ?? null,
  });
}
