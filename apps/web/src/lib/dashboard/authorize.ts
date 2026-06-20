import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import type { AdminSessionPayload } from "@/lib/admin-session";
import type { GlobalRole, StaffSession } from "@/lib/dashboard/authorize-types";

export type { GlobalRole, StaffSession };
export { isPlatformAdminRole, canAccessCommunity } from "@/lib/dashboard/authorize-types";

/** Map admin session payload to StaffSession for access checks. */
export function toStaffSession(session: AdminSessionPayload): StaffSession {
  return {
    staffUserId: session.userId,
    email: session.email,
    displayName: null,
    globalRole: session.staffRole ?? "platform_admin",
    communityIds: session.communityIds,
  };
}

/** Resolve current Supabase Auth session → staff_users row. Returns null if not logged in or not a staff user. */
export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = getSupabaseAdmin();
    if (!admin) return null;

    const { data: staff } = await admin
      .from("staff_users")
      .select("id, email, display_name, global_role")
      .eq("id", user.id)
      .maybeSingle();

    if (!staff) return null;

    const { data: assignments } = await admin
      .from("community_admin_assignments")
      .select("community_id")
      .eq("staff_user_id", staff.id)
      .eq("status", "active");

    return {
      staffUserId: staff.id,
      email: staff.email,
      displayName: staff.display_name ?? null,
      globalRole: staff.global_role as GlobalRole,
      communityIds: (assignments ?? []).map((a: { community_id: string }) => a.community_id),
    };
  } catch {
    return null;
  }
}

/** Throws a Response (403) if the caller is not a platform_admin. */
export async function requirePlatformAdmin(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new Response("Unauthorized", { status: 401 });
  if (session.globalRole !== "platform_admin") throw new Response("Forbidden", { status: 403 });
  return session;
}

/** Throws a Response (403) if the caller is not a platform_admin AND not assigned to communityId. */
export async function requireCommunityAccess(communityId: string): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) throw new Response("Unauthorized", { status: 401 });
  if (
    session.globalRole !== "platform_admin" &&
    !session.communityIds.includes(communityId)
  ) {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}
