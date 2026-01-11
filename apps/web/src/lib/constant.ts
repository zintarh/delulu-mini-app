// Contract addresses by network
const DELULU_CONTRACT_ADDRESSES = {
  mainnet: process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET || "", 
  mainnet_v0: "0xE03B2Bb1aA149DedEFfc91398f477bb7Ddd278aF", 
  testnet_v0: "0x14C808cFf20F431Fb8E94099967b4a10eA83D870", 
  testnet: "0xcfDd3EbEad6175663dC59A7acae24BB70b604822",
} as const;

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
