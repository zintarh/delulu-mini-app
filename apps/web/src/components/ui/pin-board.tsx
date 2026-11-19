import { cn } from "@/lib/utils";

/**
 * Pinterest-style board: two masonry columns (three on wide screens) of
 * mixed-height cards. Children keep their own height; pinAspect() gives a
 * list of cards the varied rhythm that makes it read as a board.
 */
export function PinBoard({ children, className, twoUp = false }: { children: React.ReactNode; className?: string; /** Always two columns, cards alternating left/right (small sets like Home's 4). */ twoUp?: boolean }) {
  if (twoUp) {
    const items = Array.isArray(children) ? children.flat().filter(Boolean) : [children];
    return (
      <div className={cn("grid grid-cols-2 items-start gap-3 sm:gap-4", className)}>
        {[0, 1].map((col) => (
          <div key={col} className="flex flex-col gap-3 sm:gap-4">
            {items.filter((_, i) => i % 2 === col)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("columns-2 gap-3 sm:gap-4 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid sm:[&>*]:mb-4", className)}>
      {children}
    </div>
  );
}

/**
 * Height rhythm for the i-th card: tall, square-ish, taller… never two identical rows.
 * Phones get taller shapes: a column there is only ~170px wide, and a squarer
 * card would leave the title and stake line covering most of it.
 */
const ASPECTS = [
  "aspect-[3/5] sm:aspect-[3/4]",
  "aspect-[2/3] sm:aspect-[4/5]",
  "aspect-[5/8] sm:aspect-[1/1]",
  "aspect-[4/7] sm:aspect-[2/3]",
  "aspect-[2/3] sm:aspect-[5/6]",
  "aspect-[3/5] sm:aspect-[3/4]",
  "aspect-[5/8] sm:aspect-[4/5]",
  "aspect-[2/3] sm:aspect-[9/10]",
];
export const pinAspect = (i: number) => ASPECTS[i % ASPECTS.length];
