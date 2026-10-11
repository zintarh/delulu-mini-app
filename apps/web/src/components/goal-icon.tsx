import {
  Apple,
  BookOpen,
  Brain,
  Code,
  Droplets,
  Dumbbell,
  Footprints,
  Languages,
  Moon,
  Music,
  PenLine,
  PiggyBank,
  Smartphone,
  Sun,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** First match wins; order specific habits before broad ones. */
const GOAL_ICONS: Array<[RegExp, LucideIcon]> = [
  [/\b(read|book|page|chapter)/i, BookOpen],
  [/\b(journal|writ|blog|essay|words)/i, PenLine],
  [/\b(gym|workout|work out|lift|push-?up|burpee|squat|exercis|fitness|train)/i, Dumbbell],
  [/\b(walk|run|jog|steps|marathon|cycl|bike|hike)/i, Footprints],
  [/\b(water|hydrat|drink)/i, Droplets],
  [/\b(sugar|eat|diet|food|meal|fruit|veg|cook|fast)/i, Apple],
  [/\b(sleep|bed|nap)/i, Moon],
  [/\b(wake|morning|sunrise|early)/i, Sun],
  [/\b(meditat|mindful|pray|breath|yoga|gratitude)/i, Brain],
  [/\b(code|coding|program|ship|build|leetcode|dev)/i, Code],
  [/\b(save|saving|money|budget|invest|spend)/i, PiggyBank],
  [/\b(screen|phone|social media|scroll|tiktok|instagram)/i, Smartphone],
  [/\b(learn|language|spanish|french|duolingo|study)/i, Languages],
  [/\b(music|guitar|piano|sing|practice)/i, Music],
];

/** Soft tile tints from the design palette, picked by seed so a goal keeps its colour. */
const TINT_KEYS = ["yellow", "green", "pink"] as const;
const TINTS: Record<(typeof TINT_KEYS)[number], string> = {
  yellow: "bg-yellow-soft text-[#8a6a00]",
  green: "bg-[#e6f3eb] text-[#157041]",
  pink: "bg-pink-soft text-pink",
};

export function goalIconFor(text: string | null | undefined): LucideIcon {
  const t = text ?? "";
  return GOAL_ICONS.find(([re]) => re.test(t))?.[1] ?? Target;
}

/** Tint name for a goal (matches HabitTile's tints), stable per seed. */
export function goalTintFor(seed: string): (typeof TINT_KEYS)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINT_KEYS[h % TINT_KEYS.length];
}

/**
 * Stand-in for a goal's cover image: a tinted panel with an icon matched to
 * the goal text. Fills its (relatively positioned) parent.
 */
export function GoalIconPanel({
  text,
  seed,
  iconClassName = "h-12 w-12",
  className,
}: {
  text: string | null | undefined;
  seed: string;
  iconClassName?: string;
  className?: string;
}) {
  const Icon = goalIconFor(text);
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center", TINTS[goalTintFor(seed)], className)} aria-hidden>
      <Icon className={iconClassName} strokeWidth={2} />
    </div>
  );
}
