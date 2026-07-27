/** App mark: a bold "D" with a small blue dot subscript. */
export function AppLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Delulu"
      className={className}
    >
      <text
        x="1"
        y="25"
        fontSize="25"
        fontWeight="800"
        fontFamily="var(--font-manrope), sans-serif"
        fill="var(--delulu-charcoal, #1a1a19)"
      >
        D
      </text>
      <circle cx="25.5" cy="25.5" r="3.5" fill="var(--delulu-blue, #2563eb)" />
    </svg>
  );
}
