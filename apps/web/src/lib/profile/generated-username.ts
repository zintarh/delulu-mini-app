/** The name signup used to invent so people could skip the profile form. */
export function generatedUsername(address: string): string {
  return `player${address.slice(2, 8).toLowerCase()}`;
}

export function isGeneratedUsername(address: string, username: string | null | undefined): boolean {
  const name = username?.trim().toLowerCase();
  return !!name && name === generatedUsername(address);
}
