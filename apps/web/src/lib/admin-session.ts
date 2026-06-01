import { isAdminUser } from "@/lib/admin-auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  createSupabaseServerClient,
  getSupabaseAuthUser,
} from "@/lib/supabase/server";

export type AdminSessionPayload = {
  role: "ops";
  email: string;
  userId: string;
};

/** @deprecated Use isSupabaseAuthConfigured */
export function isOpsAuthConfigured() {
  return isSupabaseAuthConfigured();
}

export function isAdminAuthConfigured() {
  return isSupabaseAuthConfigured();
}

export async function readAdminSession(): Promise<AdminSessionPayload | null> {
  if (!isSupabaseAuthConfigured()) return null;

  const user = await getSupabaseAuthUser();
  if (!user?.email || !isAdminUser(user)) return null;

  return {
    role: "ops",
    email: user.email,
    userId: user.id,
  };
}

export async function clearAdminSession() {
  if (!isSupabaseAuthConfigured()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
