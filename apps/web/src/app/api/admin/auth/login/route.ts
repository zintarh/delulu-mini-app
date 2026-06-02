import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[admin/login] Supabase Auth not configured: set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).",
      );
    }
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message =
      error.message === "Invalid login credentials"
        ? "Invalid email or password."
        : error.message;
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (!data.user || !isAdminUser(data.user)) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        error:
          "This account is not authorized for admin access.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    session: { email: data.user.email, userId: data.user.id },
  });
}
