/** Tile tint and tilt per square (the sticker art is in components/bingo/mission-stickers). */
/** Tile tints, cycled across the card so neighbours never match. */
export const SQUARE_TINTS = [
  { bg: "#fdf1c7", edge: "#e5b41c", ink: "#8a6a00" }, // yellow
  { bg: "#e1f5ea", edge: "#b9e5cc", ink: "#157041" }, // green
  { bg: "#fde6ef", edge: "#f6c3d6", ink: "#c23e6e" }, // pink
  { bg: "#eee7fe", edge: "#d5c6fb", ink: "#6d3fd6" }, // purple
  { bg: "#ffebdd", edge: "#f6c8a8", ink: "#c25e12" }, // orange
] as const;

export const squareTint = (index: number) => SQUARE_TINTS[(index * 2 + Math.floor(index / 3)) % SQUARE_TINTS.length];

/** A small, fixed tilt per square so the board feels hand-stuck, not gridded. */
export const squareTilt = (index: number) => [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.5, -1][index % 9];
