"use client";

import { useState } from "react";
import { thumbUrl } from "@/lib/images/supabase-thumb";

/**
 * A proof photo inside a card: a thumbnail `px` wide (pass ~2.5× the CSS size for
 * sharp phone screens), decoded off the main thread, lazy. If the resized copy
 * ever fails, it falls back to the original so a photo never goes missing.
 */
export function ProofThumb({ src, px, alt = "", className }: { src: string; px: number; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? src : thumbUrl(src, px)}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={failed ? undefined : () => setFailed(true)}
      className={className}
    />
  );
}
