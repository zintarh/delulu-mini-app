import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fingerprintImage } from "@/lib/proof-integrity/fingerprint";
import { readCaptureDate } from "@/lib/proof-integrity/capture-date";
import { habitKey } from "@/lib/rewards/engine";

/** A photo-like test image: a gradient with a few shapes, seeded so variants differ. */
async function scene(seed: number, size = 800): Promise<Buffer> {
  const shapes = Array.from({ length: 6 }, (_, i) => {
    const x = ((seed * 97 + i * 131) % 600) + 50;
    const y = ((seed * 53 + i * 211) % 600) + 50;
    const r = ((seed + i) % 5) * 20 + 30;
    const c = ((seed * 41 + i * 67) % 200) + 30;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgb(${c},${255 - c},${(c * 3) % 255})"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#223"/><stop offset="1" stop-color="#dd9"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

function distance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

test("same bytes give the same fingerprint", async () => {
  const img = await scene(1);
  const [a, b] = await Promise.all([fingerprintImage(img), fingerprintImage(Buffer.from(img))]);
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.dhash, b.dhash);
  assert.equal(a.dhash?.length, 256);
  assert.equal(a.width, 800);
});

test("a resized, re-compressed copy lands near the original", async () => {
  const img = await scene(2);
  const copy = await sharp(img).resize(420).jpeg({ quality: 55 }).toBuffer();
  const [a, b] = await Promise.all([fingerprintImage(img), fingerprintImage(copy)]);
  assert.notEqual(a.sha256, b.sha256);
  assert.ok(distance(a.dhash!, b.dhash!) <= 20, `distance ${distance(a.dhash!, b.dhash!)}`);
});

test("a different photo is far from it", async () => {
  const [a, b] = await Promise.all([scene(3).then(fingerprintImage), scene(9).then(fingerprintImage)]);
  assert.ok(distance(a.dhash!, b.dhash!) > 20, `distance ${distance(a.dhash!, b.dhash!)}`);
});

test("a flat (black) image gets no perceptual hash", async () => {
  const black = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#000" } }).jpeg().toBuffer();
  const fp = await fingerprintImage(black);
  assert.equal(fp.dhash, null);
  assert.equal(fp.sha256.length, 64);
});

test("undecodable bytes still get an exact hash", async () => {
  const fp = await fingerprintImage(Buffer.from("not an image"));
  assert.equal(fp.dhash, null);
  assert.equal(fp.width, null);
  assert.equal(fp.sha256.length, 64);
});

async function withExif(tags: Record<string, string>): Promise<Buffer> {
  return sharp(await scene(4)).withExif({ IFD2: tags }).jpeg().toBuffer();
}

test("capture date uses the camera's own offset", async () => {
  const img = await withExif({ DateTimeOriginal: "2026:11:12 08:43:06", OffsetTimeOriginal: "+01:00" });
  const d = await readCaptureDate(img, -300);
  assert.equal(d?.toISOString(), "2026-11-12T07:43:06.000Z");
});

test("capture date falls back to the device zone", async () => {
  const img = await withExif({ DateTimeOriginal: "2026:11:12 08:43:06" });
  const d = await readCaptureDate(img, 60);
  assert.equal(d?.toISOString(), "2026-11-12T07:43:06.000Z");
});

test("with no zone at all the newest reading (UTC-12) is assumed", async () => {
  const img = await withExif({ DateTimeOriginal: "2026:11:12 08:43:06" });
  const d = await readCaptureDate(img, null);
  assert.equal(d?.toISOString(), "2026-11-12T20:43:06.000Z");
});

test("no EXIF date means unknown, not old", async () => {
  assert.equal(await readCaptureDate(await scene(5), 60), null);
  assert.equal(await readCaptureDate(Buffer.from("junk"), 60), null);
});

test("habit key ignores case, punctuation and spacing", () => {
  assert.equal(habitKey("Reading for 30 minutes"), habitKey("reading  for 30 minutes!"));
  assert.notEqual(habitKey("Reading for 30 minutes"), habitKey("Reading for 60 minutes"));
  assert.equal(habitKey(null), "");
});
