/**
 * Season 2 stake ladders + cashback (finish bonus), applied as new Bingo
 * versions (running cards keep theirs). Cashback: 8% (5–10k), 10% (20–30k),
 * 12% (50–100k), 15% (200–300k) on 7-day Bingos; half that on 3-day ones.
 * Every Bingo becomes finish-once (recurrence one_time; a missed card can retry).
 *   npx tsx --env-file=.env.local scripts/season-tiers.ts [--apply]
 */
import { createClient } from "@supabase/supabase-js";
import { versionSchemaFor, type BingoTier } from "@/lib/bingo/types";

const APPLY = process.argv.includes("--apply");
/** 3-day Bingos: half of these (2k/3k/5k → +80/+120/+200). */
const pct = (stake: number) => (stake >= 200_000 ? 0.15 : stake >= 50_000 ? 0.12 : stake >= 20_000 ? 0.1 : 0.08);
/** 7-day Bingos, juicier from 20 Nov 2026: 10% (10k), 12% (20–30k), 15% (50k+). Running cards keep theirs. */
const pct7 = (stake: number) => (stake >= 50_000 ? 0.15 : stake >= 20_000 ? 0.12 : 0.1);
const LABEL: Record<number, string> = { 2_000: "Light", 3_000: "Easy", 5_000: "Starter", 10_000: "Committed", 20_000: "Pro", 30_000: "Pro+", 50_000: "Gold", 100_000: "Gold+", 200_000: "Diamond", 300_000: "Diamond+" };
const tiers = (days: 3 | 7, stakes: number[]): BingoTier[] =>
  stakes.map((stake) => ({
    key: LABEL[stake].toLowerCase().replace("+", "_plus"),
    label: LABEL[stake],
    stake,
    forfeitPct: 0,
    completionReward: Math.round((stake * (days === 7 ? pct7(stake) : pct(stake) * 0.5)) / 10) * 10,
  }));

const SEVEN_DAY = [10_000, 20_000, 30_000, 50_000, 100_000];

/** `missions` turns a Bingo into that length (only for Bingos nobody is mid-card on). */
const PLAN: Record<string, { days: 3 | 7; stakes: number[]; missions?: string[] }> = {
  // 7-day Bingos: five levels, 10k to 100k — bigger stake, bigger cashback.
  "workout-week": { days: 7, stakes: SEVEN_DAY },
  "reading-week": { days: 7, stakes: SEVEN_DAY },
  "outside-your-bubble": { days: 7, stakes: SEVEN_DAY },
  "early-riser-3": { days: 7, stakes: SEVEN_DAY, missions: ["Your morning sky", "Your morning routine", "Breakfast before 9am", "A morning walk", "Your morning drink", "Your to-do list for today", "Your sunrise selfie"] },
  // 3-day Bingos are the light way in: small stakes only. 10k and up are 7-day.
  "journal-3": { days: 3, stakes: [2_000, 3_000, 5_000] },
  "water-3": { days: 3, stakes: [2_000, 3_000, 5_000] },
  "prayer-streak": { days: 3, stakes: [2_000, 3_000, 5_000] },
};

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  // --only=slug1,slug2 limits the run (so unchanged Bingos don't get a pointless new version).
  const only = process.argv.find((x) => x.startsWith("--only="))?.slice(7).split(",");
  for (const [slug, p] of Object.entries(PLAN)) {
    if (only && !only.includes(slug)) continue;
    const { data: c } = await sb.from("bingo_campaigns").select("id, current_version_id, duration_days").eq("slug", slug).single();
    if (!c) throw new Error(`${slug}: missing`);
    if (c.duration_days !== p.days && !p.missions) throw new Error(`${slug}: wrong length`);
    const { data: cur } = await sb.from("bingo_versions").select("missions").eq("id", c.current_version_id).single();
    const missions = p.missions ? p.missions.map((title) => ({ title, bonus: false })) : cur!.missions;
    const t = tiers(p.days, p.stakes);
    versionSchemaFor(p.days).parse({ missions, tiers: t });
    console.log(`${APPLY ? "update" : "would update"} ${slug}: ${t.map((x) => `${x.label} ${x.stake.toLocaleString()} (+${x.completionReward!.toLocaleString()})`).join(" · ")} · finish-once`);
    if (!APPLY) continue;
    const { data: maxV } = await sb.from("bingo_versions").select("version").eq("campaign_id", c.id).order("version", { ascending: false }).limit(1).single();
    const { data: v, error } = await sb.from("bingo_versions").insert({ campaign_id: c.id, version: maxV!.version + 1, missions, tiers: t, created_by: "season-tiers" }).select("id").single();
    if (error) throw error;
    await sb
      .from("bingo_campaigns")
      .update({ current_version_id: v.id, recurrence: "one_time", duration_days: p.days, ...(p.missions ? { description: `${p.days} mornings of starting your day early.` } : {}), updated_at: new Date().toISOString() })
      .eq("id", c.id);
  }
  if (!APPLY) console.log("Dry run — pass --apply to write.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
