import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

/** On-chain join token: zero address means the contract's default currency (G$). */
export function resolveJoinTokenAddress(
  joinToken?: string | null,
): `0x${string}` {
  const symbol = (joinToken ?? "G$").trim().toLowerCase();
  if (!symbol || symbol === "g$" || symbol === "gdollar" || symbol === "gooddollar") {
    return "0x0000000000000000000000000000000000000000";
  }
  if (symbol.startsWith("0x") && symbol.length === 42) {
    return symbol as `0x${string}`;
  }
  return GOODDOLLAR_ADDRESSES.mainnet;
}

export function formatJoinTokenLabel(joinToken?: string | null): string {
  const symbol = (joinToken ?? "G$").trim();
  return symbol || "G$";
}
