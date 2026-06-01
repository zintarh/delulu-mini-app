/**
 * Creates or updates the single ops admin user in Supabase Auth.
 *
 * Usage (from apps/web):
 *   ADMIN_SEED_PASSWORD='your-password' pnpm seed:admin
 *
 * Optional overrides:
 *   ADMIN_SEED_EMAIL  (default: kateberryd@gmail.com)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ADMIN_EMAIL = "kateberryd@gmail.com";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (
    process.env.ADMIN_SEED_EMAIL ?? DEFAULT_ADMIN_EMAIL
  ).trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error(
      "Set ADMIN_SEED_PASSWORD (min 8 chars) when running this script.\n" +
        "Example: ADMIN_SEED_PASSWORD='…' pnpm seed:admin",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: listData, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const existing = listData.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        app_metadata: { role: "admin" },
      },
    );
    if (error) {
      console.error("Failed to update admin user:", error.message);
      process.exit(1);
    }
    console.log(`Updated admin user: ${data.user.email} (${data.user.id})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (error) {
      console.error("Failed to create admin user:", error.message);
      process.exit(1);
    }
    console.log(`Created admin user: ${data.user.email} (${data.user.id})`);
  }

  console.log("\nEnsure apps/web/.env.local includes:");
  console.log(`  ADMIN_OPS_ALLOWED_EMAILS=${email}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_URL=${url}`);
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>");
  console.log("\nThen sign in at /admin/login");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
