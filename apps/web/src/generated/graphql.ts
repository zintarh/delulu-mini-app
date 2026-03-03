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

export type Challenge = {
  active: Scalars['Boolean']['output'];
  challengeId: Scalars['BigInt']['output'];
  contentHash: Scalars['String']['output'];
  createdAt: Scalars['BigInt']['output'];
  duration: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  poolAmount: Scalars['BigInt']['output'];
  startTime: Scalars['BigInt']['output'];
  totalPoints: Scalars['BigInt']['output'];
};

export type Challenge_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  active?: InputMaybe<Scalars['Boolean']['input']>;
  active_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  active_not?: InputMaybe<Scalars['Boolean']['input']>;
  active_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  and?: InputMaybe<Array<InputMaybe<Challenge_Filter>>>;
  challengeId?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  challengeId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_not?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
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
  duration?: InputMaybe<Scalars['BigInt']['input']>;
  duration_gt?: InputMaybe<Scalars['BigInt']['input']>;
  duration_gte?: InputMaybe<Scalars['BigInt']['input']>;
  duration_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  duration_lt?: InputMaybe<Scalars['BigInt']['input']>;
  duration_lte?: InputMaybe<Scalars['BigInt']['input']>;
  duration_not?: InputMaybe<Scalars['BigInt']['input']>;
  duration_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Challenge_Filter>>>;
  poolAmount?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  poolAmount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_not?: InputMaybe<Scalars['BigInt']['input']>;
  poolAmount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  startTime?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_gt?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_gte?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  startTime_lt?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_lte?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_not?: InputMaybe<Scalars['BigInt']['input']>;
  startTime_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalPoints?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalPoints_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalPoints_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type Challenge_OrderBy =
  | 'active'
  | 'challengeId'
  | 'contentHash'
  | 'createdAt'
  | 'duration'
  | 'id'
  | 'poolAmount'
  | 'startTime'
  | 'totalPoints';

export type Claim = {
  amount: Scalars['BigInt']['output'];
  claimType: Scalars['String']['output'];
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
  claimType?: InputMaybe<Scalars['String']['input']>;
  claimType_contains?: InputMaybe<Scalars['String']['input']>;
  claimType_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  claimType_ends_with?: InputMaybe<Scalars['String']['input']>;
  claimType_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  claimType_gt?: InputMaybe<Scalars['String']['input']>;
  claimType_gte?: InputMaybe<Scalars['String']['input']>;
  claimType_in?: InputMaybe<Array<Scalars['String']['input']>>;
  claimType_lt?: InputMaybe<Scalars['String']['input']>;
  claimType_lte?: InputMaybe<Scalars['String']['input']>;
  claimType_not?: InputMaybe<Scalars['String']['input']>;
  claimType_not_contains?: InputMaybe<Scalars['String']['input']>;
  claimType_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  claimType_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  claimType_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  claimType_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  claimType_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  claimType_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  claimType_starts_with?: InputMaybe<Scalars['String']['input']>;
  claimType_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
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
  | 'claimType'
  | 'createdAt'
  | 'delulu'
  | 'delulu__challengeId'
  | 'delulu__contentHash'
  | 'delulu__createdAt'
  | 'delulu__creatorAddress'
  | 'delulu__creatorStake'
  | 'delulu__id'
  | 'delulu__isCancelled'
  | 'delulu__isResolved'
  | 'delulu__milestoneCount'
  | 'delulu__onChainId'
  | 'delulu__points'
  | 'delulu__resolutionDeadline'
  | 'delulu__rewardClaimed'
  | 'delulu__stakingDeadline'
  | 'delulu__token'
  | 'delulu__totalSupportCollected'
  | 'delulu__totalSupporters'
  | 'id'
  | 'txHash'
  | 'user'
  | 'user__deluluPoints'
  | 'user__id'
  | 'user__metadataHash'
  | 'user__totalStaked'
  | 'user__username';

export type Delulu = {
  challengeId?: Maybe<Scalars['BigInt']['output']>;
  claims: Array<Claim>;
  contentHash: Scalars['String']['output'];
  createdAt: Scalars['BigInt']['output'];
  creator: User;
  creatorAddress: Scalars['String']['output'];
  creatorStake: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  isCancelled: Scalars['Boolean']['output'];
  isResolved: Scalars['Boolean']['output'];
  milestoneCount: Scalars['BigInt']['output'];
  milestones: Array<Milestone>;
  onChainId: Scalars['BigInt']['output'];
  points?: Maybe<Scalars['BigInt']['output']>;
  resolutionDeadline?: Maybe<Scalars['BigInt']['output']>;
  rewardClaimed: Scalars['Boolean']['output'];
  stakes: Array<Stake>;
  stakingDeadline?: Maybe<Scalars['BigInt']['output']>;
  token?: Maybe<Scalars['Bytes']['output']>;
  totalSupportCollected: Scalars['BigInt']['output'];
  totalSupporters: Scalars['BigInt']['output'];
};


export type DeluluClaimsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Claim_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Claim_Filter>;
};


export type DeluluMilestonesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Milestone_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Milestone_Filter>;
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
  challengeId?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  challengeId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_not?: InputMaybe<Scalars['BigInt']['input']>;
  challengeId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
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
  milestoneCount?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_gt?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_gte?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  milestoneCount_lt?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_lte?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_not?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneCount_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  milestones_?: InputMaybe<Milestone_Filter>;
  onChainId?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  onChainId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_not?: InputMaybe<Scalars['BigInt']['input']>;
  onChainId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Delulu_Filter>>>;
  points?: InputMaybe<Scalars['BigInt']['input']>;
  points_gt?: InputMaybe<Scalars['BigInt']['input']>;
  points_gte?: InputMaybe<Scalars['BigInt']['input']>;
  points_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  points_lt?: InputMaybe<Scalars['BigInt']['input']>;
  points_lte?: InputMaybe<Scalars['BigInt']['input']>;
  points_not?: InputMaybe<Scalars['BigInt']['input']>;
  points_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  resolutionDeadline?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  resolutionDeadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  resolutionDeadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  rewardClaimed?: InputMaybe<Scalars['Boolean']['input']>;
  rewardClaimed_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  rewardClaimed_not?: InputMaybe<Scalars['Boolean']['input']>;
  rewardClaimed_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  stakes_?: InputMaybe<Stake_Filter>;
  stakingDeadline?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  stakingDeadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  stakingDeadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  token?: InputMaybe<Scalars['Bytes']['input']>;
  token_contains?: InputMaybe<Scalars['Bytes']['input']>;
  token_gt?: InputMaybe<Scalars['Bytes']['input']>;
  token_gte?: InputMaybe<Scalars['Bytes']['input']>;
  token_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  token_lt?: InputMaybe<Scalars['Bytes']['input']>;
  token_lte?: InputMaybe<Scalars['Bytes']['input']>;
  token_not?: InputMaybe<Scalars['Bytes']['input']>;
  token_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  token_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  totalSupportCollected?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalSupportCollected_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupportCollected_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalSupporters?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_gt?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_gte?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  totalSupporters_lt?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_lte?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_not?: InputMaybe<Scalars['BigInt']['input']>;
  totalSupporters_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type Delulu_OrderBy =
  | 'challengeId'
  | 'claims'
  | 'contentHash'
  | 'createdAt'
  | 'creator'
  | 'creatorAddress'
  | 'creatorStake'
  | 'creator__deluluPoints'
  | 'creator__id'
  | 'creator__metadataHash'
  | 'creator__totalStaked'
  | 'creator__username'
  | 'id'
  | 'isCancelled'
  | 'isResolved'
  | 'milestoneCount'
  | 'milestones'
  | 'onChainId'
  | 'points'
  | 'resolutionDeadline'
  | 'rewardClaimed'
  | 'stakes'
  | 'stakingDeadline'
  | 'token'
  | 'totalSupportCollected'
  | 'totalSupporters';

export type Milestone = {
  creator: User;
  deadline: Scalars['BigInt']['output'];
  delulu: Delulu;
  descriptionHash: Scalars['Bytes']['output'];
  id: Scalars['ID']['output'];
  isSubmitted: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  milestoneId: Scalars['BigInt']['output'];
  pointsEarned: Scalars['BigInt']['output'];
  proofLink?: Maybe<Scalars['String']['output']>;
  rejectedAt?: Maybe<Scalars['BigInt']['output']>;
  rejectionReason?: Maybe<Scalars['String']['output']>;
  submittedAt?: Maybe<Scalars['BigInt']['output']>;
  verifiedAt?: Maybe<Scalars['BigInt']['output']>;
};

export type Milestone_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Milestone_Filter>>>;
  creator?: InputMaybe<Scalars['String']['input']>;
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
  deadline?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_gt?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_gte?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  deadline_lt?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_lte?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_not?: InputMaybe<Scalars['BigInt']['input']>;
  deadline_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
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
  descriptionHash?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  descriptionHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  descriptionHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  isSubmitted?: InputMaybe<Scalars['Boolean']['input']>;
  isSubmitted_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isSubmitted_not?: InputMaybe<Scalars['Boolean']['input']>;
  isSubmitted_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  isVerified_not?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified_not_in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  milestoneId?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_gt?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_gte?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  milestoneId_lt?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_lte?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_not?: InputMaybe<Scalars['BigInt']['input']>;
  milestoneId_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Milestone_Filter>>>;
  pointsEarned?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_gt?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_gte?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  pointsEarned_lt?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_lte?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_not?: InputMaybe<Scalars['BigInt']['input']>;
  pointsEarned_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  proofLink?: InputMaybe<Scalars['String']['input']>;
  proofLink_contains?: InputMaybe<Scalars['String']['input']>;
  proofLink_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  proofLink_ends_with?: InputMaybe<Scalars['String']['input']>;
  proofLink_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  proofLink_gt?: InputMaybe<Scalars['String']['input']>;
  proofLink_gte?: InputMaybe<Scalars['String']['input']>;
  proofLink_in?: InputMaybe<Array<Scalars['String']['input']>>;
  proofLink_lt?: InputMaybe<Scalars['String']['input']>;
  proofLink_lte?: InputMaybe<Scalars['String']['input']>;
  proofLink_not?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_contains?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  proofLink_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  proofLink_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  proofLink_starts_with?: InputMaybe<Scalars['String']['input']>;
  proofLink_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectedAt?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  rejectedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  rejectedAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  rejectionReason?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_contains?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_ends_with?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_gt?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_gte?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_in?: InputMaybe<Array<Scalars['String']['input']>>;
  rejectionReason_lt?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_lte?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_contains?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  rejectionReason_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_starts_with?: InputMaybe<Scalars['String']['input']>;
  rejectionReason_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  submittedAt?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  submittedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  submittedAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  verifiedAt?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_gt?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_gte?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  verifiedAt_lt?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_lte?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_not?: InputMaybe<Scalars['BigInt']['input']>;
  verifiedAt_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
};

export type Milestone_OrderBy =
  | 'creator'
  | 'creator__deluluPoints'
  | 'creator__id'
  | 'creator__metadataHash'
  | 'creator__totalStaked'
  | 'creator__username'
  | 'deadline'
  | 'delulu'
  | 'delulu__challengeId'
  | 'delulu__contentHash'
  | 'delulu__createdAt'
  | 'delulu__creatorAddress'
  | 'delulu__creatorStake'
  | 'delulu__id'
  | 'delulu__isCancelled'
  | 'delulu__isResolved'
  | 'delulu__milestoneCount'
  | 'delulu__onChainId'
  | 'delulu__points'
  | 'delulu__resolutionDeadline'
  | 'delulu__rewardClaimed'
  | 'delulu__stakingDeadline'
  | 'delulu__token'
  | 'delulu__totalSupportCollected'
  | 'delulu__totalSupporters'
  | 'descriptionHash'
  | 'id'
  | 'isSubmitted'
  | 'isVerified'
  | 'milestoneId'
  | 'pointsEarned'
  | 'proofLink'
  | 'rejectedAt'
  | 'rejectionReason'
  | 'submittedAt'
  | 'verifiedAt';

/** Defines the order direction, either ascending or descending */
export type OrderDirection =
  | 'asc'
  | 'desc';

export type Query = {
  /** Access to subgraph metadata */
  _meta?: Maybe<_Meta_>;
  challenge?: Maybe<Challenge>;
  challenges: Array<Challenge>;
  claim?: Maybe<Claim>;
  claims: Array<Claim>;
  delulu?: Maybe<Delulu>;
  delulus: Array<Delulu>;
  milestone?: Maybe<Milestone>;
  milestones: Array<Milestone>;
  stake?: Maybe<Stake>;
  stakes: Array<Stake>;
  upgraded?: Maybe<Upgraded>;
  upgradeds: Array<Upgraded>;
  user?: Maybe<User>;
  users: Array<User>;
};


export type Query_MetaArgs = {
  block?: InputMaybe<Block_Height>;
};


export type QueryChallengeArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryChallengesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Challenge_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Challenge_Filter>;
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


export type QueryMilestoneArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryMilestonesArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Milestone_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Milestone_Filter>;
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


export type QueryUpgradedArgs = {
  block?: InputMaybe<Block_Height>;
  id: Scalars['ID']['input'];
  subgraphError?: _SubgraphErrorPolicy_;
};


export type QueryUpgradedsArgs = {
  block?: InputMaybe<Block_Height>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Upgraded_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  subgraphError?: _SubgraphErrorPolicy_;
  where?: InputMaybe<Upgraded_Filter>;
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
  | 'delulu__challengeId'
  | 'delulu__contentHash'
  | 'delulu__createdAt'
  | 'delulu__creatorAddress'
  | 'delulu__creatorStake'
  | 'delulu__id'
  | 'delulu__isCancelled'
  | 'delulu__isResolved'
  | 'delulu__milestoneCount'
  | 'delulu__onChainId'
  | 'delulu__points'
  | 'delulu__resolutionDeadline'
  | 'delulu__rewardClaimed'
  | 'delulu__stakingDeadline'
  | 'delulu__token'
  | 'delulu__totalSupportCollected'
  | 'delulu__totalSupporters'
  | 'id'
  | 'txHash'
  | 'user'
  | 'user__deluluPoints'
  | 'user__id'
  | 'user__metadataHash'
  | 'user__totalStaked'
  | 'user__username';

export type Upgraded = {
  blockNumber: Scalars['BigInt']['output'];
  blockTimestamp: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  implementation: Scalars['Bytes']['output'];
  transactionHash: Scalars['Bytes']['output'];
};

export type Upgraded_Filter = {
  /** Filter for the block changed event. */
  _change_block?: InputMaybe<BlockChangedFilter>;
  and?: InputMaybe<Array<InputMaybe<Upgraded_Filter>>>;
  blockNumber?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockNumber_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockNumber_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_gte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  blockTimestamp_lt?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_lte?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not?: InputMaybe<Scalars['BigInt']['input']>;
  blockTimestamp_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  id_gt?: InputMaybe<Scalars['ID']['input']>;
  id_gte?: InputMaybe<Scalars['ID']['input']>;
  id_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  id_lt?: InputMaybe<Scalars['ID']['input']>;
  id_lte?: InputMaybe<Scalars['ID']['input']>;
  id_not?: InputMaybe<Scalars['ID']['input']>;
  id_not_in?: InputMaybe<Array<Scalars['ID']['input']>>;
  implementation?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_contains?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_gt?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_gte?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  implementation_lt?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_lte?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_not?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  implementation_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  or?: InputMaybe<Array<InputMaybe<Upgraded_Filter>>>;
  transactionHash?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_gte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
  transactionHash_lt?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_lte?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_contains?: InputMaybe<Scalars['Bytes']['input']>;
  transactionHash_not_in?: InputMaybe<Array<Scalars['Bytes']['input']>>;
};

export type Upgraded_OrderBy =
  | 'blockNumber'
  | 'blockTimestamp'
  | 'id'
  | 'implementation'
  | 'transactionHash';

export type User = {
  claims: Array<Claim>;
  deluluPoints: Scalars['BigInt']['output'];
  delulus: Array<Delulu>;
  id: Scalars['Bytes']['output'];
  metadataHash?: Maybe<Scalars['String']['output']>;
  milestones: Array<Milestone>;
  stakes: Array<Stake>;
  totalStaked: Scalars['BigInt']['output'];
  username?: Maybe<Scalars['String']['output']>;
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


export type UserMilestonesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Milestone_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<Milestone_Filter>;
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
  deluluPoints?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_gt?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_gte?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
  deluluPoints_lt?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_lte?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_not?: InputMaybe<Scalars['BigInt']['input']>;
  deluluPoints_not_in?: InputMaybe<Array<Scalars['BigInt']['input']>>;
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
  metadataHash?: InputMaybe<Scalars['String']['input']>;
  metadataHash_contains?: InputMaybe<Scalars['String']['input']>;
  metadataHash_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataHash_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataHash_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataHash_gt?: InputMaybe<Scalars['String']['input']>;
  metadataHash_gte?: InputMaybe<Scalars['String']['input']>;
  metadataHash_in?: InputMaybe<Array<Scalars['String']['input']>>;
  metadataHash_lt?: InputMaybe<Scalars['String']['input']>;
  metadataHash_lte?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_contains?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  metadataHash_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataHash_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  metadataHash_starts_with?: InputMaybe<Scalars['String']['input']>;
  metadataHash_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  milestones_?: InputMaybe<Milestone_Filter>;
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
  username?: InputMaybe<Scalars['String']['input']>;
  username_contains?: InputMaybe<Scalars['String']['input']>;
  username_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  username_ends_with?: InputMaybe<Scalars['String']['input']>;
  username_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  username_gt?: InputMaybe<Scalars['String']['input']>;
  username_gte?: InputMaybe<Scalars['String']['input']>;
  username_in?: InputMaybe<Array<Scalars['String']['input']>>;
  username_lt?: InputMaybe<Scalars['String']['input']>;
  username_lte?: InputMaybe<Scalars['String']['input']>;
  username_not?: InputMaybe<Scalars['String']['input']>;
  username_not_contains?: InputMaybe<Scalars['String']['input']>;
  username_not_contains_nocase?: InputMaybe<Scalars['String']['input']>;
  username_not_ends_with?: InputMaybe<Scalars['String']['input']>;
  username_not_ends_with_nocase?: InputMaybe<Scalars['String']['input']>;
  username_not_in?: InputMaybe<Array<Scalars['String']['input']>>;
  username_not_starts_with?: InputMaybe<Scalars['String']['input']>;
  username_not_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
  username_starts_with?: InputMaybe<Scalars['String']['input']>;
  username_starts_with_nocase?: InputMaybe<Scalars['String']['input']>;
};

export type User_OrderBy =
  | 'claims'
  | 'deluluPoints'
  | 'delulus'
  | 'id'
  | 'metadataHash'
  | 'milestones'
  | 'stakes'
  | 'totalStaked'
  | 'username';

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

export type GetChallengesQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Challenge_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  where?: InputMaybe<Challenge_Filter>;
}>;


export type GetChallengesQuery = { challenges: Array<{ id: string, challengeId: string, contentHash: string, poolAmount: string, startTime: string, duration: string, totalPoints: string, active: boolean, createdAt: string }> };

export type GetChallengeByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetChallengeByIdQuery = { challenge?: { id: string, challengeId: string, contentHash: string, poolAmount: string, startTime: string, duration: string, totalPoints: string, active: boolean, createdAt: string } | null };

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


export type GetDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token?: string | null, creatorAddress: string, contentHash: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, createdAt: string, creatorStake: string, totalSupportCollected: string, totalSupporters: string, challengeId?: string | null, points?: string | null, milestoneCount: string, isResolved: boolean, isCancelled: boolean, rewardClaimed: boolean, creator: { id: string } }> };

export type GetDeluluByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetDeluluByIdQuery = { delulu?: { id: string, onChainId: string, token?: string | null, creatorAddress: string, contentHash: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, createdAt: string, creatorStake: string, totalSupportCollected: string, totalSupporters: string, challengeId?: string | null, points?: string | null, milestoneCount: string, isResolved: boolean, isCancelled: boolean, rewardClaimed: boolean, creator: { id: string, totalStaked: string, username?: string | null }, stakes: Array<{ id: string, amount: string, txHash: string, createdAt: string, user: { id: string } }>, claims: Array<{ id: string, amount: string, txHash: string, createdAt: string, user: { id: string } }>, milestones: Array<{ id: string, milestoneId: string, descriptionHash: string, deadline: string, proofLink?: string | null, isSubmitted: boolean, isVerified: boolean, pointsEarned: string, submittedAt?: string | null, verifiedAt?: string | null, rejectedAt?: string | null, rejectionReason?: string | null }> } | null };

export type GetTrendingDelulusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type GetTrendingDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token?: string | null, creatorAddress: string, contentHash: string, totalSupportCollected: string, stakingDeadline?: string | null, createdAt: string, isResolved: boolean, isCancelled: boolean }> };

export type GetActiveDelulusQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Delulu_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetActiveDelulusQuery = { delulus: Array<{ id: string, onChainId: string, token?: string | null, creatorAddress: string, contentHash: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, createdAt: string, creatorStake: string, isResolved: boolean, isCancelled: boolean, creator: { id: string } }> };

export type GetSubgraphMetaQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSubgraphMetaQuery = { _meta?: { deployment: string, hasIndexingErrors: boolean, block: { number: number, timestamp?: number | null } } | null };

export type GetStakesByDeluluQueryVariables = Exact<{
  deluluId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetStakesByDeluluQuery = { stakes: Array<{ id: string, amount: string, txHash: string, createdAt: string, user: { id: string } }> };

export type GetStakesByUserQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Stake_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
}>;


export type GetStakesByUserQuery = { stakes: Array<{ id: string, amount: string, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, isResolved: boolean, isCancelled: boolean, createdAt: string } }> };

export type GetUserStakesForDeluluQueryVariables = Exact<{
  userId: Scalars['String']['input'];
  deluluId: Scalars['String']['input'];
}>;


export type GetUserStakesForDeluluQuery = { stakes: Array<{ id: string, amount: string, txHash: string, createdAt: string }> };

export type GetUserQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserQuery = { user?: { id: string, totalStaked: string, delulus: Array<{ id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, createdAt: string, creatorStake: string, isResolved: boolean, isCancelled: boolean }>, stakes: Array<{ id: string, amount: string, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string, creatorAddress: string, stakingDeadline?: string | null, resolutionDeadline?: string | null, isResolved: boolean, isCancelled: boolean, createdAt: string } }>, claims: Array<{ id: string, amount: string, txHash: string, createdAt: string, delulu: { id: string, onChainId: string, contentHash: string } }> } | null };

export type GetUserStatsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetUserStatsQuery = { user?: { id: string, totalStaked: string } | null };


export const GetChallengesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetChallenges"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"100"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skip"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Challenge_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Challenge_filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"challenges"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"skip"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skip"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"challengeId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"poolAmount"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetChallengesQuery, GetChallengesQueryVariables>;
export const GetChallengeByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetChallengeById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"challenge"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"challengeId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"poolAmount"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"duration"}},{"kind":"Field","name":{"kind":"Name","value":"totalPoints"}},{"kind":"Field","name":{"kind":"Name","value":"active"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetChallengeByIdQuery, GetChallengeByIdQueryVariables>;
export const GetClaimsByUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetClaimsByUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"200"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Claim_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}}]}}]}}]}}]} as unknown as DocumentNode<GetClaimsByUserQuery, GetClaimsByUserQueryVariables>;
export const GetUserClaimForDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserClaimForDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetUserClaimForDeluluQuery, GetUserClaimForDeluluQueryVariables>;
export const GetDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skip"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"skip"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skip"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalSupportCollected"}},{"kind":"Field","name":{"kind":"Name","value":"totalSupporters"}},{"kind":"Field","name":{"kind":"Name","value":"challengeId"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"milestoneCount"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"rewardClaimed"}}]}}]}}]} as unknown as DocumentNode<GetDelulusQuery, GetDelulusQueryVariables>;
export const GetDeluluByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetDeluluById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulu"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"totalSupportCollected"}},{"kind":"Field","name":{"kind":"Name","value":"totalSupporters"}},{"kind":"Field","name":{"kind":"Name","value":"challengeId"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"milestoneCount"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"rewardClaimed"}},{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"milestones"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"50"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"milestoneId"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"asc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"milestoneId"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionHash"}},{"kind":"Field","name":{"kind":"Name","value":"deadline"}},{"kind":"Field","name":{"kind":"Name","value":"proofLink"}},{"kind":"Field","name":{"kind":"Name","value":"isSubmitted"}},{"kind":"Field","name":{"kind":"Name","value":"isVerified"}},{"kind":"Field","name":{"kind":"Name","value":"pointsEarned"}},{"kind":"Field","name":{"kind":"Name","value":"submittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"verifiedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rejectionReason"}}]}}]}}]}}]} as unknown as DocumentNode<GetDeluluByIdQuery, GetDeluluByIdQueryVariables>;
export const GetTrendingDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetTrendingDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"totalSupportCollected"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"BooleanValue","value":false}},{"kind":"ObjectField","name":{"kind":"Name","value":"isCancelled"},"value":{"kind":"BooleanValue","value":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"totalSupportCollected"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}}]}}]}}]} as unknown as DocumentNode<GetTrendingDelulusQuery, GetTrendingDelulusQueryVariables>;
export const GetActiveDelulusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetActiveDelulus"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"20"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skip"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"0"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Delulu_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"skip"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skip"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"BooleanValue","value":false}},{"kind":"ObjectField","name":{"kind":"Name","value":"isCancelled"},"value":{"kind":"BooleanValue","value":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}}]}}]}}]} as unknown as DocumentNode<GetActiveDelulusQuery, GetActiveDelulusQueryVariables>;
export const GetSubgraphMetaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSubgraphMeta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"_meta"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"block"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deployment"}},{"kind":"Field","name":{"kind":"Name","value":"hasIndexingErrors"}}]}}]}}]} as unknown as DocumentNode<GetSubgraphMetaQuery, GetSubgraphMetaQueryVariables>;
export const GetStakesByDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStakesByDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"100"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Stake_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetStakesByDeluluQuery, GetStakesByDeluluQueryVariables>;
export const GetStakesByUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStakesByUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"200"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Stake_orderBy"}},"defaultValue":{"kind":"EnumValue","value":"createdAt"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderDirection"}},"defaultValue":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderDirection"}}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<GetStakesByUserQuery, GetStakesByUserQueryVariables>;
export const GetUserStakesForDeluluDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserStakesForDelulu"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"user"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"delulu"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deluluId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<GetUserStakesForDeluluQuery, GetUserStakesForDeluluQueryVariables>;
export const GetUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}},{"kind":"Field","name":{"kind":"Name","value":"delulus"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"100"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"creatorStake"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stakes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}},{"kind":"Field","name":{"kind":"Name","value":"creatorAddress"}},{"kind":"Field","name":{"kind":"Name","value":"stakingDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"resolutionDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"isCancelled"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"claims"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"200"}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"EnumValue","value":"createdAt"}},{"kind":"Argument","name":{"kind":"Name","value":"orderDirection"},"value":{"kind":"EnumValue","value":"desc"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"txHash"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"delulu"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"onChainId"}},{"kind":"Field","name":{"kind":"Name","value":"contentHash"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetUserQuery, GetUserQueryVariables>;
export const GetUserStatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserStats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"user"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"totalStaked"}}]}}]}}]} as unknown as DocumentNode<GetUserStatsQuery, GetUserStatsQueryVariables>;