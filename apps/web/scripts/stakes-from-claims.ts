/**
 * 25 Nov 2026 — stakes sized to the free daily claim (~120 G$/day), rewards
 * that pay for themselves. Publishes a new version of every live Bingo
 * (cards already running keep the version they started on):
 *
 *  - First Week: stake 100, 20 G$ a photo, finishers split the stakes of
 *    those who missed (potShare, up to their own stake) — no fixed reward.
 *  - 7-day: Starter 1,000 / Pro 2,500 / Elite 5,000 — 1% of the stake per
 *    photo + 3% at the finish = 10% back.
 *  - 3-day: Light 500 / Easy 1,000 / Starter 2,500 — 1% per photo + 7% at
 *    the finish = 10% back.
 *
 * Dry run by default; --apply to write.   npx tsx scripts/stakes-from-claims.ts [--apply]
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { versionSchemaFor, type BingoTier } from "../src/lib/bingo/types";
config({ path: process.cwd() + "/.env.local" });

const APPLY = process.argv.includes("--apply");
const tenPct = (key: string, label: string, stake: number, days: 3 | 7): BingoTier => ({
  key,
  label,
  stake,
  forfeitPct: 0,
  rewardPerSquare: Math.round(stake / 100), // 1% a kept day
  completionReward: Math.round(stake / 10) - Math.round(stake / 100) * days, // the rest of 10%
});
const TIERS = {
  firstWeek: [{ key: "entry", label: "First week", stake: 100, forfeitPct: 0, rewardPerSquare: 20, potShare: true }] as BingoTier[],
  7: [tenPct("starter", "Starter", 1_000, 7), tenPct("pro", "Pro", 2_500, 7), tenPct("elite", "Elite", 5_000, 7)],
  3: [tenPct("light", "Light", 500, 3), tenPct("easy", "Easy", 1_000, 3), tenPct("starter", "Starter", 2_500, 3)],
};

(async () => {
  const a = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: camps } = await a.from("bingo_campaigns").select("id, slug, duration_days, current_version_id, status").in("status", ["live", "paused"]);
  for (const c of camps ?? []) {
    if (!c.current_version_id || c.slug === "delulu-debut") continue;
    const tiers = c.slug === "first-week" ? TIERS.firstWeek : TIERS[c.duration_days as 3 | 7];
    if (!tiers) continue;
    const { data: cur } = await a.from("bingo_versions").select("*").eq("id", c.current_version_id).single();
    const parsed = versionSchemaFor(c.duration_days as 3 | 7).safeParse({ missions: cur!.missions, tiers });
    if (!parsed.success) {
      console.log(`✗ ${c.slug}: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    const { data: all } = await a.from("bingo_versions").select("version").eq("campaign_id", c.id);
    const next = Math.max(...(all ?? []).map((v) => Number(v.version))) + 1;
    console.log(`${APPLY ? "publish" : "would publish"} ${c.slug} v${next}: ${tiers.map((t) => `${t.stake} (${t.rewardPerSquare}/photo${t.potShare ? " + pot" : ` + ${t.completionReward}`})`).join(" · ")}`);
    if (!APPLY) continue;
    const { id: _i, created_at: _c, version: _v, ...rest } = cur as Record<string, unknown>;
    const { data: ver, error } = await a.from("bingo_versions").insert({ ...rest, version: next, tiers, created_by: "stakes-from-claims" }).select("id").single();
    if (error) throw error;
    const { error: e2 } = await a.from("bingo_campaigns").update({ current_version_id: ver!.id }).eq("id", c.id);
    if (e2) throw e2;
  }
  if (!APPLY) console.log("Dry run — pass --apply to write.");
})();
