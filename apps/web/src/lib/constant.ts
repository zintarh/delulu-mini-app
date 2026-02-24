// ─── Chain IDs ──────────────────────────────────────────────────────
// Hardcoded chain IDs
export const CELO_MAINNET_ID = 42220;
export const CELO_SEPOLIA_ID = 11142220;

export const DELULU_CONTRACT_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
    "0xa1b1f8E58169DeC32c6C085F382e12A20b73e754",
  sepolia: "0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8",
} as const;

/**
 * Get the Delulu contract address - always returns mainnet address
 * @param chainId - The chain ID (ignored, always returns mainnet)
 * @returns The mainnet contract address
 */
export function getDeluluContractAddress(chainId?: number): `0x${string}` {
  // Always return mainnet address
  return DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;
}

export const DELULU_CONTRACT_ADDRESS = DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;

export const DELULU_IMPLEMENTATION_ADDRESS =
  "0x1abba2c7d2323ad9bCF1Cac8C6E4ce3301D47A89" as const;

export const DELULU_IMPLEMENTATION_ADDRESS_SEPOLIA =
  "0x9442AB604B595F036B9814A7c12ee19eA549A350" as const;


export const CUSD_ADDRESSES = {
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
} as const;

export const GOODDOLLAR_ADDRESSES = {
  mainnet: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const,
} as const;




export const TOKEN_LOGOS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "/cusd-logo.png",
  [GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()]: "/gooddollar-logo.png",
} as const;



export const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "USDm",
  [GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()]: "G$",
} as const;





export const SUBGRAPH_URLS: Record<number, string> = {
  [CELO_MAINNET_ID]:
    process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
    process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
    "https://api.studio.thegraph.com/query/1741533/delulu-prediction-market-mainnet/version/latest",
  [CELO_SEPOLIA_ID]:
    process.env.NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA ||
    "https://api.studio.thegraph.com/query/1741533/delulu-prediction-market/0.01",
};





export function getSubgraphUrlForChain(chainId?: number): string {
  const mainnetUrl = SUBGRAPH_URLS[CELO_MAINNET_ID];
  return mainnetUrl || process.env.NEXT_PUBLIC_SUBGRAPH_URL || "";
}

export function isGoodDollarToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return false;
  return tokenAddress.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
}

export function isGoodDollarSupported(chainId?: number): boolean {
  return chainId === CELO_MAINNET_ID;
}

export function getSupportedTokens(chainId?: number) {
  return [
    {
      address: CUSD_ADDRESSES.mainnet,
      symbol: "USDm",
      name: "Celo Dollar",
    },
    {
      address: GOODDOLLAR_ADDRESSES.mainnet,
      symbol: "G$",
      name: "GoodDollar",
    },
  ] as const;
}

export const SUPPORTED_TOKENS = [
  { address: CUSD_ADDRESSES.mainnet, symbol: "USDm", name: "Celo Dollar" },
  { address: GOODDOLLAR_ADDRESSES.mainnet, symbol: "G$", name: "GoodDollar" },
] as const;

// ─── Farcaster ───────────────────────────────────────────────────────
export const FARCASTER_KEY_REGISTRY_ADDRESS =
  "0x00000000Fc1237824fb747aBDE0FF18990E59b7e" as const;

export const FARCASTER_MINIAPP_BASE_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  "https://farcaster.xyz/miniapps/6TpUBtkLM1a3/delulu";
