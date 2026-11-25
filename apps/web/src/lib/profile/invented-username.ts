/** The name the app used to invent: `player` plus the first 6 hex chars of the address. */
export function inventedUsername(address: string): string {
  return `player${address.slice(2, 8).toLowerCase()}`;
}

export function isInventedUsername(address: string, username: string | null | undefined): boolean {
  if (!address || !username) return false;
  return username.trim().toLowerCase() === inventedUsername(address);
}

/** A profile the person chose on chain. A blank name and a made-up `player…` name do not count. */
export function hasChosenUsername(address: string, username: string | null | undefined): boolean {
  const name = username?.trim() ?? "";
  return name.length > 0 && !isInventedUsername(address, name);
}
