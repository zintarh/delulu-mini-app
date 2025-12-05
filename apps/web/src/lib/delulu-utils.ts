import { type FormattedDelulu } from "@/hooks/use-delulus";

/**
 * Checks if the given address is the creator of the delulu
 * @param address - The address to check (can be undefined/null)
 * @param delulu - The delulu to check against (can be null)
 * @returns true if the address matches the delulu creator, false otherwise
 */
export function isDeluluCreator(
  address: string | undefined | null,
  delulu: FormattedDelulu | null
): boolean {
  if (!address || !delulu) return false;
  return address.toLowerCase() === delulu.creator.toLowerCase();
}

