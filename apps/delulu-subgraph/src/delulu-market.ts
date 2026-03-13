import { BigInt, Bytes, store } from "@graphprotocol/graph-ts"
import {
  DeluluCreated as DeluluCreatedEvent,
  DeluluResolved as DeluluResolvedEvent,
  DeluluJoinedChallenge as DeluluJoinedChallengeEvent,
  PointsAllocated as PointsAllocatedEvent,
  SupportStaked as SupportStakedEvent,
  SupportClaimed as SupportClaimedEvent,
  ChallengeRewardClaimed as ChallengeRewardClaimedEvent,
  ProfileUpdated as ProfileUpdatedEvent,
  MilestonesAdded as MilestonesAddedEvent,
  MilestonesReset as MilestonesResetEvent,
  MilestoneDeleted as MilestoneDeletedEvent,
  MilestoneCreatedDetailed as MilestoneCreatedDetailedEvent,
  MilestoneSubmitted as MilestoneSubmittedEvent,
  MilestoneVerified as MilestoneVerifiedEvent,
  MilestoneRejected as MilestoneRejectedEvent,
  ChallengeCreated as ChallengeCreatedEvent,
  TipExecuted as TipExecutedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
  DeluluMarket as DeluluMarketContract
} from "../generated/DeluluMarket/DeluluMarket"
import { User, Delulu, Stake, Claim, Milestone, Challenge, CreatorStats } from "../generated/schema"

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
  
  // Challenge and milestone tracking
  // challengeId and points are nullable - don't set them initially (will be set when needed)
  delulu.milestoneCount = BigInt.fromI32(0)
  delulu.save()
}

export function handleSupportStaked(event: SupportStakedEvent): void {
  let userId = event.params.supporter
  let user = getOrCreateUser(userId, event.block.timestamp)
  user.totalStaked = user.totalStaked.plus(event.params.amount)
  user.save()

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.totalSupportCollected = delulu.totalSupportCollected.plus(event.params.amount)
    delulu.totalSupporters = event.params.totalSupporters
    delulu.save()

    // Creator stats: aggregate total support across all their goals
    let creatorStats = getOrCreateCreatorStats(
      delulu.creator as Bytes,
      event.block.timestamp
    )
    creatorStats.totalSupportCollected = creatorStats.totalSupportCollected.plus(
      event.params.amount
    )
    creatorStats.save()
  }

  let stakeId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString()
  let stake = new Stake(stakeId)

  stake.delulu = deluluId
  stake.user = userId
  stake.amount = event.params.amount
  stake.txHash = event.transaction.hash
  stake.createdAt = event.block.timestamp

  stake.save()
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
    delulu.rewardClaimed = true
    // v3: refresh failed / stake state if needed (best-effort)
    let contract = DeluluMarketContract.bind(event.address)
    let failedRes = contract.try_marketIsFailed(event.params.deluluId)
    if (!failedRes.reverted) {
      delulu.isFailed = failedRes.value
    }
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

export function handleMilestonesReset(event: MilestonesResetEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu == null) {
    return
  }

  // Delete all milestone entities for this delulu
  let milestoneCount = delulu.milestoneCount
  for (let i = 0; i < milestoneCount.toI32(); i++) {
    let milestoneId = deluluId + "-" + i.toString()
    let milestone = Milestone.load(milestoneId)
    if (milestone != null) {
      // Update creator stats: subtract from total milestones
      let creatorStats = getOrCreateCreatorStats(
        delulu.creator as Bytes,
        event.block.timestamp
      )
      if (creatorStats.totalMilestones > BigInt.fromI32(0)) {
        creatorStats.totalMilestones = creatorStats.totalMilestones.minus(BigInt.fromI32(1))
      }
      creatorStats.save()

      // Delete the milestone entity
      store.remove("Milestone", milestoneId)
    }
  }

  // Reset milestone count
  delulu.milestoneCount = BigInt.fromI32(0)
  delulu.save()
}

export function handleMilestoneDeleted(event: MilestoneDeletedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let milestoneId = event.params.milestoneId.toString()
  let milestoneEntityId = deluluId + "-" + milestoneId
  let milestone = Milestone.load(milestoneEntityId)

  if (milestone == null) {
    return
  }

  // Update creator stats: subtract from total milestones
  let delulu = Delulu.load(deluluId)
  if (delulu != null) {
    let creatorStats = getOrCreateCreatorStats(
      delulu.creator as Bytes,
      event.block.timestamp
    )
    if (creatorStats.totalMilestones > BigInt.fromI32(0)) {
      creatorStats.totalMilestones = creatorStats.totalMilestones.minus(BigInt.fromI32(1))
    }
    creatorStats.save()
  }

  // Delete the milestone entity
  store.remove("Milestone", milestoneEntityId)
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
  milestone.submittedAt = null
  milestone.verifiedAt = null
  milestone.rejectedAt = null
  milestone.rejectionReason = null

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
    milestone.rejectedAt = null
    milestone.rejectionReason = null
    milestone.submittedAt = null
    milestone.verifiedAt = null
  }

  milestone.proofLink = event.params.proofLink
  milestone.isSubmitted = true
  milestone.submittedAt = event.block.timestamp
  // v3: refresh tipping window data from mappings (best-effort)
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
  milestone.save()
}

// v3: TipExecuted(TipEventData data) hook (currently a no-op to avoid AS compiler bug)
export function handleTipExecuted(_event: TipExecutedEvent): void {
  // Intentionally left blank; we still register the handler for future use,
  // but avoid any logic that could trigger AssemblyScript edge cases.
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

export function handleMilestoneRejected(event: MilestoneRejectedEvent): void {
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
    milestone.pointsEarned = BigInt.fromI32(0)
    milestone.isVerified = false
  }

  milestone.isSubmitted = false
  milestone.rejectedAt = event.block.timestamp
  milestone.rejectionReason = event.params.reason
  // v3: refresh mapping-based missed flag (best-effort)
  let contract = DeluluMarketContract.bind(event.address)
  let missedRes = contract.try_milestoneIsMissed(delulu.onChainId, event.params.milestoneId)
  if (!missedRes.reverted) {
    milestone.isMissed = missedRes.value
  }
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

export function handleDeluluResolved(event: DeluluResolvedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.isResolved = true
    // v3: refresh failed / finisher window state (best-effort)
    let contract = DeluluMarketContract.bind(event.address)
    let failedRes = contract.try_marketIsFailed(event.params.deluluId)
    if (!failedRes.reverted) {
      delulu.isFailed = failedRes.value
    }
    let finisherRes = contract.try_marketFinisherWindowEnd(event.params.deluluId)
    if (!finisherRes.reverted) {
      delulu.finisherWindowEnd = finisherRes.value
    }
    delulu.save()

    // Creator stats: treat resolved, non-failed goals as completed
    let creatorStats = getOrCreateCreatorStats(
      delulu.creator as Bytes,
      event.block.timestamp
    )
    if (delulu.isFailed) {
      creatorStats.failedGoals = creatorStats.failedGoals.plus(
        BigInt.fromI32(1)
      )
    } else {
      creatorStats.completedGoals = creatorStats.completedGoals.plus(
        BigInt.fromI32(1)
      )
    }
    creatorStats.save()
  }
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
