// Contract addresses by network
const DELULU_CONTRACT_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
    "0xF43Fe1ec7260b725Da62e3C241f45efB1831AaEd", // TODO: Add mainnet address
  testnet: "0xF43Fe1ec7260b725Da62e3C241f45efB1831AaEd", // sepolia testnet
} as const;

// Determine which address to use based on environment
// In production, use mainnet; locally/development, use testnet
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "production";

export const DELULU_CONTRACT_ADDRESS = isProduction
  ? (DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`)
  : (DELULU_CONTRACT_ADDRESSES.testnet as `0x${string}`);

// Celo cUSD address
export const CUSD_ADDRESSES = {
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as const,
} as const;
