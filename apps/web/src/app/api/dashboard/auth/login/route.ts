import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-auth";
import { getAdminLoginFailureMessage } from "@/lib/admin-auth-users";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminAuthClient, isStaffUser } from "@/lib/supabase/middleware-admin";

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

  const authClient = createSupabaseAdminAuthClient(request);
  if (!authClient) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const { data, error } = await authClient.supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[admin/login] signInWithPassword:", error.message);
    }

    const isInvalidCredentials =
      error.message === "Invalid login credentials" ||
      error.message.toLowerCase().includes("invalid login");

    const message = isInvalidCredentials
      ? await getAdminLoginFailureMessage(email)
      : error.message;

    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Login failed." }, { status: 401 });
  }

  const isStaff = await isStaffUser(data.user.id);
  if (!isAdminUser(data.user) && !isStaff) {
    await authClient.supabase.auth.signOut();
    return NextResponse.json(
      {
        error: "This account is not authorized for admin access.",
      },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    session: { email: data.user.email, userId: data.user.id },
  });

  return authClient.applyCookiesTo(response);
}
