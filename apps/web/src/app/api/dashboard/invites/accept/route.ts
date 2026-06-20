import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createSupabaseAdminAuthClient } from "@/lib/supabase/middleware-admin";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim() || null;

  if (!token || !password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const tokenHash = hashToken(token);

  const { data: invite } = await admin
    .from("staff_invites")
    .select("id, email, community_id, role, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  const authClient = createSupabaseAdminAuthClient(request);
  if (!authClient) return NextResponse.json({ error: "Auth unavailable" }, { status: 500 });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  let authUserId: string;

  if (createError) {
    if (createError.message?.includes("already")) {
      const { data: existing } = await admin.auth.admin.listUsers();
      const existingUser = existing?.users.find((u) => u.email === invite.email);
      if (!existingUser) return NextResponse.json({ error: createError.message }, { status: 400 });
      await admin.auth.admin.updateUserById(existingUser.id, { password });
      authUserId = existingUser.id;
    } else {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }
  } else {
    authUserId = created.user.id;
  }

  await admin.from("staff_users").upsert(
    { id: authUserId, email: invite.email, display_name: displayName, global_role: invite.role },
    { onConflict: "id" },
  );

  if (invite.community_id) {
    await admin.from("community_admin_assignments").upsert(
      { community_id: invite.community_id, staff_user_id: authUserId, status: "active" },
      { onConflict: "community_id,staff_user_id" },
    );
  }

  await admin.from("staff_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  const { data: signIn } = await authClient.supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  if (!signIn?.user) {
    return NextResponse.json({ ok: true, redirect: "/signin" });
  }

  const redirectPath = invite.community_id
    ? `/dashboard/communities/${invite.community_id}`
    : "/dashboard";

  const response = NextResponse.json({ ok: true, redirect: redirectPath });
  return authClient.applyCookiesTo(response);
}
