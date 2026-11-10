/** A few static, rotated confetti pieces for decoration. */
export function ConfettiStatic({
  pieces,
}: {
  pieces: { left: string; top: string; color: string; rotate: number; w?: number; h?: number }[];
}) {
  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-[3px]"
          style={{ left: p.left, top: p.top, width: p.w ?? 12, height: p.h ?? 18, background: p.color, transform: `rotate(${p.rotate}deg)` }}
        />
      ))}
    </>
  );
}
