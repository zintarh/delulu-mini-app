"use client";

import { useEffect, useState } from "react";

export type ImageAccent = { bg: string; fg: string };

/** One sample per image URL for the whole session — cards re-render a lot. */
const cache = new Map<string, ImageAccent | null>();
const pending = new Map<string, Promise<ImageAccent | null>>();

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/**
 * The photo's most characterful colour, as a deep tone a white label reads on:
 * hue buckets weighted by saturation (near-white / near-black / grey pixels
 * skipped), then lightness pinned low. Mostly-grey photos get a dark neutral.
 */
function accentFrom(data: Uint8ClampedArray): ImageAccent {
  const buckets = new Array(12).fill(null).map(() => ({ w: 0, h: 0, s: 0 }));
  let neutralL = 0;
  let neutralN = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
    if (l < 0.08 || l > 0.94) continue;
    if (s < 0.18) {
      neutralL += l;
      neutralN++;
      continue;
    }
    const b = buckets[Math.floor(h / 30) % 12]!;
    const w = s * (1 - Math.abs(l - 0.5));
    b.w += w;
    b.h += h * w;
    b.s += s * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  if (best.w < 0.6) {
    // Basically black-and-white: a dark neutral pill, a touch warm.
    const l = neutralN ? Math.min(0.28, Math.max(0.18, neutralL / neutralN / 2)) : 0.22;
    return { bg: `hsl(40 6% ${Math.round(l * 100)}%)`, fg: "#ffffff" };
  }
  const hue = Math.round(best.h / best.w);
  const sat = Math.round(Math.min(0.7, Math.max(0.35, best.s / best.w)) * 100);
  return { bg: `hsl(${hue} ${sat}% 30%)`, fg: "#ffffff" };
}

function sample(url: string): Promise<ImageAccent | null> {
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const p = new Promise<ImageAccent | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(accentFrom(ctx.getImageData(0, 0, size, size).data));
      } catch {
        // Host without CORS headers: the canvas is tainted, keep the default pill.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }).then((accent) => {
    cache.set(url, accent);
    pending.delete(url);
    return accent;
  });
  pending.set(url, p);
  return p;
}

/** A pill/badge colour picked from an image; null until sampled or if it can't be read. */
export function useImageAccent(url: string | null | undefined): ImageAccent | null {
  const [accent, setAccent] = useState<ImageAccent | null>(() => (url ? (cache.get(url) ?? null) : null));
  useEffect(() => {
    if (!url) {
      setAccent(null);
      return;
    }
    if (cache.has(url)) {
      setAccent(cache.get(url) ?? null);
      return;
    }
    let alive = true;
    void sample(url).then((a) => {
      if (alive) setAccent(a);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  return accent;
}
