/**
 * Pinterest-style collage layout for a Bingo card — two masonry columns of
 * mixed-height tiles. Pure and shared by the in-app card (BingoCollage) and
 * the share image (api/og/bingo), so what people see is what they post.
 *
 * Photos get the big, varied heights (they're the art); squares not done yet
 * are short sticker tiles; a score tile closes the card.
 */
export type CollageTile =
  | { kind: "photo"; index: number; h: number }
  | { kind: "empty"; index: number; h: number }
  | { kind: "missed"; index: number; h: number }
  | { kind: "score"; h: number };

/** Height ÷ width per photo, cycled — the rhythm that makes it look like a pinboard. */
const PHOTO_RATIOS = [1.32, 1.0, 1.18, 0.86, 1.26, 1.05, 1.14, 0.92, 1.22];
const EMPTY_RATIO = 0.62;
const MISSED_RATIO = 0.5;
const SCORE_RATIO = 0.9;

export function collageColumns(
  squares: { index: number; state: "empty" | "confirming" | "filled" | "missed" }[],
  opts: { withScore?: boolean; /** Gap between tiles ÷ column width, so both columns can end level. */ gapRatio?: number } = {},
): [CollageTile[], CollageTile[]] {
  const gapRatio = opts.gapRatio ?? 0.05;
  let photoN = 0;
  const tiles: CollageTile[] = squares.map((s) =>
    s.state === "filled" || s.state === "confirming"
      ? { kind: "photo", index: s.index, h: PHOTO_RATIOS[photoN++ % PHOTO_RATIOS.length] }
      : s.state === "missed"
        ? { kind: "missed", index: s.index, h: MISSED_RATIO }
        : { kind: "empty", index: s.index, h: EMPTY_RATIO },
  );
  // Photos first so they lead the collage; then what's still to come.
  tiles.sort((a, b) => Number(b.kind === "photo") - Number(a.kind === "photo"));
  if (opts.withScore) tiles.push({ kind: "score", h: SCORE_RATIO });

  const cols: [CollageTile[], CollageTile[]] = [[], []];
  const height = [0, 0];
  for (const t of tiles) {
    const c = height[0] <= height[1] ? 0 : 1;
    height[c] += (cols[c].length ? gapRatio : 0) + t.h;
    cols[c].push({ ...t });
  }
  // End both columns level: the shorter column's last tile grows to fill the gap.
  const short = height[0] < height[1] ? 0 : 1;
  const last = cols[short][cols[short].length - 1];
  if (last) last.h += Math.abs(height[0] - height[1]);
  return cols;
}
