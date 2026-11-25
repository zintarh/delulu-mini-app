/**
 * The four cards a new player can start with one daily G$ claim (~120 G$).
 * 100 G$ stake, 7 days, one photo a day. Slugs are seeded by scripts/seed-bingo.ts.
 */
export const STARTER_STAKE = 100;

export const STARTER_CARDS = [
  { slug: "start-workout", title: "Workout for 7 days" },
  { slug: "start-reading", title: "Read for 7 days" },
  { slug: "start-hydrate", title: "Stay hydrated" },
  { slug: "start-prayer", title: "Pray for 7 days" },
] as const;

export type StarterSlug = (typeof STARTER_CARDS)[number]["slug"];

export const isStarterSlug = (slug: string | null | undefined) =>
  STARTER_CARDS.some((c) => c.slug === slug);
