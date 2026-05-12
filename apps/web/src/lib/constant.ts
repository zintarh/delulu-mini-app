
export const CELO_MAINNET_ID = 42220;
export const CELO_SEPOLIA_ID = 11142220;

/** Delulu proxy lives here in production — pin RPC reads/writes so wallet chain (e.g. Fuse in wagmi config) cannot point calls at the wrong network. */
export const DELULU_CHAIN_ID = CELO_MAINNET_ID;

export const DELULU_CONTRACT_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
    "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  sepolia: "0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8",
} as const;

/**
 * Proxy address for reads/writes. Must match the connected wallet network or RPC returns wrong/empty markets.
 */
export function getDeluluContractAddress(chainId?: number): `0x${string}` {
  if (chainId === CELO_SEPOLIA_ID) {
    return DELULU_CONTRACT_ADDRESSES.sepolia as `0x${string}`;
  }
  return DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;
}

export const DELULU_CONTRACT_ADDRESS = DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;

export const DELULU_IMPLEMENTATION_ADDRESS =
  "0x181070E2D677637d9EDAF2b1576B9D798c028C6b" as const;



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
    "",
  [CELO_SEPOLIA_ID]:
    process.env.NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA ||
    "",
};





export function getSubgraphUrlForChain(_chainId?: number): string {
  const mainnetUrl = SUBGRAPH_URLS[CELO_MAINNET_ID];
  return mainnetUrl || process.env.NEXT_PUBLIC_SUBGRAPH_URL || "";
}

export function isGoodDollarToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return false;
  return tokenAddress.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
}

export function isGoodDollarSupported(_chainId?: number): boolean {
  return _chainId === CELO_MAINNET_ID;
}

export function getSupportedTokens(_chainId?: number) {
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
