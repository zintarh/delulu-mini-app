import exifr from "exifr";
import sharp from "sharp";

/**
 * Longest side kept for stored photos: sharp on any phone, ~1/8 of a camera original.
 * 2048 (not smaller) keeps the near-duplicate dHash of a shrunk photo within ~12 bits of
 * its original (limit 20 in check.ts), so a photo reused across old and new uploads is still caught.
 */
export const MAX_SIDE = 2048;
/** Already-small files with nothing to strip are stored as they came (no needless re-encode). */
const KEEP_AS_IS_BYTES = 400 * 1024;

/** The only EXIF the proof-integrity checks read (capture-date.ts). Everything else, GPS included, is dropped. */
const KEEP_TAGS = ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime", "Make", "Model"] as const;

export type OptimizedImage = {
  bytes: Buffer;
  contentType: string;
  ext: string;
  /** False when the original was kept (GIF, undecodable, or already small and clean). */
  optimized: boolean;
};

const exifString = (v: unknown): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return null; // exifr revived it; we read raw strings below
  const s = String(v).trim();
  return s ? s : null;
};

/** The kept EXIF tags as raw strings, plus whether the file carries a GPS position. */
async function readKeptExif(bytes: Buffer): Promise<{ tags: Partial<Record<(typeof KEEP_TAGS)[number], string>>; hasGps: boolean }> {
  const parsed = (await exifr
    .parse(bytes, { pick: [...KEEP_TAGS, "GPSLatitude", "GPSLongitude"], reviveValues: false, gps: true })
    .catch(() => null)) as Record<string, unknown> | null;
  if (!parsed) return { tags: {}, hasGps: false };
  const tags: Partial<Record<(typeof KEEP_TAGS)[number], string>> = {};
  for (const k of KEEP_TAGS) {
    const v = exifString(parsed[k]);
    if (v) tags[k] = v;
  }
  return { tags, hasGps: parsed.GPSLatitude != null || parsed.GPSLongitude != null || parsed.latitude != null };
}

/**
 * Shrinks an uploaded image before it is stored publicly. Proof photos arrive
 * straight from phone cameras (1–2 MB, 12+ MP) and were stored and served at full
 * size, with all their metadata — GPS location included — readable by anyone with
 * the link. This keeps the picture (EXIF rotation applied, longest side ≤ MAX_SIDE)
 * and only the EXIF the proof checks read: capture time, its zone, and the camera.
 *
 * Never throws: anything it can't handle is stored as uploaded, so an upload never
 * fails because of this step.
 */
export async function optimizeUpload(original: Buffer, contentType: string, ext: string): Promise<OptimizedImage> {
  const asIs: OptimizedImage = { bytes: original, contentType, ext, optimized: false };
  // Animated GIFs and vector/unknown types are left alone.
  if (!/^image\/(jpe?g|png|webp|heic|heif|avif|tiff)$/i.test(contentType)) return asIs;
  try {
    const meta = await sharp(original, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return asIs;
    const { tags, hasGps } = await readKeptExif(original);
    const rotated = (meta.orientation ?? 1) > 1;
    const longest = Math.max(meta.width, meta.height);
    if (!hasGps && !rotated && longest <= MAX_SIDE && original.length <= KEEP_AS_IS_BYTES && meta.format !== "heif") return asIs;

    const exif: Record<string, Record<string, string>> = {};
    if (tags.Make || tags.Model) exif.IFD0 = { ...(tags.Make ? { Make: tags.Make } : {}), ...(tags.Model ? { Model: tags.Model } : {}) };
    const exifIfd: Record<string, string> = {};
    for (const k of ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime"] as const) {
      // libvips names the Exif sub-IFD's CreateDate "DateTimeDigitized".
      if (tags[k]) exifIfd[k === "CreateDate" ? "DateTimeDigitized" : k] = tags[k]!;
    }
    if (Object.keys(exifIfd).length) exif.IFD2 = exifIfd;

    // Transparency (logos, stickers, covers) survives as WebP; photos become JPEG.
    const keepAlpha = !!meta.hasAlpha;
    let img = sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    if (Object.keys(exif).length) img = img.withExif(exif);
    const out = keepAlpha
      ? await img.webp({ quality: 85 }).toBuffer()
      : await img.jpeg({ quality: 80, mozjpeg: true }).toBuffer();

    // Re-encoding a small clean file can grow it; keep the original then — unless it had GPS to strip.
    if (out.length >= original.length && !hasGps && !rotated) return asIs;
    return keepAlpha
      ? { bytes: out, contentType: "image/webp", ext: "webp", optimized: true }
      : { bytes: out, contentType: "image/jpeg", ext: "jpg", optimized: true };
  } catch (err) {
    console.warn("[optimize-upload] stored as uploaded:", err instanceof Error ? err.message : err);
    return asIs;
  }
}
