const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

/**
 * A right-sized copy of a Supabase Storage photo (Supabase image transformations).
 * Proof photos are uploaded straight from phones (1–2 MB, several megapixels) but
 * drawn in squares a few dozen pixels wide; decoding the originals while scrolling
 * a row of cards is what made it stutter. Other hosts (IPFS) pass through untouched.
 */
export function thumbUrl(src: string, px: number, quality = 65): string {
  try {
    const u = new URL(src);
    if (!u.hostname.endsWith(".supabase.co") || !u.pathname.startsWith(OBJECT_PATH)) return src;
    u.pathname = RENDER_PATH + u.pathname.slice(OBJECT_PATH.length);
    u.searchParams.set("width", String(px));
    u.searchParams.set("height", String(px));
    u.searchParams.set("resize", "cover");
    u.searchParams.set("quality", String(quality));
    return u.toString();
  } catch {
    return src;
  }
}
