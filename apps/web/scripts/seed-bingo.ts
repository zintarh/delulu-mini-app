/**
 * Seeds the launch Bingos (idempotent by slug; an existing Bingo is left alone).
 *
 *   Outside Your Bubble — always-on 7-day Bingo (own clock), 1k/2k/3k G$ tiers
 *   Everyday Life       — same format, saved as a draft for a later launch
 *   Delulu Debut — the evergreen 3-day newcomer Bingo (stake the 1,000 G$ gift,
 *     100 G$ a photo, personal clock), live, one card per wallet
 *   Prayer Streak — 3 days of you praying, same terms, replayable
 *   Little Adventures / Good Vibes Only — more 3-day Bingos, saved as drafts
 *
 * 7-day tiers: Starter 1,000 (+500 to finish) · Pro 2,000 (+1,200) · Elite 3,000 (+2,000).
 *
 * Usage (from apps/web):  npx tsx --env-file=.env.local scripts/seed-bingo.ts [--apply]
 */
import { createClient } from "@supabase/supabase-js";
import { lagosMidnight, versionSchemaFor, DAY_MS, type BingoMission, type BingoTier } from "../src/lib/bingo/types";

const APPLY = process.argv.includes("--apply");

// Always-on 7-day Bingos: your own clock from the moment you join; a missed day forfeits the stake.
// Finish to get the stake back plus the tier's finishing reward (and 100 G$ a photo).
const WEEKLY_TIERS: BingoTier[] = [
  // Season 2: 5k minimum; the finish bonus is 30% of the stake.
  { key: "starter", label: "Starter", stake: 5_000, forfeitPct: 0, completionReward: 1_500 },
  { key: "pro", label: "Pro", stake: 10_000, forfeitPct: 0, completionReward: 3_000 },
  { key: "elite", label: "Elite", stake: 20_000, forfeitPct: 0, completionReward: 6_000 },
];
// 3-day Bingos: stake the 1,000 G$ welcome gift, earn 100 G$ a photo, get the stake back on finishing.
const NEWCOMER_TIERS: BingoTier[] = [{ key: "entry", label: "Entry", stake: 1000, forfeitPct: 0, rewardPerSquare: 100 }];

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

// Season 2 Bingos: 7 or 3 days, 5k+ stakes. Finish bonus 30% of stake (7-day), 15% (3-day).
const workoutTiers: BingoTier[] = [{ key: "committed", label: "Committed", stake: 10_000, forfeitPct: 0, completionReward: 3_000 }];
const weekTiers: BingoTier[] = [{ key: "starter", label: "Starter", stake: 5_000, forfeitPct: 0, completionReward: 1_500 }];
const threeDayTiers: BingoTier[] = [{ key: "starter", label: "Starter", stake: 5_000, forfeitPct: 0, completionReward: 750 }];

const SEEDS: Seed[] = [
  {
    slug: "workout-week",
    title: "Workout Week",
    description: "Seven days of moving your body. One photo a day proves it.",
    duration: 7,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 3,
    missions: [
      m("Morning stretch"),
      m("A 20-minute walk or run"),
      m("30 squats"),
      m("Your workout selfie"),
      m("A healthy meal after you train"),
      m("Plank for 60 seconds"),
      m("Your post-workout glow"),
    ],
    tiers: workoutTiers,
  },
  {
    slug: "reading-week",
    title: "Read Every Day",
    description: "Seven days, a few pages a day. Show us what you're reading.",
    duration: 7,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 4,
    missions: [
      m("The book you're reading"),
      m("Your reading spot"),
      m("A page that made you think"),
      m("Read with your favourite drink"),
      m("A line you love from your book"),
      m("How far you've read"),
      m("Finished a chapter selfie"),
    ],
    tiers: weekTiers,
  },
  {
    slug: "journal-3",
    title: "Journal for 3 Days",
    description: "Three days of putting your thoughts on paper.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 6,
    missions: [m("Today's journal page"), m("Something you're grateful for"), m("Your plan for tomorrow")],
    tiers: threeDayTiers,
  },
  {
    slug: "water-3",
    title: "Drink More Water",
    description: "Three days of staying hydrated.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 7,
    missions: [m("Your first glass of water today"), m("Your water bottle on the go"), m("Your last glass of water before bed")],
    tiers: threeDayTiers,
  },
  {
    slug: "early-riser-3",
    title: "Early Riser",
    description: "Three mornings of starting your day early.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 8,
    missions: [m("Your morning sky"), m("Your morning routine"), m("Breakfast before 9am")],
    tiers: threeDayTiers,
  },
  {
    // One-time welcome week for new and referred players (lib/bingo/first-week.ts):
    // 500 G$ a photo + the 250 weekly bonus + 3,000 to finish = 6,750 G$ (~₦1,000, kept under it).
    slug: "first-week",
    title: "Your First Week",
    description: "Show up 7 days in a row — one photo a day — and earn your welcome bonus. New players only, once.",
    duration: 7,
    enrollment: "rolling",
    recurrence: "one_time",
    status: "draft",
    sort: 0,
    missions: [
      m("Share a selfie"),
      m("Show us what you ate today"),
      m("Something you love"),
      m("Capture the sky"),
      m("Show us your outfit"),
      m("Your happy place"),
      m("Something that made you smile"),
    ],
    tiers: [{ key: "entry", label: "First week", stake: 1_000, forfeitPct: 0, rewardPerSquare: 500, completionReward: 3_000 }],
  },
  {
    slug: "outside-your-bubble",
    title: "Outside Your Bubble Bingo",
    description: "Seven days, seven small moments outside your usual. One photo a day fills your card.",
    duration: 7,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 10,
    missions: [
      m("Show us what you ate today"),
      m("Find something beautiful"),
      m("Show us your outfit"),
      m("Try something new"),
      m("Capture the sky"),
      m("Show us your happy place"),
      m("Share something that made you smile"),
    ],
    tiers: WEEKLY_TIERS,
  },
  {
    slug: "everyday-life",
    title: "Everyday Life Bingo",
    description: "The little things that make your week. One photo a day fills your card.",
    duration: 7,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "draft",
    sort: 20,
    missions: [
      m("Your favourite drink"),
      m("Something colourful"),
      m("Your current view"),
      m("Your favourite snack"),
      m("Something you love"),
      m("A picture with a friend"),
      m("Your favourite part of the week"),
    ],
    tiers: WEEKLY_TIERS,
  },
  {
    slug: "delulu-debut",
    title: "Delulu Debut",
    description: "Your debut: three days, three photos. Starts the moment you join.",
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
    slug: "prayer-streak",
    title: "Prayer Streak",
    description: "Three days of prayer — one photo of you praying each day.",
    duration: 3,
    enrollment: "rolling",
    recurrence: "automatic",
    status: "live",
    sort: 2,
    missions: [m("Day 1 · You praying"), m("Day 2 · You praying"), m("Day 3 · You praying")],
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
