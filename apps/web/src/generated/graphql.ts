/* eslint-disable */
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigDecimal: { input: string; output: string; }
  BigInt: { input: string; output: string; }
  Bytes: { input: string; output: string; }
  /** 8 bytes signed integer */
  Int8: { input: number; output: number; }
  /** A string representation of microseconds UNIX timestamp (16 digits) */
  Timestamp: { input: any; output: any; }
};

export type Aggregation_Interval =
  | 'day'
  | 'hour';

export type BlockChangedFilter = {
  number_gte: Scalars['Int']['input'];
};

export type Block_Height = {
  hash?: InputMaybe<Scalars['Bytes']['input']>;
  number?: InputMaybe<Scalars['Int']['input']>;
  number_gte?: InputMaybe<Scalars['Int']['input']>;
};

export type Claim = {
  amount: Scalars['BigInt']['output'];
  createdAt: Scalars['BigInt']['output'];
  delulu: Delulu;
  id: Scalars['ID']['output'];
  txHash: Scalars['Bytes']['output'];
  user: User;
};

export type Claim_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  and?: InputMaybe<Array<InputMaybe<Claim_Filter>>>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  delulu?: InputMaybe<Scalars['String']['input']>;
  delulu_?: InputMaybe<Delulu_Filter>;
  delulu_contains?: InputMaybe<Scalars['String']['input']>;
  delulu_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_ends_with?: InputMaybe<Scalars['String']['input']>;
  delulu_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_gt?: InputMaybe<Scalars['String']['input']>;
  delulu_gte?: InputMaybe<Scalars['String']['input']>;
  delulu_in?: InputMaybe<Array<Scalars['String']['input']>>;
  delulu_lt?: InputMaybe<Scalars['String']['input']>;
  delulu_lte?: InputMaybe<Scalars['String']['input']>;
  delulu_not?: InputMaybe<Scalars['String']['input']>;
  delulu_not_contains?: InputMaybe<Scalars['String']['input']>;
  delulu_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  delulu_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  delulu_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  delulu_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_starts_with?: InputMaybe<Scalars['String']['input']>;
  delulu_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Claim_Filter>>>;
  txHash?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  txHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user?: InputMaybe<Scalars['String']['input']>;
  user_?: InputMaybe<User_Filter>;
  user_contains?: InputMaybe<Scalars['String']['input']>;
  user_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_gt?: InputMaybe<Scalars['String']['input']>;
  user_gte?: InputMaybe<Scalars['String']['input']>;
  user_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_lt?: InputMaybe<Scalars['String']['input']>;
  user_lte?: InputMaybe<Scalars['String']['input']>;
  user_not?: InputMaybe<Scalars['String']['input']>;
  user_not_contains?: InputMaybe<Scalars['String']['input']>;
  user_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type Claim_OrderBy =
  | 'amount'
  | 'createdAt'
  | 'delulu'
  | 'delulu__contentHash'
  | 'delulu__createdAt'
  | 'delulu__creatorAddress'
  | 'delulu__creatorStake'
  | 'delulu__id'
  | 'delulu__isCancelled'
  | 'delulu__isResolved'
  | 'delulu__losingPool'
  | 'delulu__onChainId'
  | 'delulu__outcome'
  | 'delulu__resolutionDeadline'
  | 'delulu__stakingDeadline'
  | 'delulu__totalBelieverStake'
  | 'delulu__totalDoubterStake'
  | 'delulu__winningPool'
  | 'id'
  | 'txHash'
  | 'user'
  | 'user__id'
  | 'user__totalStaked';

export type Delulu = {
  claims: Array<Claim>;
  contentHash: Scalars['String']['output'];
  createdAt: Scalars['BigInt']['output'];
  creator: User;
  creatorAddress: Scalars['String']['output'];
  creatorStake: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  isCancelled: Scalars['Boolean']['output'];
  isResolved: Scalars['Boolean']['output'];
  losingPool: Scalars['BigInt']['output'];
  onChainId: Scalars['BigInt']['output'];
  outcome?: Maybe<Scalars['Boolean']['output']>;
  resolutionDeadline: Scalars['BigInt']['output'];
  stakes: Array<Stake>;
  stakingDeadline: Scalars['BigInt']['output'];
  token: Scalars['Bytes']['output'];
  totalBelieverStake: Scalars['BigInt']['output'];
  totalDoubterStake: Scalars['BigInt']['output'];
  winningPool: Scalars['BigInt']['output'];
};


export type DeluluClaimsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Claim_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Claim_Filter>;
};


export type DeluluStakesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Stake_Filter>;
};

export type Delulu_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Delulu_Filter>>>;
  claims_?: InputMaybe<Claim_Filter>;
  contentHash?: InputMaybe<Scalars['String']['input']>;
  contentHash_contains?: InputMaybe<Scalars['String']['input']>;
  contentHash_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  contentHash_ends_with?: InputMaybe<Scalars['String']['input']>;
  contentHash_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  contentHash_gt?: InputMaybe<Scalars['String']['input']>;
  contentHash_gte?: InputMaybe<Scalars['String']['input']>;
  contentHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  contentHash_lt?: InputMaybe<Scalars['String']['input']>;
  contentHash_lte?: InputMaybe<Scalars['String']['input']>;
  contentHash_not?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  contentHash_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  contentHash_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  contentHash_starts_with?: InputMaybe<Scalars['String']['input']>;
  contentHash_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  creator?: InputMaybe<Scalars['String']['input']>;
  creatorAddress?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_contains?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_ends_with?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_gt?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_gte?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_in?: InputMaybe<Array<Scalars['String']['input']>>;
  creatorAddress_lt?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_lte?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_contains?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  creatorAddress_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_starts_with?: InputMaybe<Scalars['String']['input']>;
  creatorAddress_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creatorStake?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_gt?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_gte?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  creatorStake_lt?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_lte?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_not?: InputMaybe<Scalars['BigInt']['input']>;
  creatorStake_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  creator_?: InputMaybe<User_Filter>;
  creator_contains?: InputMaybe<Scalars['String']['input']>;
  creator_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  creator_ends_with?: InputMaybe<Scalars['String']['input']>;
  creator_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creator_gt?: InputMaybe<Scalars['String']['input']>;
  creator_gte?: InputMaybe<Scalars['String']['input']>;
  creator_in?: InputMaybe<Array<Scalars['String']['input']>>;
  creator_lt?: InputMaybe<Scalars['String']['input']>;
  creator_lte?: InputMaybe<Scalars['String']['input']>;
  creator_not?: InputMaybe<Scalars['String']['input']>;
  creator_not_contains?: InputMaybe<Scalars['String']['input']>;
  creator_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  creator_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  creator_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creator_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  creator_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  creator_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  creator_starts_with?: InputMaybe<Scalars['String']['input']>;
  creator_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  isCancelled?: InputMaybe<Scalars['Boolean']['input']>;
  isCancelled_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isCancelled_not?: InputMaybe<Scalars['Boolean']['input']>;
  isCancelled_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isResolved?: InputMaybe<Scalars['Boolean']['input']>;
  isResolved_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isResolved_not?: InputMaybe<Scalars['Boolean']['input']>;
  isResolved_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  losingPool?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_gt?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_gte?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  losingPool_lt?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_lte?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_not?: InputMaybe<Scalars['BigInt']['input']>;
  losingPool_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  onChainId?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  onChainId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_not?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Delulu_Filter>>>;
  outcome?: InputMaybe<Scalars['Boolean']['input']>;
  outcome_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  outcome_not?: InputMaybe<Scalars['Boolean']['input']>;
  outcome_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  resolutionDeadline?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  resolutionDeadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakes_?: InputMaybe<Stake_Filter>;
  stakingDeadline?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakingDeadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalBelieverStake?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalBelieverStake_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalBelieverStake_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalDoubterStake?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalDoubterStake_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalDoubterStake_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  winningPool?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_gt?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_gte?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  winningPool_lt?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_lte?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_not?: InputMaybe<Scalars['BigInt']['input']>;
  winningPool_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type Delulu_OrderBy =
  | 'claims'
  | 'contentHash'
  | 'createdAt'
  | 'creator'
  | 'creatorAddress'
  | 'creatorStake'
  | 'creator__id'
  | 'creator__totalStaked'
  | 'id'
  | 'isCancelled'
  | 'isResolved'
  | 'losingPool'
  | 'onChainId'
  | 'outcome'
  | 'resolutionDeadline'
  | 'stakes'
  | 'stakingDeadline'
  | 'totalBelieverStake'
  | 'totalDoubterStake'
  | 'winningPool';

/** Defines the order direction, either ascending or descending */
export type OrderDirection =
  | 'asc'
  | 'desc';

export type Query = {
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  claim?: Maybe<Claim>;
  claims: Array<Claim>;
  delulu?: Maybe<Delulu>;
  delulus: Array<Delulu>;
  stake?: Maybe<Stake>;
  stakes: Array<Stake>;
  user?: Maybe<User>;
  users: Array<User>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryClaimArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryClaimsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Claim_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Claim_Filter>;
};


export type QueryDeluluArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryDelulusArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Delulu_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Delulu_Filter>;
};


export type QueryStakeArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryStakesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Stake_Filter>;
};


export type QueryUserArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryUsersArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<User_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<User_Filter>;
};

export type Stake = {
  amount: Scalars['BigInt']['output'];
  createdAt: Scalars['BigInt']['output'];
  delulu: Delulu;
  id: Scalars['ID']['output'];
  side: Scalars['Boolean']['output'];
  txHash: Scalars['Bytes']['output'];
  user: User;
};

export type Stake_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  amount?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  amount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  amount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not?: InputMaybe<Scalars['BigInt']['input']>;
  amount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  and?: InputMaybe<Array<InputMaybe<Stake_Filter>>>;
  createdAt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  createdAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  createdAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  delulu?: InputMaybe<Scalars['String']['input']>;
  delulu_?: InputMaybe<Delulu_Filter>;
  delulu_contains?: InputMaybe<Scalars['String']['input']>;
  delulu_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_ends_with?: InputMaybe<Scalars['String']['input']>;
  delulu_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_gt?: InputMaybe<Scalars['String']['input']>;
  delulu_gte?: InputMaybe<Scalars['String']['input']>;
  delulu_in?: InputMaybe<Array<Scalars['String']['input']>>;
  delulu_lt?: InputMaybe<Scalars['String']['input']>;
  delulu_lte?: InputMaybe<Scalars['String']['input']>;
  delulu_not?: InputMaybe<Scalars['String']['input']>;
  delulu_not_contains?: InputMaybe<Scalars['String']['input']>;
  delulu_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  delulu_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  delulu_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  delulu_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  delulu_starts_with?: InputMaybe<Scalars['String']['input']>;
  delulu_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Stake_Filter>>>;
  side?: InputMaybe<Scalars['Boolean']['input']>;
  side_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  side_not?: InputMaybe<Scalars['Boolean']['input']>;
  side_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  txHash?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  txHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  txHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  user?: InputMaybe<Scalars['String']['input']>;
  user_?: InputMaybe<User_Filter>;
  user_contains?: InputMaybe<Scalars['String']['input']>;
  user_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_gt?: InputMaybe<Scalars['String']['input']>;
  user_gte?: InputMaybe<Scalars['String']['input']>;
  user_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_lt?: InputMaybe<Scalars['String']['input']>;
  user_lte?: InputMaybe<Scalars['String']['input']>;
  user_not?: InputMaybe<Scalars['String']['input']>;
  user_not_contains?: InputMaybe<Scalars['String']['input']>;
  user_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  user_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  user_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  user_starts_with?: InputMaybe<Scalars['String']['input']>;
  user_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type Stake_OrderBy =
  | 'amount'
  | 'createdAt'
  | 'delulu'
  | 'delulu__contentHash'
  | 'delulu__createdAt'
  | 'delulu__creatorAddress'
  | 'delulu__creatorStake'
  | 'delulu__id'
  | 'delulu__isCancelled'
  | 'delulu__isResolved'
  | 'delulu__losingPool'
  | 'delulu__onChainId'
  | 'delulu__outcome'
  | 'delulu__resolutionDeadline'
  | 'delulu__stakingDeadline'
  | 'delulu__totalBelieverStake'
  | 'delulu__totalDoubterStake'
  | 'delulu__winningPool'
  | 'id'
  | 'side'
  | 'txHash'
  | 'user'
  | 'user__id'
  | 'user__totalStaked';

export type User = {
  claims: Array<Claim>;
  delulus: Array<Delulu>;
  id: Scalars['Bytes']['output'];
  stakes: Array<Stake>;
  totalStaked: Scalars['BigInt']['output'];
};


export type UserClaimsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Claim_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Claim_Filter>;
};


export type UserDelulusArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Delulu_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Delulu_Filter>;
};


export type UserStakesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Stake_Filter>;
};

export type User_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<User_Filter>>>;
  claims_?: InputMaybe<Claim_Filter>;
  delulus_?: InputMaybe<Delulu_Filter>;
  id?: InputMaybe<Scalars['Bytes']['input']>;
  id_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_gt?: InputMaybe<Scalars['Bytes']['input']>;
  id_gte?: InputMaybe<Scalars['Bytes']['input']>;
  id_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id_lt?: InputMaybe<Scalars['Bytes']['input']>;
  id_lte?: InputMaybe<Scalars['Bytes']['input']>;
  id_not?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  or?: InputMaybe<Array<InputMaybe<User_Filter>>>;
  stakes_?: InputMaybe<Stake_Filter>;
  totalStaked?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalStaked_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalStaked_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type User_OrderBy =
  | 'claims'
  | 'delulus'
  | 'id'
  | 'stakes'
  | 'totalStaked';

export type _Block_ = {
  /** The hash of the block */
  hash?: Maybe<Scalars['Bytes']['output']>;
  /** The block number */
  number: Scalars['Int']['output'];
  /** The hash of the parent block */
  parentHash?: Maybe<Scalars['Bytes']['output']>;
  /** Integer representation of the timestamp stored in blocks for the chain */
  timestamp?: Maybe<Scalars['Int']['output']>;
};

/** The type for the top-level _meta field */
export type _Meta_ = {
  /**
   * Information about a specific subgraph block. The hash of the block
   * will be null if the _meta field has a block constraint that asks for
   * a block number. It will be filled if the _meta field has no block constraint
   * and therefore asks for the latest  block
   */
  block: _Block_;
  /** The deployment ID */
  deployment: Scalars['String']['output'];
  /** If `true`, the subgraph encountered indexing errors at some past block */
  hasIndexingErrors: Scalars['Boolean']['output'];
};

export type _SubgraphErrorPolicy_ =
  /** Data will be returned even if the subgraph has indexing errors */
  | 'allow'
  /** If the subgraph has indexing errors, data will be omitted. The default. */
  | 'deny';

export type GetClaimsByUserQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Claim_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetClaimsByUserQuery = { claims: Array<{ id: string, amount: string, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string } }> };

export type GetUserClaimForDeluluQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  deluluId: Scalars['String']['input'];
}>;


export type GetUserClaimForDeluluQuery = { claims: Array<{ id: string, amount: string, txHash: string, createdAt: string }> };

export type GetDelulusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Delulu_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Delulu_Filter>;
}>;


export type GetDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token: string, creatorAddress: string, contentHash: string, stakingDeadline: string, resolutionDeadline: string, createdAt: string, creatorStake: string, totalBelieverStake: string, totalDoubterStake: string, winningPool: string, losingPool: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null, creator: { id: string } }> };

export type GetDeluluByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetDeluluByIdQuery = { delulu?: { id: string, onChainId: string, token: string, creatorAddress: string, contentHash: string, stakingDeadline: string, resolutionDeadline: string, createdAt: string, creatorStake: string, totalBelieverStake: string, totalDoubterStake: string, winningPool: string, losingPool: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null, creator: { id: string, totalStaked: string }, stakes: Array<{ id: string, amount: string, side: boolean, txHash: string, createdAt: string, user: { id: string } }>, claims: Array<{ id: string, amount: string, txHash: string, createdAt: string, user: { id: string } }> } | null };

export type GetTrendingDelulusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTrendingDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token: string, creatorAddress: string, contentHash: string, totalBelieverStake: string, totalDoubterStake: string, stakingDeadline: string, createdAt: string, isResolved: boolean, isCancelled: boolean }> };

export type GetActiveDelulusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Delulu_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetActiveDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token: string, creatorAddress: string, contentHash: string, stakingDeadline: string, resolutionDeadline: string, createdAt: string, creatorStake: string, totalBelieverStake: string, totalDoubterStake: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null, creator: { id: string } }> };

export type GetSubgraphMetaQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSubgraphMetaQuery = { _meta?: { deployment: string, hasIndexingErrors: boolean, block: { number: number, timestamp?: number | null } } | null };

export type GetStakesByDeluluQueryVariables = Exact<{
  deluluId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetStakesByDeluluQuery = { stakes: Array<{ id: string, amount: string, side: boolean, txHash: string, createdAt: string, user: { id: string } }> };

export type GetStakesByUserQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetStakesByUserQuery = { stakes: Array<{ id: string, amount: string, side: boolean, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline: string, resolutionDeadline: string, totalBelieverStake: string, totalDoubterStake: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null, createdAt: string } }> };

export type GetUserStakesForDeluluQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  deluluId: Scalars['String']['input'];
}>;


export type GetUserStakesForDeluluQuery = { stakes: Array<{ id: string, amount: string, side: boolean, txHash: string, createdAt: string }> };

export type GetUserQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserQuery = { user?: { id: string, totalStaked: string, delulus: Array<{ id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline: string, resolutionDeadline: string, createdAt: string, creatorStake: string, totalBelieverStake: string, totalDoubterStake: string, winningPool: string, losingPool: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null }>, stakes: Array<{ id: string, amount: string, side: boolean, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline: string, resolutionDeadline: string, totalBelieverStake: string, totalDoubterStake: string, isResolved: boolean, isCancelled: boolean, outcome?: boolean | null, createdAt: string } }>, claims: Array<{ id: string, amount: string, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string } }> } | null };

export type GetUserStatsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserStatsQuery = { user?: { id: string, totalStaked: string } | null };


export const GetClaimsByUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetClaimsByUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"200"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Claim_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}}]}}]}}]}}]} as unknown as DocumentNode<GetClaimsByUserQuery, GetClaimsByUserQueryVariables>;
export const GetUserClaimForDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserClaimForDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetUserClaimForDeluluQuery, GetUserClaimForDeluluQueryVariables>;
export const GetDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skip"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"skip"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skip"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"winningPool"}},{"kind":"Field","name":{"kind":"Name","value":"losingPool"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}}]}}]}}]} as unknown as DocumentNode<GetDelulusQuery, GetDelulusQueryVariables>;
export const GetDeluluByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDeluluById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulu"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"winningPool"}},{"kind":"Field","name":{"kind":"Name","value":"losingPool"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}},{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"side"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<GetDeluluByIdQuery, GetDeluluByIdQueryVariables>;
export const GetTrendingDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTrendingDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"totalBelieverStake"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"BooleanValue","value":false}},{"kind":"ObjectField","name":{"kind":"Name","value":"isCancelled"},"value":{"kind":"BooleanValue","value":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}}]}}]}}]} as unknown as DocumentNode<GetTrendingDelulusQuery, GetTrendingDelulusQueryVariables>;
export const GetActiveDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetActiveDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skip"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"skip"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skip"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"BooleanValue","value":false}},{"kind":"ObjectField","name":{"kind":"Name","value":"isCancelled"},"value":{"kind":"BooleanValue","value":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}}]}}]}}]} as unknown as DocumentNode<GetActiveDelulusQuery, GetActiveDelulusQueryVariables>;
export const GetSubgraphMetaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSubgraphMeta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"block"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deployment"}},{"kind":"Field","name":{"kind":"Name","value":"hasIndexingErrors"}}]}}]}}]} as unknown as DocumentNode<GetSubgraphMetaQuery, GetSubgraphMetaQueryVariables>;
export const GetStakesByDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStakesByDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"100"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Stake_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"side"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetStakesByDeluluQuery, GetStakesByDeluluQueryVariables>;
export const GetStakesByUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStakesByUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"200"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Stake_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"side"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<GetStakesByUserQuery, GetStakesByUserQueryVariables>;
export const GetUserStakesForDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserStakesForDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"side"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetUserStakesForDeluluQuery, GetUserStakesForDeluluQueryVariables>;
export const GetUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}},{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"winningPool"}},{"kind":"Field","name":{"kind":"Name","value":"losingPool"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"side"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"totalBelieverStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalDoubterStake"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"outcome"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetUserQuery, GetUserQueryVariables>;
export const GetUserStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}}]}}]}}]} as unknown as DocumentNode<GetUserStatsQuery, GetUserStatsQueryVariables>;