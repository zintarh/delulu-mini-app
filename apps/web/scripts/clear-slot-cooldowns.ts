/**
 * One-off: unlock earning spots that a missed or left goal had locked for a
 * cooldown. From 24 Nov 2026 a missed goal frees its spot at once
 * (lib/rewards/rules.ts decideSlotRelease); this clears the locks set before.
 * Defaults to a dry run. Pass --apply to write.
 *
 * Usage (from apps/web):
 *   pnpm tsx scripts/clear-slot-cooldowns.ts          # dry run
 *   pnpm tsx scripts/clear-slot-cooldowns.ts --apply  # write for real
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const apply = process.argv.includes("--apply");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

  const { data, error } = await admin
    .from("reward_goal_slots")
    .select("id, wallet, goal_kind, goal_ref, release_reason, cooldown_until")
    .not("released_at", "is", null)
    .gt("cooldown_until", today);
  if (error) throw error;
  const rows = data ?? [];
  console.log(JSON.stringify(rows));
  console.log(`${rows.length} locked spot(s) across ${new Set(rows.map((r) => r.wallet)).size} player(s)`);
  if (!apply || rows.length === 0) return;
  const { error: upErr } = await admin.from("reward_goal_slots").update({ cooldown_until: null }).in("id", rows.map((r) => r.id));
  if (upErr) throw upErr;
  console.log("cleared");
}

main().catch((e) => { console.error(e); process.exit(1); });
