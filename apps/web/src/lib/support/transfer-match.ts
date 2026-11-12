/**
 * Pure matching of an ERC-20 Transfer event to an expected support transfer.
 * No "@/" imports — unit-tested under `node --test`.
 */

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type RawLog = {
  address: string;
  topics: readonly string[];
  data: string;
  transactionHash?: string | null;
  blockNumber?: bigint | null;
};

export type ExpectedTransfer = {
  token: string;
  from: string;
  to: string;
  amountWei: bigint;
};

export type TransferMatch = { valueWei: bigint; txHash: string | null; blockNumber: bigint | null };

const topicToAddress = (t: string | undefined) => (t ? `0x${t.slice(-40)}`.toLowerCase() : "");

/**
 * Accept a Transfer from `from` to `to` on `token` whose value equals the
 * expected amount, or is within 1% below it (tolerates a token-level transfer
 * fee). Anything else — wrong token, wrong parties, larger or much smaller
 * value — is not a match.
 */
export function matchTransfer(logs: readonly RawLog[], expected: ExpectedTransfer): TransferMatch | null {
  const token = expected.token.toLowerCase();
  const from = expected.from.toLowerCase();
  const to = expected.to.toLowerCase();
  const floor = (expected.amountWei * 99n) / 100n;
  for (const log of logs) {
    if (log.address.toLowerCase() !== token) continue;
    if (log.topics.length < 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if (topicToAddress(log.topics[1]) !== from || topicToAddress(log.topics[2]) !== to) continue;
    let value: bigint;
    try {
      value = BigInt(log.data === "0x" ? 0 : log.data);
    } catch {
      continue;
    }
    if (value <= expected.amountWei && value >= floor && value > 0n) {
      return { valueWei: value, txHash: log.transactionHash ?? null, blockNumber: log.blockNumber ?? null };
    }
  }
  return null;
}
