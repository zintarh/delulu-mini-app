import { USDT_ADDRESSES } from "@/lib/constant";

/** On-chain join token: zero address means the contract's default currency (G$). */
export function resolveJoinTokenAddress(
  joinToken?: string | null,
): `0x${string}` {
  const symbol = (joinToken ?? "G$").trim().toLowerCase();
  if (!symbol || symbol === "g$" || symbol === "gdollar" || symbol === "gooddollar") {
    return "0x0000000000000000000000000000000000000000";
  }
  if (symbol === "usdt" || symbol === "tether") {
    return USDT_ADDRESSES.mainnet;
  }
  if (symbol.startsWith("0x") && symbol.length === 42) {
    return symbol as `0x${string}`;
  }
  // Unknown label — default to G$ (contract zero address). Do not silently map to a random ERC-20.
  return "0x0000000000000000000000000000000000000000";
}

export function formatJoinTokenLabel(joinToken?: string | null): string {
  const symbol = (joinToken ?? "G$").trim();
  return symbol || "G$";
}
