/**
 * Seeds the launch Bingos (idempotent by slug; an existing Bingo is left alone).
 *
 *   Outside Your Bubble — 7 days, Nov 18–24 2026 (Lagos), one-time
 *   Everyday Life       — 7 days, Nov 25 – Dec 1 2026, one-time
 *   My First 3 — the evergreen 3-day newcomer Bingo (100 G$, personal clock), live,
 *     one card per wallet (recurrence one_time on a rolling Bingo)
 *   Little Adventures / Good Vibes Only — more 3-day Bingos, saved as drafts
 *
 * Weekly tiers: Starter 1,000 · Pro 10,000 · Elite 20,000 G$, 10% of the
 * stake per missed day (the contract's max; 7 misses = 70%).
 *
 * Usage (from apps/web):  npx tsx --env-file=.env.local scripts/seed-bingo.ts [--apply]
 */
import { createClient } from "@supabase/supabase-js";
import { lagosMidnight, versionSchemaFor, DAY_MS, type BingoMission, type BingoTier } from "../src/lib/bingo/types";

const APPLY = process.argv.includes("--apply");

const WEEKLY_TIERS: BingoTier[] = [
  { key: "starter", label: "Starter", stake: 1_000, forfeitPct: 10 },
  { key: "pro", label: "Pro", stake: 10_000, forfeitPct: 10 },
  { key: "elite", label: "Elite", stake: 20_000, forfeitPct: 10 },
];
// My First 3 pays 50 G$ a photo (weekly Bingos use the global 100): a real first win, less to farm.
const NEWCOMER_TIERS: BingoTier[] = [{ key: "entry", label: "Entry", stake: 100, forfeitPct: 0, rewardPerSquare: 50 }];

const m = (title: string, bonus = false): BingoMission => ({ title, bonus });

type Seed = {
  slug: string;
  title: string;
  description: string;
  duration: 3 | 7;
  enrollment: "fixed" | "rolling";
  recurrence: "one_time" | "automatic" | "manual";
  status: "live" | "draft";
  sort: number;
  missions: BingoMission[];
  tiers: BingoTier[];
  firstCycle?: string; // Lagos date
};

const SEEDS: Seed[] = [
  {
    slug: "outside-your-bubble",
    title: "Outside Your Bubble Bingo",
    description: "Seven days, seven small moments outside your usual. One photo a day fills your card.",
    duration: 7,
    enrollment: "fixed",
    recurrence: "one_time",
    status: "live",
    sort: 10,
    firstCycle: "2026-11-18",
    missions: [
      m("Show us what you ate today"),
      m("Find something beautiful"),
      m("Show us your outfit"),
      m("Try something new"),
      m("Capture the sky"),
      m("Show us your happy place"),
      m("Share something that made you smile"),
      m("Your shoes today", true),
      m("Something green", true),
    ],
    tiers: WEEKLY_TIERS,
  },
  {
    slug: "everyday-life",
    title: "Everyday Life Bingo",
    description: "The little things that make your week. One photo a day fills your card.",
    duration: 7,
    enrollment: "fixed",
    recurrence: "one_time",
    status: "live",
    sort: 20,
    firstCycle: "2026-11-25",
    missions: [
      m("Your favourite drink"),
      m("Something colourful"),
      m("Your current view"),
      m("Your favourite snack"),
      m("Something you love"),
      m("A picture with a friend"),
      m("Your favourite part of the week"),
      m("Where you work or study", true),
      m("Something old you still love", true),
    ],
    tiers: WEEKLY_TIERS,
  },
  {
    slug: "my-first-3",
    title: "My First 3",
    description: "Your first Bingo: three days, three photos. Starts the moment you join.",
    duration: 3,
    enrollment: "rolling",
    // Onboarding card: always open to new players, one card per wallet.
    recurrence: "one_time",
    status: "live",
    sort: 1,
    missions: [m("Share a selfie"), m("Something you love"), m("Something that made you smile")],
    tiers: NEWCOMER_TIERS,
  },
  {
    slug: "little-adventures",
    title: "Little Adventures",
    description: "Three days of small adventures.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "draft",
    sort: 2,
    missions: [m("Somewhere you went"), m("Something new you tried"), m("Something interesting you discovered")],
    tiers: NEWCOMER_TIERS,
  },
  {
    slug: "good-vibes-only",
    title: "Good Vibes Only",
    description: "Three days of good vibes.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "draft",
    sort: 3,
    missions: [m("Your favourite food"), m("Your favourite place"), m("Something that makes you happy")],
    tiers: NEWCOMER_TIERS,
  },
];

async function main() {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  for (const s of SEEDS) {
    versionSchemaFor(s.duration).parse({ missions: s.missions, tiers: s.tiers });
    const { data: existing } = await admin.from("bingo_campaigns").select("id").eq("slug", s.slug).maybeSingle();
    if (existing) {
      console.log(`skip ${s.slug} (exists)`);
      continue;
    }
    const starts = s.firstCycle ? lagosMidnight(s.firstCycle) : null;
    console.log(`${APPLY ? "create" : "would create"} ${s.slug}${starts ? ` — cycle 1 ${starts.toISOString()} → ${new Date(starts.getTime() + s.duration * DAY_MS).toISOString()}` : ""}`);
    if (!APPLY) continue;

    const { data: camp, error } = await admin
      .from("bingo_campaigns")
      .insert({
        slug: s.slug,
        title: s.title,
        description: s.description,
        duration_days: s.duration,
        enrollment: s.enrollment,
        recurrence: s.recurrence,
        status: s.status,
        sort_order: s.sort,
        created_by: "seed",
      })
      .select("id")
      .single();
    if (error) throw error;
    const { data: ver, error: vErr } = await admin
      .from("bingo_versions")
      .insert({ campaign_id: camp.id, version: 1, missions: s.missions, tiers: s.tiers, created_by: "seed" })
      .select("id")
      .single();
    if (vErr) throw vErr;
    await admin.from("bingo_campaigns").update({ current_version_id: ver.id }).eq("id", camp.id);
    if (starts) {
      const { error: cErr } = await admin.from("bingo_cycles").insert({
        campaign_id: camp.id,
        version_id: ver.id,
        cycle_number: 1,
        starts_at: starts.toISOString(),
        ends_at: new Date(starts.getTime() + s.duration * DAY_MS).toISOString(),
      });
      if (cErr) throw cErr;
    }
  }
  if (!APPLY) console.log("Dry run — pass --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
