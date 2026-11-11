import { NextResponse } from "next/server";
import { readAdminSession, type AdminSessionPayload } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";

/**
 * Same check the other platform-admin routes inline (rewards/grants,
 * referrals/rewarder-status), returning the session so callers can record
 * who acted. Community admins get 403.
 */
export async function requirePlatformAdmin(): Promise<
  { session: AdminSessionPayload; error: null } | { session: null; error: NextResponse }
> {
  const session = await readAdminSession();
  if (!session) return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isPlatformAdminRole(session.staffRole)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null };
}
