import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

function getRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CELO_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://forno.celo.org"
  );
}

function getFaucetAccount() {
  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) throw new Error("CELO_FAUCET_PRIVATE_KEY is not configured");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(key);
}

/** Returns the faucet wallet's current CELO balance in CELO (not wei). */
export async function getFaucetBalance(): Promise<number> {
  const raw = process.env.CELO_FAUCET_PRIVATE_KEY;
  if (!raw) {
    console.error("[send-celo] CELO_FAUCET_PRIVATE_KEY is not set");
    throw new Error("CELO_FAUCET_PRIVATE_KEY is not configured");
  }
  const account = getFaucetAccount();
  const rpc = getRpcUrl();
  console.log("[send-celo] checking balance for faucet address:", account.address, "via RPC:", rpc);
  const client = createPublicClient({ chain: celo, transport: http(rpc) });
  const wei = await client.getBalance({ address: account.address });
  const balance = parseFloat(formatEther(wei));
  console.log("[send-celo] faucet balance:", balance, "CELO");
  return balance;
}

/** Returns the faucet wallet's address (for display/logging). */
export function getFaucetAddress(): `0x${string}` {
  return getFaucetAccount().address;
}

/** Sends CELO from the faucet wallet. Returns the transaction hash. */
export async function sendCelo(
  to: `0x${string}`,
  amountCelo: string,
): Promise<`0x${string}`> {
  const account = getFaucetAccount();
  const rpc = getRpcUrl();
  console.log("[send-celo] sending", amountCelo, "CELO from", account.address, "to", to, "via RPC:", rpc);
  const client = createWalletClient({
    account,
    chain: celo,
    transport: http(rpc),
  });
  const hash = await client.sendTransaction({ to, value: parseEther(amountCelo) });
  console.log("[send-celo] tx submitted:", hash);
  return hash;
}

/** Returns the transaction count (nonce) for any address — used to detect new vs active wallets. */
export async function getWalletNonce(address: `0x${string}`): Promise<number> {
  const client = createPublicClient({ chain: celo, transport: http(getRpcUrl()) });
  const count = await client.getTransactionCount({ address });
  return count;
}
