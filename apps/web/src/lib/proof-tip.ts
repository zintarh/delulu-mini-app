/**
 * One line under a rejected photo: what WOULD count for this goal. Matches
 * the AI check (lib/ai/verify-image-proof.ts): any real personal photo counts
 * for inner habits; downloaded or polished photos never count.
 */
const INNER = /pray|prayer|meditat|gratitude|grateful|quiet time|devotion|journal|bible|quran|scripture|no sugar|social media|sleep|wake|mindful/i;
const MOVE = /stretch|exercis|workout|work out|fitness|walk|run|jog|steps|yoga|gym|push.?up|squat|plank|move/i;
const READ = /read|book|page/i;
const WATER = /water|drink|hydrat/i;

export function proofTip(goal: string | null | undefined): string {
  const g = goal ?? "";
  if (INNER.test(g)) return "Any real photo you take today works: a selfie, your hands, your Bible or mat, your room.";
  if (MOVE.test(g)) return "Take a real photo of you doing it right now. Photos from the internet don't count.";
  if (READ.test(g)) return "Take a photo of the real book or page you're on right now.";
  if (WATER.test(g)) return "Take a photo of your own glass or bottle right now.";
  return "Take a new photo now of what you did. Pictures from the internet don't count.";
}
