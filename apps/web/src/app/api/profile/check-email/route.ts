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

  const normalized = normalizeEmail(email);

  // Exclude wallet.local placeholders inserted by the photo-upload stub
  let query = supabase
    .from("profiles")
    .select("address, auth_provider")
    .eq("email", normalized)
    .not("email", "ilike", "%@wallet.local")
    .limit(2); // limit(2) avoids maybeSingle() throwing on duplicate rows

  if (excludeAddress) {
    query = query.neq("address", excludeAddress);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[check-email] supabase error:", error.message);
    // Return a real error so the client blocks the submit rather than silently proceeding
    return NextResponse.json({ error: "Could not verify email" }, { status: 500 });
  }

  const match = (data ?? []).find(
    (row) => !(row as { email?: string }).email?.endsWith("@wallet.local"),
  );

  return NextResponse.json({
    taken: (data ?? []).length > 0,
    auth_provider: (match?.auth_provider as "privy" | "web3auth") ?? null,
  });
}
