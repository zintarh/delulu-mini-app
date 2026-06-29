import { NextRequest, NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { createHash, randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isPlatformAdmin = isPlatformAdminRole(session.staffRole);
  if (!isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: communityId } = await params;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: community } = await admin
    .from("communities")
    .select("id, name")
    .eq("id", communityId)
    .maybeSingle();

  if (!community) return NextResponse.json({ error: "Community not found" }, { status: 404 });

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await admin.from("staff_invites").insert({
    email,
    community_id: communityId,
    role: "community_admin",
    token_hash: tokenHash,
    expires_at: expiresAt,
    invited_by: session.userId,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const inviteUrl = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/dashboard/accept-invite?token=${token}`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@delulu.app",
      to: email,
      subject: `You've been invited to manage ${community.name} on Delulu`,
      html: `
        <p>Hi,</p>
        <p>You've been invited to become a community admin for <strong>${community.name}</strong> on Delulu.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Accept invite</a></p>
        <p>This link expires in 7 days.</p>
        <p style="color:#6b7280;font-size:12px;">If you didn't expect this, you can safely ignore this email.</p>
      `,
    });
  } catch {
    // Non-fatal — invite row exists
  }

  return NextResponse.json({ ok: true, inviteUrl });
}
