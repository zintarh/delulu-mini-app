import type { FormattedDelulu } from "@/lib/types";

function isRawIpfsCid(text: string): boolean {
  return (
    text.startsWith("Qm") ||
    (text.length > 40 && /^[a-f0-9]+$/i.test(text))
  );
}

/**
 * Whether a delulu should appear in home/explore feeds.
 * Keeps items while Supabase/IPFS metadata is still loading; only hides raw CIDs.
 */
export function isDeluluFeedReady(d: FormattedDelulu): boolean {
  const text = d.content?.trim();
  if (text) return !isRawIpfsCid(text);
  return Boolean(d.contentHash);
}

export function getDeluluHeadline(d: FormattedDelulu, fallback = "New delulu"): string {
  const text = d.content?.trim();
  if (text && !isRawIpfsCid(text)) return text;
  return fallback;
}
