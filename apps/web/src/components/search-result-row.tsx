"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import { cn } from "@/lib/utils";
import type { DeluluSearchResult } from "@/lib/search-types";

export function tileGradient(creator: string) {
  const hex = creator.replace("0x", "").toLowerCase();
  const h1 = parseInt(hex.slice(0, 6), 16) % 360;
  const h2 = (h1 + 55) % 360;
  return `linear-gradient(140deg, hsl(${h1},50%,25%) 0%, hsl(${h2},55%,15%) 100%)`;
}

export function SearchResultRow({
  result,
  onSelect,
  compact = false,
  className,
}: {
  result: DeluluSearchResult;
  onSelect: () => void;
  compact?: boolean;
  className?: string;
}) {
  const handle = result.username
    ? `@${result.username}`
    : `${result.creator.slice(0, 6)}…${result.creator.slice(-4)}`;
  const coverImageSrc = normalizeDeluluImageSrc(result.bgImageUrl);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
        className,
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl",
          compact ? "h-10 w-10" : "h-12 w-12",
        )}
        style={{ background: tileGradient(result.creator) }}
      >
        {coverImageSrc ? (
          <Image
            src={coverImageSrc}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 font-semibold leading-snug text-foreground",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          {result.content || "Untitled"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{handle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </button>
  );
}
