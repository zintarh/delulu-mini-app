import { createHash } from "crypto";
import sharp from "sharp";

export type ImageFingerprint = {
  /** sha256 of the file bytes — catches byte-identical reuse. */
  sha256: string;
  /**
   * 256-bit difference hash as a '0'/'1' string (bit(256) in Postgres), or
   * null when the image couldn't be decoded or is almost flat (a black or
   * blank frame hashes to ~all zeros and would "match" every other one).
   */
  dhash: string | null;
  /** Display size, EXIF rotation applied. null when undecodable. */
  width: number | null;
  height: number | null;
};

const HASH_SIDE = 16;
/** Below this pixel spread the dHash is noise, not content. */
const MIN_STDDEV = 6;

export async function fingerprintImage(bytes: Buffer): Promise<ImageFingerprint> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  try {
    const meta = await sharp(bytes, { failOn: "none" }).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = (rotated ? meta.height : meta.width) ?? null;
    const height = (rotated ? meta.width : meta.height) ?? null;

    const base = sharp(bytes, { failOn: "none" }).rotate().greyscale();
    const stats = await base.clone().resize(32, 32, { fit: "fill" }).stats();
    if ((stats.channels[0]?.stdev ?? 0) < MIN_STDDEV) return { sha256, dhash: null, width, height };

    // Each bit: is this pixel darker than its right-hand neighbour?
    const { data } = await base
      .clone()
      .resize(HASH_SIDE + 1, HASH_SIDE, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let bits = "";
    for (let y = 0; y < HASH_SIDE; y++) {
      for (let x = 0; x < HASH_SIDE; x++) {
        const i = y * (HASH_SIDE + 1) + x;
        bits += data[i] < data[i + 1] ? "1" : "0";
      }
    }
    return { sha256, dhash: bits, width, height };
  } catch (err) {
    // HEIC without libheif, truncated files… the exact hash still works.
    console.warn("[proof-integrity] could not decode image for dhash", err);
    return { sha256, dhash: null, width: null, height: null };
  }
}
