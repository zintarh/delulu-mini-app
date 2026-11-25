/**
 * Lower the First Week reward (25 Nov 2026): 300 G$ a photo + 2,300 G$ for
 * finishing = 4,400 G$ (≈ $0.50), down from 500 + 5,750. Publishes a new
 * version; cards already running keep the version they started on.
 * Dry run by default; --apply to write.
 *   npx tsx scripts/first-week-reduce.ts [--apply]
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: process.cwd() + "/.env.local" });

const PER_PHOTO = 300;
const FINISH = 2_300;
const APPLY = process.argv.includes("--apply");

(async () => {
  const a = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: camp } = await a.from("bingo_campaigns").select("id, current_version_id").eq("slug", "first-week").single();
  const { data: cur } = await a.from("bingo_versions").select("*").eq("id", camp!.current_version_id).single();
  const { data: all } = await a.from("bingo_versions").select("version").eq("campaign_id", camp!.id);
  const nextVersion = Math.max(...(all ?? []).map((v) => Number(v.version))) + 1;
  const tiers = (cur!.tiers as Record<string, unknown>[]).map((t) => ({ ...t, rewardPerSquare: PER_PHOTO, completionReward: FINISH }));
  console.log("from", JSON.stringify(cur!.tiers));
  console.log("to  ", JSON.stringify(tiers), "as version", nextVersion);
  const { count } = await a.from("bingo_attempts").select("id", { count: "exact", head: true }).eq("campaign_id", camp!.id).eq("status", "active");
  console.log("cards running now (keep old terms):", count);
  if (!APPLY) return console.log("Dry run — pass --apply to write.");
  const { id: _id, created_at: _c, version: _v, ...rest } = cur as Record<string, unknown>;
  const { data: ver, error } = await a.from("bingo_versions").insert({ ...rest, version: nextVersion, tiers, created_by: "first-week-reduce" }).select("id").single();
  if (error) throw error;
  const { error: e2 } = await a.from("bingo_campaigns").update({ current_version_id: ver!.id }).eq("id", camp!.id);
  if (e2) throw e2;
  console.log("published", ver!.id);
})();
