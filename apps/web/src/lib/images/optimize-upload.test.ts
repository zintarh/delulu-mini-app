import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import exifr from "exifr";
import { MAX_SIDE, optimizeUpload } from "./optimize-upload";
import { readCaptureInfo } from "../proof-integrity/capture-date";

/** A noisy photo-like JPEG (noise so it doesn't compress to nothing) with camera EXIF. */
async function cameraJpeg(width: number, height: number, exif = true): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
  let img = sharp(raw, { raw: { width, height, channels: 3 } });
  if (exif) {
    img = img.withExif({
      IFD0: { Make: "Apple", Model: "iPhone 11", Software: "17.1" },
      IFD2: { DateTimeOriginal: "2026:11:24 21:28:46", OffsetTimeOriginal: "+01:00" },
    });
  }
  return img.jpeg({ quality: 95 }).toBuffer();
}

test("a big camera photo is shrunk and keeps only the EXIF the proof checks read", async () => {
  const original = await cameraJpeg(4000, 3000);
  const out = await optimizeUpload(original, "image/jpeg", "JPG");
  assert.equal(out.optimized, true);
  assert.equal(out.contentType, "image/jpeg");
  assert.ok(out.bytes.length < original.length / 2, "much smaller");
  const meta = await sharp(out.bytes).metadata();
  assert.equal(Math.max(meta.width!, meta.height!), MAX_SIDE);

  const [before, after] = await Promise.all([readCaptureInfo(original, 60), readCaptureInfo(out.bytes, 60)]);
  assert.equal(after.takenAt?.toISOString(), before.takenAt?.toISOString());
  assert.deepEqual(after.camera, before.camera);
  const tags = (await exifr.parse(out.bytes, { reviveValues: false })) as Record<string, unknown>;
  assert.equal(tags.Software, undefined, "other tags are dropped");
});

test("a small, clean image is stored exactly as uploaded", async () => {
  const original = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ffcc00" } }).jpeg().toBuffer();
  const out = await optimizeUpload(original, "image/jpeg", "jpg");
  assert.equal(out.optimized, false);
  assert.equal(out.bytes, original);
});

test("transparent images stay transparent (WebP)", async () => {
  // A smooth logo-like graphic on a transparent background (what covers and stickers look like).
  const W = 2500;
  const raw = Buffer.alloc(W * W * 4);
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inside = (x - W / 2) ** 2 + (y - W / 2) ** 2 < (W / 3) ** 2;
      raw[i] = Math.round((x / W) * 255);
      raw[i + 1] = Math.round((y / W) * 255);
      raw[i + 2] = 180;
      raw[i + 3] = inside ? 255 : 0;
    }
  const original = await sharp(raw, { raw: { width: W, height: W, channels: 4 } }).png().toBuffer();
  const out = await optimizeUpload(original, "image/png", "png");
  assert.equal(out.contentType, "image/webp");
  assert.equal((await sharp(out.bytes).metadata()).hasAlpha, true);
});

test("GIFs and unreadable files pass through untouched", async () => {
  const gif = Buffer.from("GIF89a-not-really");
  assert.equal((await optimizeUpload(gif, "image/gif", "gif")).bytes, gif);
  const junk = Buffer.from("definitely not a jpeg");
  const out = await optimizeUpload(junk, "image/jpeg", "jpg");
  assert.equal(out.optimized, false);
  assert.equal(out.bytes, junk);
});
