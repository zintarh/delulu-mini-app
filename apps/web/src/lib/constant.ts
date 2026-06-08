
export const CELO_MAINNET_ID = 42220;
export const CELO_SEPOLIA_ID = 11142220;

export const DELULU_CHAIN_ID = CELO_MAINNET_ID;

export const DELULU_CONTRACT_ADDRESSES = {
  mainnet:
    process.env.NEXT_PUBLIC_DELULU_CONTRACT_MAINNET ||
    "0x7692199630F3865160fB1Fa496961251fA15aFEa",
  sepolia: "0xba562cf9aC1Cb180EcE06dd9C86800B3F1EE51B8",
} as const;

export function getDeluluContractAddress(chainId?: number): `0x${string}` {
  if (chainId === CELO_SEPOLIA_ID) {
    return DELULU_CONTRACT_ADDRESSES.sepolia as `0x${string}`;
  }
  return DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;
}

export const DELULU_CONTRACT_ADDRESS = DELULU_CONTRACT_ADDRESSES.mainnet as `0x${string}`;

export const DELULU_IMPLEMENTATION_ADDRESS =
  "0xb5c8E8608DfbDd8A5403B9DC10AA48d4b4D0077D" as const;

export const CUSD_ADDRESSES = {
  mainnet: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
} as const;

export const USDT_ADDRESSES = {
  mainnet: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const,
} as const;

export const TOKEN_LOGOS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "/cusd-logo.png",
  [USDT_ADDRESSES.mainnet.toLowerCase()]: "/cusd-logo.png",
} as const;

export const KNOWN_TOKEN_SYMBOLS: Record<string, string> = {
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: "USDm",
  [USDT_ADDRESSES.mainnet.toLowerCase()]: "USDT",
} as const;

export const SUBGRAPH_URLS: Record<number, string> = {
  [CELO_MAINNET_ID]:
    process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET || "",
  [CELO_SEPOLIA_ID]:
    process.env.NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA || "",
};

export function getSubgraphUrlForChain(_chainId?: number): string {
  const mainnetUrl = SUBGRAPH_URLS[CELO_MAINNET_ID];
  return mainnetUrl || process.env.NEXT_PUBLIC_SUBGRAPH_URL || "";
}

export function isUsdtToken(tokenAddress: string | undefined): boolean {
  if (!tokenAddress) return false;
  return tokenAddress.toLowerCase() === USDT_ADDRESSES.mainnet.toLowerCase();
}

export function getSupportedTokens(_chainId?: number) {
  return [
    {
      address: USDT_ADDRESSES.mainnet,
      symbol: "USDT",
      name: "Tether USD",
    },
  ] as const;
}

export const SUPPORTED_TOKENS = [
  { address: USDT_ADDRESSES.mainnet, symbol: "USDT", name: "Tether USD" },
] as const;

export const FARCASTER_KEY_REGISTRY_ADDRESS =
  "0x00000000Fc1237824fb747aBDE0FF18990E59b7e" as const;

export const FARCASTER_MINIAPP_BASE_URL =
  process.env.NEXT_PUBLIC_FARCASTER_MINIAPP_URL ||
  "https://farcaster.xyz/miniapps/6TpUBtkLM1a3/delulu";

export const TG_GROUP_URL = "https://t.me/+96pLkvSh0I4wZThk";
