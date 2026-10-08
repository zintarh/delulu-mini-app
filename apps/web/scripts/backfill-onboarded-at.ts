/**
 * One-off repair for users stuck by the pre-fix onboarding bug: they set a
 * username (and are fully using the app) but never explicitly submitted the
 * old community-step screen, so profiles.onboarded_at was never recorded —
 * which blocked the "Set up your profile" checklist item and, more
 * importantly, the 1000 G$ onboarding-gift grant.
 *
 * Finds every profile with a username but no onboarded_at, and backfills
 * onboarded_at to created_at (when they actually finished the profile step).
 * Defaults to a dry run — prints who would be affected without writing
 * anything. Pass --apply to actually write.
 *
 * Usage (from apps/web):
 *   pnpm tsx scripts/backfill-onboarded-at.ts          # dry run
 *   pnpm tsx scripts/backfill-onboarded-at.ts --apply  # write for real
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apply = process.argv.includes("--apply");

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("address, username, created_at, onboarded_at")
    .not("username", "is", null)
    .is("onboarded_at", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const affected = (rows ?? []).filter((r) => (r.username ?? "").trim().length > 0);

  if (affected.length === 0) {
    console.log("No stuck profiles found — nothing to do.");
    return;
  }

  console.log(`Found ${affected.length} profile(s) with a username but no onboarded_at:\n`);
  for (const r of affected) {
    console.log(`  ${r.address}  @${r.username}  created_at=${r.created_at}`);
  }

  if (!apply) {
    console.log(`\nDry run only — no writes made. Re-run with --apply to backfill onboarded_at.`);
    return;
  }

  console.log(`\nApplying — setting onboarded_at = created_at for ${affected.length} profile(s)...`);
  let ok = 0;
  let failed = 0;
  for (const r of affected) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarded_at: r.created_at, updated_at: new Date().toISOString() })
      .eq("address", r.address);
    if (updateError) {
      console.error(`  FAILED ${r.address}: ${updateError.message}`);
      failed++;
    } else {
      ok++;
    }
  }
  console.log(`\nDone — ${ok} updated, ${failed} failed.`);
  if (ok > 0) {
    console.log(
      "These wallets will now be picked up by the onboarding-gift self-heal check the next time they load the dashboard (grants happen there, not from this script).",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
