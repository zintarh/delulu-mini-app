import { isAdminUser } from "@/lib/admin-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseAuthUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import type { GlobalRole } from "@/lib/dashboard/authorize-types";

export type AdminSessionPayload = {
  role: "ops";
  email: string;
  userId: string;
  /** Staff role from staff_users table, if present. */
  staffRole: GlobalRole | null;
  /** Community IDs assigned to this staff member (empty for platform_admin). */
  communityIds: string[];
};

export function isAdminAuthConfigured() {
  return isSupabaseAuthConfigured();
}

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  if (!isSupabaseAuthConfigured()) return null;

  const user = await getSupabaseAuthUser();
  if (!user?.email) return null;

  // Check staff_users first (covers both platform_admin and community_admin)
  const supabaseAdmin = getSupabaseAdmin();
  if (supabaseAdmin) {
    const { data: staff } = await supabaseAdmin
      .from("staff_users")
      .select("id, global_role")
      .eq("id", user.id)
      .maybeSingle();

    if (staff) {
      const { data: assignments } = await supabaseAdmin
        .from("community_admin_assignments")
        .select("community_id")
        .eq("staff_user_id", staff.id)
        .eq("status", "active");

      return {
        role: "ops",
        email: user.email,
        userId: user.id,
        staffRole: staff.global_role as GlobalRole,
        communityIds: (assignments ?? []).map((a: { community_id: string }) => a.community_id),
      };
    }
  }

  // Fall back to legacy email allowlist check
  if (!isAdminUser(user)) return null;

  return {
    role: "ops",
    email: user.email,
    userId: user.id,
    staffRole: null,
    communityIds: [],
  };
}
