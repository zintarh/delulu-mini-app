/**
 * Explore groups campaigns into categories ("Workout", "Reading", …). Campaigns
 * have no category column, so it's inferred from the title + description —
 * the same approach goalIconFor uses for goal icons. First match wins, so
 * specific habits come before broad ones. Anything unmatched lands in "More".
 */
export type CampaignCategory = {
  key: string;
  label: string;
  match: RegExp;
};

export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  { key: "workout", label: "Workout", match: /\b(gym|workout|work out|lift|push-?ups?|burpee|squat|exercis|fitness|train|abs|plank|yoga|pilates)/i },
  { key: "steps", label: "Steps & running", match: /\b(walk|run|jog|steps|marathon|cycl|bike|hike|\d+k\b)/i },
  { key: "reading", label: "Reading", match: /\b(read|book|pages?|chapter|novel)/i },
  { key: "mind", label: "Mind & sleep", match: /\b(meditat|mindful|pray|bible|quran|breath|gratitude|journal|sleep|bed ?time|wake|morning)/i },
  { key: "money", label: "Money", match: /\b(save|saving|money|budget|invest|spend|debt)/i },
  // Before Screen time, so "Post daily on social media" is creating, not cutting back.
  { key: "create", label: "Create & share", match: /\b(tweet|post|content|vlog|podcast|song|music|sing|guitar|piano|draw|paint|art|design|photo)/i },
  { key: "screen", label: "Screen time", match: /\b(screen|phone|social media|scroll|tiktok|instagram|detox)/i },
  { key: "food", label: "Food & health", match: /\b(sugar|eat|diet|food|meal|fruit|veg|cook|fast|water|hydrat|drink|alcohol|smok)/i },
  { key: "learning", label: "Learning", match: /\b(learn|language|study|course|code|coding|program|leetcode|write|writing|blog|skill)/i },
];

export const OTHER_CATEGORY = { key: "more", label: "More campaigns" } as const;

export function campaignCategoryFor(title: string, description?: string | null): { key: string; label: string } {
  // Title decides first: "Read daily (no phone)" is Reading, not Screen time.
  for (const text of [title, `${title} ${description ?? ""}`]) {
    const hit = CAMPAIGN_CATEGORIES.find((c) => c.match.test(text));
    if (hit) return hit;
  }
  return OTHER_CATEGORY;
}
