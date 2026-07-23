export interface SideEffectHabit {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  suggestedDays: number;
  category:
    | "finance"
    | "health"
    | "career"
    | "education"
    | "social"
    | "mindset"
    | "other";
  emoji: string;
}

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export const TEMPLATES = [
  { id: 1, name: "New Job", image: "/templates/t0.png", fontWeight: "700" },
  { id: 2, name: "Software Engineer", image: "/templates/t1.jpg", fontWeight: "700" },
  { id: 3, name: "Traveller", image: "/templates/t2.png", fontWeight: "700" },
  { id: 4, name: "Startup", image: "/templates/t9.jpg", fontWeight: "700" },
  { id: 5, name: "Relationship", image: "/templates/t3.png", fontWeight: "700" },
  { id: 6, name: "Graduate", image: "/templates/t6.jpg", fontWeight: "700" },
  { id: 7, name: "Workout", image: "/templates/t8.jpg", fontWeight: "700" },
] as const;

export type DelusionTemplate = (typeof TEMPLATES)[number];
