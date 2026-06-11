const MESSAGES = [
  "Small steps today beat perfect plans tomorrow.",
  "You're building something real — keep showing up.",
  "Progress isn't always loud. Showing up counts.",
  "One milestone at a time. You've got this.",
  "Delulu is the solulu — stay delusional.",
  "Proof beats perfection. Snap it and ship it.",
  "Someone believes in this goal. That someone is you.",
  "Today's effort is tomorrow's receipt.",
  "You're closer than yesterday. Keep going.",
  "Make today count — your future self is watching.",
] as const;

export function getDailyEncouragement(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return MESSAGES[dayOfYear % MESSAGES.length];
}
