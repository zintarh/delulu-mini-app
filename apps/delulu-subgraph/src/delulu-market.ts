import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  DeluluCreated as DeluluCreatedEvent,
  DeluluJoinedChallenge as DeluluJoinedChallengeEvent,
  PointsAllocated as PointsAllocatedEvent,
  SupportClaimed as SupportClaimedEvent,
  ChallengeRewardClaimed as ChallengeRewardClaimedEvent,
  ProfileUpdated as ProfileUpdatedEvent,
  MilestonesAdded as MilestonesAddedEvent,
  MilestoneCreatedDetailed as MilestoneCreatedDetailedEvent,
  MilestoneSubmitted as MilestoneSubmittedEvent,
  MilestoneVerified as MilestoneVerifiedEvent,
  MilestoneDeleted as MilestoneDeletedEvent,
  ChallengeCreated as ChallengeCreatedEvent,
  TipExecuted as TipExecutedEvent,
  TipPointsAwarded as TipPointsAwardedEvent,
  EarlyCompletionBonus as EarlyCompletionBonusEvent,
  StreakBonus as StreakBonusEvent,
  GoalFailed as GoalFailedEvent,
  SharesBought as SharesBoughtEvent,
  SharesSold as SharesSoldEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
  DeluluMarket as DeluluMarketContract
} from "../generated/DeluluMarket/DeluluMarket"
import { User, Delulu, Claim, Milestone, Challenge, CreatorStats, ShareTrade, ShareHolding, Tip } from "../generated/schema"

function getOrCreateUser(userId: Bytes, timestamp: BigInt): User {
  let user = User.load(userId)
  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.username = null
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
    user.save()

    // Ensure a CreatorStats row exists so this user can appear on leaderboards
    let _ = getOrCreateCreatorStats(userId, timestamp)
  }
  return user as User
}

function getOrCreateCreatorStats(creatorId: Bytes, timestamp: BigInt): CreatorStats {
  let stats = CreatorStats.load(creatorId)
  if (stats == null) {
    stats = new CreatorStats(creatorId)
    stats.user = creatorId
    stats.totalGoals = BigInt.fromI32(0)
    stats.completedGoals = BigInt.fromI32(0)
    stats.failedGoals = BigInt.fromI32(0)
    stats.totalMilestones = BigInt.fromI32(0)
    stats.verifiedMilestones = BigInt.fromI32(0)
    stats.totalSupportCollected = BigInt.fromI32(0)
    stats.totalTipsReceived = BigInt.fromI32(0)
    stats.totalTipPoints = BigInt.fromI32(0)
    stats.createdAt = timestamp
    stats.save()
  }
  return stats as CreatorStats
}

export function handleDeluluCreated(event: DeluluCreatedEvent): void {
  let userId = event.params.creator
  let user = getOrCreateUser(userId, event.block.timestamp)

  // Creator stats: increment total goals and initialize support
  let stats = getOrCreateCreatorStats(userId, event.block.timestamp)
  stats.totalGoals = stats.totalGoals.plus(BigInt.fromI32(1))
  stats.totalSupportCollected = stats.totalSupportCollected.plus(
    event.params.initialSupport
  )
  stats.save()

  let deluluId = event.params.deluluId.toString()
  let delulu = new Delulu(deluluId)

  delulu.onChainId = event.params.deluluId
  delulu.creator = userId
  delulu.creatorAddress = event.params.creator.toHexString()
  delulu.contentHash = event.params.contentHash
  delulu.token = event.params.token
  delulu.stakingDeadline = event.params.stakingDeadline
  delulu.resolutionDeadline = event.params.resolutionDeadline
  delulu.createdAt = event.block.timestamp

  // Financial data from event
  delulu.creatorStake = event.params.initialSupport
  delulu.totalSupportCollected = event.params.totalSupportCollected
  // totalG = creatorStake + supporter stakes; used for leaderboard ordering
  delulu.totalG = event.params.initialSupport.plus(event.params.totalSupportCollected)
  delulu.totalSupporters = event.params.totalSupporters

  // v3: best-effort read of live creator stake state (mapping-based)
  let contract = DeluluMarketContract.bind(event.address)
  let marketIsStakedResult = contract.try_marketIsStaked(event.params.deluluId)
  if (!marketIsStakedResult.reverted) {
    delulu.creatorIsStaked = marketIsStakedResult.value
  }
  let marketStakeResult = contract.try_marketStakedAmount(event.params.deluluId)
  if (!marketStakeResult.reverted) {
    delulu.creatorStakeCurrent = marketStakeResult.value
  }

  // Initialize status fields
  delulu.isResolved = false
  delulu.isCancelled = false
  delulu.rewardClaimed = false
  delulu.challengeRewardClaimed = false
  delulu.shareSupply = BigInt.fromI32(0)
  delulu.tradeCount = BigInt.fromI32(0)
  delulu.uniqueBuyerCount = BigInt.fromI32(0)
  

  delulu.milestoneCount = BigInt.fromI32(0)
  delulu.save()
}

function getOrCreateShareHolding(deluluId: string, userId: Bytes, timestamp: BigInt): ShareHolding {
  const id = deluluId + "-" + userId.toHexString()
  let holding = ShareHolding.load(id)
  if (holding == null) {
    holding = new ShareHolding(id)
    holding.delulu = deluluId
    holding.user = userId
    holding.balance = BigInt.fromI32(0)
    holding.hasEverBought = false
  }
  holding.updatedAt = timestamp
  return holding as ShareHolding
}

export function handleSharesBought(event: SharesBoughtEvent): void {
  const deluluId = event.params.deluluId.toString()
  const userId = event.params.buyer
  const user = getOrCreateUser(userId, event.block.timestamp)

  const delulu = Delulu.load(deluluId)
  if (delulu == null) return

  delulu.shareSupply = delulu.shareSupply.plus(event.params.amount)
  delulu.tradeCount = delulu.tradeCount.plus(BigInt.fromI32(1))

  const holding = getOrCreateShareHolding(deluluId, userId, event.block.timestamp)

  // Increment uniqueBuyerCount only on the buyer's first-ever purchase.
  if (!holding.hasEverBought) {
    holding.hasEverBought = true
    delulu.uniqueBuyerCount = delulu.uniqueBuyerCount.plus(BigInt.fromI32(1))
  }

  delulu.save()

  holding.balance = holding.balance.plus(event.params.amount)
  holding.save()

  const tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const trade = new ShareTrade(tradeId)
  trade.delulu = deluluId
  trade.user = user.id
  trade.isBuy = true
  trade.amount = event.params.amount
  trade.curveAmount = event.params.curveCost
  trade.protocolFee = event.params.protocolFee
  trade.creatorFee = event.params.creatorFee
  trade.txHash = event.transaction.hash
  trade.createdAt = event.block.timestamp
  trade.save()
}

export function handleSharesSold(event: SharesSoldEvent): void {
  const deluluId = event.params.deluluId.toString()
  const userId = event.params.seller
  const user = getOrCreateUser(userId, event.block.timestamp)

  const delulu = Delulu.load(deluluId)
  if (delulu == null) return

  delulu.shareSupply = delulu.shareSupply.minus(event.params.amount)
  delulu.tradeCount = delulu.tradeCount.plus(BigInt.fromI32(1))
  delulu.save()

  const holding = getOrCreateShareHolding(deluluId, userId, event.block.timestamp)
  holding.balance = holding.balance.minus(event.params.amount)
  holding.save()

  const tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const trade = new ShareTrade(tradeId)
  trade.delulu = deluluId
  trade.user = user.id
  trade.isBuy = false
  trade.amount = event.params.amount
  trade.curveAmount = event.params.curveProceeds
  trade.protocolFee = event.params.protocolFee
  trade.creatorFee = event.params.creatorFee
  trade.txHash = event.transaction.hash
  trade.createdAt = event.block.timestamp
  trade.save()
}

export function handleTipPointsAwarded(event: TipPointsAwardedEvent): void {
  let creator = getOrCreateUser(event.params.creator, event.block.timestamp)
  creator.deluluPoints = event.params.totalPoints
  creator.save()

  let stats = getOrCreateCreatorStats(event.params.creator, event.block.timestamp)
  stats.totalTipsReceived = stats.totalTipsReceived.plus(BigInt.fromI32(1))
  stats.totalTipPoints = stats.totalTipPoints.plus(event.params.points)
  stats.save()
}

export function handleEarlyCompletionBonus(event: EarlyCompletionBonusEvent): void {
  let milestoneEntityId = event.params.deluluId.toString() + "-" + event.params.milestoneId.toString()
  let milestone = Milestone.load(milestoneEntityId)
  if (milestone == null) return
  milestone.earlyCompletionBonus = event.params.points
  milestone.save()
}

export function handleStreakBonus(event: StreakBonusEvent): void {
  let milestoneEntityId = event.params.deluluId.toString() + "-" + event.params.milestoneId.toString()
  let milestone = Milestone.load(milestoneEntityId)
  if (milestone == null) return
  milestone.streakBonus = event.params.points
  milestone.save()
}

export function handleGoalFailed(event: GoalFailedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu == null) return

  delulu.isFailed = true
  delulu.isResolved = true
  delulu.failedStakePool = event.params.stakedAmountAllocatedToSupporters
  delulu.save()

  let stats = getOrCreateCreatorStats(delulu.creator as Bytes, event.block.timestamp)
  stats.failedGoals = stats.failedGoals.plus(BigInt.fromI32(1))
  stats.save()
}

export function handleSupportClaimed(event: SupportClaimedEvent): void {
  let userId = event.params.creator
  let user = getOrCreateUser(userId, event.block.timestamp)

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu != null) {
    delulu.rewardClaimed = true
     // v3: after claim, creator live stake should be zero; refresh mapping (best-effort)
     let contract = DeluluMarketContract.bind(event.address)
     let stakeRes = contract.try_marketStakedAmount(event.params.deluluId)
     if (!stakeRes.reverted) {
       delulu.creatorStakeCurrent = stakeRes.value
     }
    delulu.save()
  }

  let claimId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString()
  let claim = new Claim(claimId)

  claim.delulu = deluluId
  claim.user = userId
  claim.amount = event.params.netSupport
  claim.claimType = "support"
  claim.txHash = event.transaction.hash
  claim.createdAt = event.block.timestamp

  claim.save()
}

export function handleChallengeRewardClaimed(event: ChallengeRewardClaimedEvent): void {
  let userId = event.params.creator
  let user = getOrCreateUser(userId, event.block.timestamp)

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu != null) {
    delulu.challengeRewardClaimed = true
    delulu.save()
  }

  let claimId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString()
  let claim = new Claim(claimId)

  claim.delulu = deluluId
  claim.user = userId
  claim.amount = event.params.netReward
  claim.claimType = "challenge"
  claim.txHash = event.transaction.hash
  claim.createdAt = event.block.timestamp

  claim.save()
}

export function handleProfileUpdated(event: ProfileUpdatedEvent): void {
  let userId = event.params.user
  let user = getOrCreateUser(userId, event.block.timestamp)
  user.username = event.params.username
  user.save()

  // Ensure CreatorStats exists so this user appears in the global leaderboard
  // even with 0 goals/milestones (as long as they set their profile)
  let _ = getOrCreateCreatorStats(userId, event.block.timestamp)
}

export function handleMilestonesAdded(event: MilestonesAddedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    // Previous count before this event
    let previousCount = delulu.milestoneCount
    let newCount = event.params.count

    // Creator stats: track total milestones created
    let addedCount = newCount.minus(previousCount)
    let creatorStats = getOrCreateCreatorStats(
      delulu.creator as Bytes,
      event.block.timestamp
    )
    creatorStats.totalMilestones = creatorStats.totalMilestones.plus(addedCount)
    creatorStats.save()

    delulu.milestoneCount = newCount
    delulu.save()
  }
}

// New: purely event-driven milestone creation with full static config
export function handleMilestoneCreatedDetailed(
  event: MilestoneCreatedDetailedEvent
): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu == null) {
    return
  }

  let milestoneIndex = event.params.milestoneId
  let milestoneEntityId = deluluId + "-" + milestoneIndex.toString()
  let milestone = new Milestone(milestoneEntityId)

  milestone.delulu = deluluId
  milestone.milestoneId = milestoneIndex
  milestone.creator = delulu.creator
  milestone.descriptionHash = event.params.descriptionHash
  milestone.milestoneURI = event.params.uri
  milestone.startTime = event.params.startTime
  milestone.deadline = event.params.deadline

  // Initial defaults – dynamic fields will be updated by later events
  milestone.tippingWindowStart = null
  milestone.tippingWindowEnd = null
  milestone.isMissed = false
  milestone.proofLink = null
  milestone.isSubmitted = false
  milestone.isVerified = false
  milestone.pointsEarned = BigInt.fromI32(0)
  milestone.totalSupport = null
  milestone.tipCount = BigInt.fromI32(0)
  milestone.totalTipSupport = BigInt.fromI32(0)
  milestone.earlyCompletionBonus = null
  milestone.streakBonus = null
  milestone.submittedAt = null
  milestone.verifiedAt = null
  milestone.rejectedAt = null
  milestone.rejectionReason = null
  milestone.isDeleted = false

  milestone.save()
}

export function handleMilestoneDeleted(event: MilestoneDeletedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let milestoneEntityId = deluluId + "-" + event.params.milestoneId.toString()
  let milestone = Milestone.load(milestoneEntityId)

  if (milestone == null) {
    return
  }

  milestone.isDeleted = true
  milestone.save()
}

export function handleMilestoneSubmitted(event: MilestoneSubmittedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu == null) {
    return
  }

  let milestoneId = deluluId + "-" + event.params.milestoneId.toString()
  let milestone = Milestone.load(milestoneId)

  if (milestone == null) {
    milestone = new Milestone(milestoneId)
    milestone.delulu = deluluId
    milestone.milestoneId = event.params.milestoneId
    milestone.creator = delulu.creator
    milestone.descriptionHash = Bytes.fromI32(0) // Will be updated from on-chain data
    milestone.deadline = BigInt.fromI32(0) // Will be updated from on-chain data
    milestone.proofLink = null
    milestone.pointsEarned = BigInt.fromI32(0)
    milestone.isVerified = false
    milestone.isDeleted = false
    milestone.tipCount = BigInt.fromI32(0)
    milestone.totalTipSupport = BigInt.fromI32(0)
    milestone.rejectedAt = null
    milestone.rejectionReason = null
    milestone.submittedAt = null
    milestone.verifiedAt = null
  }

  milestone.proofLink = event.params.proofLink
  milestone.isSubmitted = true
  milestone.isVerified = true
  milestone.submittedAt = event.block.timestamp
  milestone.verifiedAt = event.block.timestamp
  milestone.save()
}

export function handleTipExecuted(event: TipExecutedEvent): void {
  let deluluId = event.params.data.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu == null) return

  let tipper = getOrCreateUser(event.params.data.tipper, event.block.timestamp)

  // Update delulu support totals
  delulu.totalSupportCollected = delulu.totalSupportCollected.plus(event.params.data.amount)
  delulu.totalG = delulu.totalG.plus(event.params.data.amount)
  delulu.totalSupporters = delulu.totalSupporters.plus(BigInt.fromI32(1))
  delulu.save()

  // Update milestone tip aggregates
  let milestoneEntityId = deluluId + "-" + event.params.data.milestoneId.toString()
  let milestone = Milestone.load(milestoneEntityId)
  if (milestone != null) {
    milestone.totalTipSupport = milestone.totalTipSupport.plus(event.params.data.amount)
    milestone.tipCount = milestone.tipCount.plus(BigInt.fromI32(1))
    milestone.save()
  }

  // Creator stats
  let stats = getOrCreateCreatorStats(delulu.creator as Bytes, event.block.timestamp)
  stats.totalSupportCollected = stats.totalSupportCollected.plus(event.params.data.amount)
  stats.save()

  // Record the tip
  let tipId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let tip = new Tip(tipId)
  tip.delulu = deluluId
  tip.tipper = tipper.id
  tip.milestoneId = event.params.data.milestoneId
  tip.amount = event.params.data.amount
  tip.isScout = event.params.data.isScout
  tip.txHash = event.transaction.hash
  tip.createdAt = event.block.timestamp
  tip.save()
}

export function handleMilestoneVerified(event: MilestoneVerifiedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu == null) {
    return
  }

  let milestoneId = deluluId + "-" + event.params.milestoneId.toString()
  let milestone = Milestone.load(milestoneId)

  if (milestone == null) {
    milestone = new Milestone(milestoneId)
    milestone.delulu = deluluId
    milestone.milestoneId = event.params.milestoneId
    milestone.creator = delulu.creator
    milestone.descriptionHash = Bytes.fromI32(0)
    milestone.deadline = BigInt.fromI32(0)
    milestone.proofLink = null
    milestone.isSubmitted = false
    milestone.isDeleted = false
    milestone.pointsEarned = BigInt.fromI32(0)
    milestone.tipCount = BigInt.fromI32(0)
    milestone.totalTipSupport = BigInt.fromI32(0)
    milestone.rejectedAt = null
    milestone.rejectionReason = null
    milestone.submittedAt = null
    milestone.verifiedAt = null
  }

  milestone.isVerified = true
  milestone.pointsEarned = event.params.pointsEarned
  milestone.verifiedAt = event.block.timestamp

  // v3: refresh tipping window / missed from mappings (best-effort)
  let contract = DeluluMarketContract.bind(event.address)
  let startRes = contract.try_milestoneStartTime(delulu.onChainId, event.params.milestoneId)
  if (!startRes.reverted) {
    milestone.startTime = startRes.value
  }
  let tipStartRes = contract.try_milestoneTippingStart(delulu.onChainId, event.params.milestoneId)
  if (!tipStartRes.reverted) {
    milestone.tippingWindowStart = tipStartRes.value
  }
  let tipEndRes = contract.try_milestoneTippingEnd(delulu.onChainId, event.params.milestoneId)
  if (!tipEndRes.reverted) {
    milestone.tippingWindowEnd = tipEndRes.value
  }
  let missedRes = contract.try_milestoneIsMissed(delulu.onChainId, event.params.milestoneId)
  if (!missedRes.reverted) {
    milestone.isMissed = missedRes.value
  }

  // Update user points
  let user = User.load(delulu.creator)
  if (user != null) {
    user.deluluPoints = user.deluluPoints.plus(event.params.pointsEarned)
    user.save()
  }

  // Creator stats: count verified milestones
  let stats = getOrCreateCreatorStats(
    delulu.creator as Bytes,
    event.block.timestamp
  )
  stats.verifiedMilestones = stats.verifiedMilestones.plus(
    BigInt.fromI32(1)
  )
  stats.save()

  milestone.save()
}

export function handleChallengeCreated(event: ChallengeCreatedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let challenge = new Challenge(challengeId)

  // All data now comes from the event
  challenge.challengeId = event.params.challengeId
  challenge.contentHash = event.params.contentHash
  challenge.poolAmount = event.params.poolAmount
  challenge.startTime = event.params.startTime
  challenge.duration = event.params.duration
  challenge.totalPoints = BigInt.fromI32(0) // Will be updated when points are allocated
  challenge.active = true
  challenge.createdAt = event.block.timestamp

  challenge.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
}

export function handlePaused(event: PausedEvent): void {
}

export function handleUnpaused(event: UnpausedEvent): void {
}

export function handleDeluluJoinedChallenge(event: DeluluJoinedChallengeEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.challengeId = event.params.challengeId
    delulu.save()
  }
}

export function handlePointsAllocated(event: PointsAllocatedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.points = event.params.points
    // v3: refresh pro‑rata pool totals if available (best-effort)
    let contract = DeluluMarketContract.bind(event.address)
    let poolRes = contract.try_failedStakePool(event.params.deluluId)
    if (!poolRes.reverted) {
      delulu.failedStakePool = poolRes.value
    }
    let totalRes = contract.try_totalSupportForProRata(event.params.deluluId)
    if (!totalRes.reverted) {
      delulu.totalSupportForProRata = totalRes.value
    }
    delulu.save()

    // Note: Challenge totalPoints can be calculated from aggregating delulu points
    // We'll skip updating it here to avoid AssemblyScript nullable type issues
  }
}
