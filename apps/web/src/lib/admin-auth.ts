import type { User } from "@supabase/supabase-js";

/** Default ops admin (see `pnpm seed:admin`). Override with ADMIN_OPS_ALLOWED_EMAILS. */
export const DEFAULT_OPS_ADMIN_EMAIL = "kateberryd@gmail.com";

/**
 * Who may access the ops admin console after Supabase sign-in.
 * Only emails in ADMIN_OPS_ALLOWED_EMAILS (defaults to DEFAULT_OPS_ADMIN_EMAIL).
 */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user?.email) return false;

  const allowlist = parseAdminAllowlist();
  return allowlist.includes(user.email.trim().toLowerCase());
}

export function parseAdminAllowlist(): string[] {
  const raw =
    process.env.ADMIN_OPS_ALLOWED_EMAILS ??
    process.env.ADMIN_OPS_EMAIL ??
    DEFAULT_OPS_ADMIN_EMAIL;
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
