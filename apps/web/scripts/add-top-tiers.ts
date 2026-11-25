/**
 * 25 Nov 2026 — add Gold (20,000) and Diamond (100,000) to every live 7-day
 * Bingo, on the same "10% back" rule (1% a kept day + the rest at the finish).
 * New version per Bingo; running cards keep theirs. Dry run; --apply to write.
 *   npx tsx scripts/add-top-tiers.ts [--apply]
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { versionSchemaFor, type BingoTier } from "../src/lib/bingo/types";
config({ path: process.cwd() + "/.env.local" });

const APPLY = process.argv.includes("--apply");
const tenPct = (key: string, label: string, stake: number): BingoTier => ({
  key,
  label,
  stake,
  forfeitPct: 0,
  rewardPerSquare: Math.round(stake / 100),
  completionReward: Math.round(stake / 10) - Math.round(stake / 100) * 7,
});
const TOP = [tenPct("gold", "Gold", 20_000), tenPct("diamond", "Diamond", 100_000)];

(async () => {
  const a = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: camps } = await a.from("bingo_campaigns").select("id, slug, duration_days, current_version_id").eq("status", "live").eq("duration_days", 7);
  for (const c of camps ?? []) {
    if (c.slug === "first-week" || !c.current_version_id) continue;
    const { data: cur } = await a.from("bingo_versions").select("*").eq("id", c.current_version_id).single();
    const existing = (cur!.tiers as BingoTier[]).filter((t) => !TOP.some((x) => x.key === t.key));
    const tiers = [...existing, ...TOP].sort((x, y) => x.stake - y.stake);
    const parsed = versionSchemaFor(7).safeParse({ missions: cur!.missions, tiers });
    if (!parsed.success) {
      console.log(`✗ ${c.slug}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    const { data: all } = await a.from("bingo_versions").select("version").eq("campaign_id", c.id);
    const next = Math.max(...(all ?? []).map((v) => Number(v.version))) + 1;
    console.log(`${APPLY ? "publish" : "would publish"} ${c.slug} v${next}: ${tiers.map((t) => `${t.label} ${t.stake} (${t.rewardPerSquare}/day + ${t.completionReward})`).join(" · ")}`);
    if (!APPLY) continue;
    const { id: _i, created_at: _c, version: _v, ...rest } = cur as Record<string, unknown>;
    const { data: ver, error } = await a.from("bingo_versions").insert({ ...rest, version: next, tiers, created_by: "add-top-tiers" }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await a.from("bingo_campaigns").update({ current_version_id: ver!.id }).eq("id", c.id);
    if (e2) throw e2;
  }
  if (!APPLY) console.log("Dry run — pass --apply to write.");
})();
