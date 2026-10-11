import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GameButtonVariant = "yellow" | "ink" | "green" | "blue" | "line" | "ghost-dark";
export type GameButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<GameButtonVariant, string> = {
  yellow: "bg-yellow text-ink shadow-edge-yellow",
  ink: "bg-ink text-white shadow-edge-ink",
  green: "bg-green text-ink shadow-edge-green",
  blue: "bg-blue text-white shadow-edge-blue",
  line: "bg-white text-ink border-2 border-line shadow-edge",
  "ghost-dark": "bg-transparent text-white border-2 border-[#4a4a45] shadow-[0_4px_0_#4a4a45]",
};

const SIZES: Record<GameButtonSize, string> = {
  sm: "h-10 rounded-xl px-3.5 text-[13px]",
  md: "h-[52px] rounded-2xl px-5 text-[15px]",
  lg: "h-[60px] rounded-2xl px-7 text-base",
};

export function gameButtonClass({
  variant = "yellow",
  size = "md",
  full = false,
  className,
}: {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  full?: boolean;
  className?: string;
}) {
  return cn(
    "press-edge inline-flex shrink-0 select-none items-center justify-center gap-2 font-extrabold uppercase tracking-[0.06em] no-underline",
    "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2",
    VARIANTS[variant],
    SIZES[size],
    full && "w-full",
    className,
  );
}

type Common = {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  full?: boolean;
  className?: string;
  children: ReactNode;
};

/** The chunky, pressable button used throughout the redesign. */
export const GameButton = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(
  function GameButton({ variant, size, full, className, children, type = "button", ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={gameButtonClass({ variant, size, full, className })} {...rest}>
        {children}
      </button>
    );
  },
);

/** Same look as GameButton, rendered as a Next.js link. */
export function GameLink({
  href,
  variant,
  size,
  full,
  className,
  children,
  ...rest
}: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={gameButtonClass({ variant, size, full, className })} {...rest}>
      {children}
    </Link>
  );
}
