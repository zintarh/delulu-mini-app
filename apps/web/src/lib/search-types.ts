export type DeluluSearchResult = {
  id: string;
  onChainId: string;
  creator: string;
  content: string;
  username: string | null;
  pfpUrl: string | null;
  bgImageUrl: string | null;
  totalSupportCollected: number;
  totalSupporters: number;
  creatorStake: number;
  createdAt: string;
  isResolved?: boolean;
  countryCode?: string | null;
  countryLabel?: string | null;
  tokenAddress?: string;
};

export type SearchCountryOption = {
  code: string;
  label: string;
  count: number;
};

export type SearchBootstrap = {
  trending: DeluluSearchResult[];
  countries: SearchCountryOption[];
  isBuilding: boolean;
  indexedCount: number;
  totalCount: number;
};
