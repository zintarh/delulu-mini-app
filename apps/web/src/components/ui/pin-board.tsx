import { cn } from "@/lib/utils";

/**
 * Pinterest-style board: two masonry columns (three on wide screens) of
 * mixed-height cards. Children keep their own height; pinAspect() gives a
 * list of cards the varied rhythm that makes it read as a board.
 */
export function PinBoard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("columns-2 gap-3 sm:gap-4 lg:columns-3 [&>*]:mb-3 [&>*]:break-inside-avoid sm:[&>*]:mb-4", className)}>
      {children}
    </div>
  );
}

/** Height rhythm for the i-th card: tall, square-ish, taller… never two identical rows. */
const ASPECTS = ["aspect-[3/4]", "aspect-[4/5]", "aspect-[1/1]", "aspect-[2/3]", "aspect-[5/6]", "aspect-[3/4]", "aspect-[4/5]", "aspect-[9/10]"];
export const pinAspect = (i: number) => ASPECTS[i % ASPECTS.length];
