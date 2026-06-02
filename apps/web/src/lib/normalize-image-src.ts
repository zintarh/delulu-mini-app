/**
 * Normalizes delulu background image URLs for next/image and static /public assets.
 * Same-origin template URLs (including http://localhost:3000/templates/...) become
 * root-relative paths so they do not require images.remotePatterns entries.
 */
export function normalizeDeluluImageSrc(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/templates/")) {
      return parsed.pathname;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}
