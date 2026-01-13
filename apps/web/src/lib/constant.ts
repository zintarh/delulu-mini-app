const DELULU_CONTRACT_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
    "0x1D31b787E90348341286E8F409391908F4cd4C02",
  testnet: "0x76e4103983cCe1cF88415209ccc5b1b95Ad2c7a2",
} as const;

// const DELULU_CONTRACT_ADDRESSES = {
//   mainnet:
//     process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
//     "0x84217d67b85Ef028bb32B494B7477Ab8E9b2fEcd",
//   mainnet_v0: "0xE03B2Bb1aA149DedEFfc91398f477bb7Ddd278aF",
//   testnet_v0: "0x14C808cFf20F431Fb8E94099967b4a10eA83D870",
//   testnet: "0x76e4103983cCe1cF88415209ccc5b1b95Ad2c7a2",
// } as const;

const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "production";

export const DELULU_CONTRACT_ADDRESS = isProduction
  ? (DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`)
  : (DELULU_CONTRACT_ADDRESSES.testnet as `0x${string}`);

export const CUSD_ADDRESSES = {
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  alfajores: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1" as const,
} as const;

// Farcaster miniapp base URL for sharing
export const FARCASTER_MINIAPP_BASE_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  "https://farcaster.xyz/miniapps/6TpUBtkLM1a3/delulu";
