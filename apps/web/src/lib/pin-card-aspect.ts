/** Deterministic aspect ratios for explore / masonry pin cards. */
const PIN_CARD_ASPECTS = [
  "aspect-[4/5]",
  "aspect-[5/6]",
  "aspect-[7/8]",
  "aspect-[9/10]",
  "aspect-square",
  "aspect-[6/5]",
  "aspect-[5/4]",
  "aspect-[4/3]",
  "aspect-[3/2]",
  "aspect-[7/5]",
  "aspect-[8/7]",
  "aspect-[10/9]",
] as const;

export function getPinCardAspectClass(seed: number): string {
  const index = Math.abs(seed) % PIN_CARD_ASPECTS.length;
  return PIN_CARD_ASPECTS[index];
}

export function getPinCardAspectClassFromId(
  onChainId: string | number | undefined,
  id: string | number,
): string {
  const numeric =
    Number(onChainId ?? id) ||
    String(onChainId ?? id)
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return getPinCardAspectClass(numeric);
}

export { PIN_CARD_ASPECTS };
