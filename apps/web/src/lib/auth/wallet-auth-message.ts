const MESSAGE_WINDOW_MS = 5 * 60 * 1000;

export function buildWalletAuthMessage(address: string): string {
  const window = Math.floor(Date.now() / MESSAGE_WINDOW_MS);
  return `Sign in to Delulu\nAddress: ${address.toLowerCase()}\nWindow: ${window}`;
}

export function isWalletAuthMessageValid(message: string, address: string): boolean {
  const match = message.match(/^Sign in to Delulu\nAddress: (0x[a-f0-9]{40})\nWindow: (\d+)$/i);
  if (!match) return false;
  if (match[1].toLowerCase() !== address.toLowerCase()) return false;
  const window = Number(match[2]);
  const current = Math.floor(Date.now() / MESSAGE_WINDOW_MS);
  return Math.abs(current - window) <= 1;
}
