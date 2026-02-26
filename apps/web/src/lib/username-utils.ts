import { formatAddress } from "./utils";

/**
 * Format a display name for a user address
 * If username is provided, returns @username, otherwise returns formatted address
 */
export function formatUserDisplayName(
  address: string,
  username?: string | null
): string {
  if (username && username.trim().length > 0) {
    return `@${username.trim()}`;
  }
  return formatAddress(address);
}

/**
 * Get the best available display identifier for a user
 * Returns username if available, otherwise formatted address
 */
export function getUserDisplayIdentifier(
  address: string,
  username?: string | null
): string {
  return formatUserDisplayName(address, username);
}
