/**
 * Which of Privy's wallets is the player's account.
 *
 * Privy's `useWallets()` also lists wallets the browser itself injects
 * (Opera, MetaMask, MiniPay…), in no fixed order. Taking `wallets[0]` once
 * signed an old Privy player into an empty browser wallet — a "new account"
 * that asked them to sign up again. Prefer, in order:
 *  1. the Privy embedded wallet (where email sign-ups' money lives),
 *  2. a wallet linked to the Privy user (wallet-login players),
 *  3. anything else.
 */
type PrivyWalletLike = { address: string; walletClientType?: string; linked?: boolean };

const EMBEDDED = new Set(["privy", "privy-v2"]);

export function pickPrivyWallet<W extends PrivyWalletLike>(wallets: readonly W[]): W | undefined {
  return wallets.find((w) => EMBEDDED.has(w.walletClientType ?? "")) ?? wallets.find((w) => w.linked) ?? wallets[0];
}
