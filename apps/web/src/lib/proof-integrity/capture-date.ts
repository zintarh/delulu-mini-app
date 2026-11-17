import exifr from "exifr";

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const EXIF_OFFSET = /^([+-])(\d{2}):?(\d{2})$/;
/** Most negative real-world offset (UTC−12). Assumed when nothing says otherwise, so an unknown zone never makes a photo look older than it is. */
const LENIENT_OFFSET_MIN = -12 * 60;

function parseOffset(raw: unknown): number | null {
  const m = typeof raw === "string" ? EXIF_OFFSET.exec(raw.trim()) : null;
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -mins : mins;
}

/**
 * When the photo was taken, from EXIF DateTimeOriginal (or CreateDate).
 *
 * EXIF stores local wall-clock time. The zone comes from OffsetTimeOriginal
 * when the camera wrote it, else the device's zone sent by the app
 * (`tzOffsetMinutes`, minutes east of UTC), else the most lenient zone.
 *
 * null when there is no capture date — screenshots, images saved from chat
 * apps and downloads usually have none. That alone is not a rejection.
 */
export async function readCaptureDate(bytes: Buffer, tzOffsetMinutes?: number | null): Promise<Date | null> {
  return (await readCaptureInfo(bytes, tzOffsetMinutes)).takenAt;
}

export type CaptureInfo = {
  takenAt: Date | null;
  /** "Apple iPhone 13", "samsung SM-A155F"… — set when a camera wrote its maker/model. */
  camera: string | null;
};

/** Capture date plus the camera that took it (EXIF Make/Model). Both null when the file has no EXIF. */
export async function readCaptureInfo(bytes: Buffer, tzOffsetMinutes?: number | null): Promise<CaptureInfo> {
  let tags: Record<string, unknown> | undefined;
  try {
    tags = await exifr.parse(bytes, {
      pick: ["DateTimeOriginal", "CreateDate", "OffsetTimeOriginal", "OffsetTimeDigitized", "OffsetTime", "Make", "Model"],
      reviveValues: false,
    });
  } catch {
    return { takenAt: null, camera: null };
  }
  if (!tags) return { takenAt: null, camera: null };
  const make = typeof tags.Make === "string" ? tags.Make.replace(/\0/g, "").trim() : "";
  const model = typeof tags.Model === "string" ? tags.Model.replace(/\0/g, "").trim() : "";
  const camera = [make, model].filter(Boolean).join(" ").slice(0, 80) || null;
  return { takenAt: parseTakenAt(tags, tzOffsetMinutes), camera };
}

function parseTakenAt(tags: Record<string, unknown>, tzOffsetMinutes?: number | null): Date | null {

  const raw = (tags.DateTimeOriginal ?? tags.CreateDate) as unknown;
  const m = typeof raw === "string" ? EXIF_DATE.exec(raw) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  if (y < 1990) return null; // unset camera clocks write 0000/1970-ish dates

  const offset =
    parseOffset(tags.OffsetTimeOriginal) ??
    parseOffset(tags.OffsetTimeDigitized) ??
    parseOffset(tags.OffsetTime) ??
    (typeof tzOffsetMinutes === "number" && Math.abs(tzOffsetMinutes) <= 14 * 60 ? tzOffsetMinutes : LENIENT_OFFSET_MIN);

  const wallClockAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const date = new Date(wallClockAsUtc - offset * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}
