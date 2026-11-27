const MAX_DIMENSION = 1024;
const TARGET_MAX_BYTES = 800 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_TYPES.includes(type);
}

export function formatImageUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/smaller than|too large|5\s*mb|2\s*mb/i.test(msg)) {
    return "Photo is too large. Try a screenshot or smaller image.";
  }
  if (/image|type|format/i.test(msg)) {
    return "Please choose a JPG, PNG, or WebP image.";
  }
  if (/network|fetch|failed to fetch/i.test(msg)) {
    return "Upload failed — check your connection and try again.";
  }
  return msg || "Upload failed. Please try again.";
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image file."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to compress image."));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Resize and compress photos before upload (phone cameras often exceed limits). */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }

  if (file.size <= TARGET_MAX_BYTES && file.type === "image/jpeg") {
    return file;
  }

  const img = await loadImage(file);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to process image.");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > TARGET_MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("Photo is too large. Try a screenshot or smaller image.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "profile";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

/** Vercel rejects request bodies over 4.5 MB before our route runs; stay under it. */
const PROOF_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const PROOF_MAX_DIMENSION = 2048;

/**
 * Proof photos: sent as they are when they fit (keeps the EXIF capture date the
 * proof check reads), and only shrunk to ≤2048px JPEG when the phone's full-size
 * photo would be too big to upload at all.
 */
export async function shrinkProofForUpload(file: File): Promise<File> {
  if (file.size <= PROOF_UPLOAD_MAX_BYTES) return file;
  const img = await loadImage(file);
  const scale = Math.min(1, PROOF_MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read this photo. Try another one.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.88;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > PROOF_UPLOAD_MAX_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "proof"}.jpg`, { type: "image/jpeg" });
}
