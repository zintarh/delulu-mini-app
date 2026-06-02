import { parseAdminAllowlist } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";

/** Look up a Supabase Auth user by email (service role). */
export async function findAuthUserByEmail(email: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;

  return (
    data.users.find((u) => u.email?.trim().toLowerCase() === normalized) ?? null
  );
}

/**
 * Actionable message when signInWithPassword fails with invalid credentials.
 */
export async function getAdminLoginFailureMessage(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const allowlist = parseAdminAllowlist();
  const onAllowlist = allowlist.includes(normalized);
  const authUser = await findAuthUserByEmail(normalized);

  if (!onAllowlist) {
    return `This email is not on the admin allowlist. Add it to ADMIN_OPS_ALLOWED_EMAILS in your environment, then run: ADMIN_SEED_EMAIL="${normalized}" ADMIN_SEED_PASSWORD='…' pnpm seed:admin`;
  }

  if (!authUser) {
    return `No admin password account exists for this email yet. From apps/web run: ADMIN_SEED_EMAIL="${normalized}" ADMIN_SEED_PASSWORD='your-password' pnpm seed:admin — then sign in with that password.`;
  }

  return "Invalid password for this admin account. If you forgot it, re-run seed:admin with a new ADMIN_SEED_PASSWORD to reset it.";
}
