
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

/** Standalone community campaign contract — separate from the personal-goals proxy. */
export const COMMUNITY_MARKET_V1_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_COMMUNITY_MARKET_V1_MAINNET || "",
  sepolia:
    process.env.NEXT_PUBLIC_COMMUNITY_MARKET_V1_SEPOLIA || "",
} as const;

export function getCommunityMarketV1Address(chainId?: number): `0x${string}` {
  const addr =
    chainId === CELO_SEPOLIA_ID
      ? COMMUNITY_MARKET_V1_ADDRESSES.sepolia
      : COMMUNITY_MARKET_V1_ADDRESSES.mainnet;
  if (!addr) throw new Error("CommunityMarketV1 address not configured. Set NEXT_PUBLIC_COMMUNITY_MARKET_V1_MAINNET.");
  return addr as `0x${string}`;
}

/** Admin-granted, user-claimed reward vault — separate from the Delulu proxy and its treasury/stakes. */
export const REWARD_VAULT_ADDRESSES = {
  mainnet: process.env.NEXT_PUBLIC_REWARD_VAULT_MAINNET || "",
  sepolia: process.env.NEXT_PUBLIC_REWARD_VAULT_SEPOLIA || "",
} as const;

export function getRewardVaultAddress(chainId?: number): `0x${string}` {
  const addr =
    chainId === CELO_SEPOLIA_ID ? REWARD_VAULT_ADDRESSES.sepolia : REWARD_VAULT_ADDRESSES.mainnet;
  if (!addr) throw new Error("RewardVault address not configured. Set NEXT_PUBLIC_REWARD_VAULT_MAINNET.");
  return addr as `0x${string}`;
}



export const CUSD_ADDRESSES = {
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
} as const;

export const GOODDOLLAR_ADDRESSES = {
  mainnet: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const,
} as const;

export const USDT_ADDRESSES = {
  mainnet: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const,
} as const;




export const TOKEN_LOGOS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "/cusd-logo.png",
  [GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()]: "/gooddollar-logo.png",
  [USDT_ADDRESSES.mainnet.toLowerCase()]: "/cusd-logo.png",
} as const;

export const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "USDm",
  [GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()]: "G$",
  [USDT_ADDRESSES.mainnet.toLowerCase()]: "USDT",
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

export function isUsdtToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return false;
  return tokenAddress.toLowerCase() === USDT_ADDRESSES.mainnet.toLowerCase();
}

export function isGoodDollarSupported(_chainId?: number): boolean {
  return _chainId === CELO_MAINNET_ID;
}

export function getSupportedTokens(_chainId?: number) {
  return [
    {
      address: GOODDOLLAR_ADDRESSES.mainnet,
      symbol: "G$",
      name: "GoodDollar",
    },
    {
      address: USDT_ADDRESSES.mainnet,
      symbol: "USDT",
      name: "Tether USD",
    },
  ] as const;
}

