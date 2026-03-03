import { BigInt, Bytes } from "@graphprotocol/graph-ts"
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
  MilestoneSubmitted as MilestoneSubmittedEvent,
  MilestoneVerified as MilestoneVerifiedEvent,
  MilestoneRejected as MilestoneRejectedEvent,
  ChallengeCreated as ChallengeCreatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
  DeluluMarket as DeluluMarketContract
} from "../generated/DeluluMarket/DeluluMarket"
import { User, Delulu, Stake, Claim, Milestone, Challenge } from "../generated/schema"

export function handleDeluluCreated(event: DeluluCreatedEvent): void {
  let userId = event.params.creator
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.username = null
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
    user.save()
  }

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
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.username = null
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
  }

  user.totalStaked = user.totalStaked.plus(event.params.amount)
  user.save()

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.totalSupportCollected = delulu.totalSupportCollected.plus(event.params.amount)
    delulu.totalSupporters = event.params.totalSupporters
    delulu.save()
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
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.username = null
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
    user.save()
  }

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu != null) {
    delulu.rewardClaimed = true
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
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.username = null
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
    user.save()
  }

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)
  if (delulu != null) {
    delulu.rewardClaimed = true
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
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.metadataHash = null
    user.deluluPoints = BigInt.fromI32(0)
  }

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

    // Bind contract to read on-chain milestone data
    let contract = DeluluMarketContract.bind(event.address)

    // Create Milestone entities for all newly added milestones
    let fromIndex = previousCount.toI32()
    let toIndex = newCount.toI32()

    for (let i = fromIndex; i < toIndex; i++) {
      let milestoneIndex = BigInt.fromI32(i)
      let info = contract.getMilestoneInfo(delulu.onChainId, milestoneIndex)

      let milestoneEntityId = deluluId + "-" + milestoneIndex.toString()
      let milestone = new Milestone(milestoneEntityId)

      milestone.delulu = deluluId
      milestone.milestoneId = milestoneIndex
      milestone.creator = delulu.creator
      milestone.descriptionHash = info.value0
      milestone.deadline = info.value1

      // info.value2 is proofLink (string)
      let proof = info.value2
      milestone.proofLink = proof.length > 0 ? proof : null

      milestone.isSubmitted = info.value3
      milestone.isVerified = info.value4
      milestone.pointsEarned = BigInt.fromI32(0)
      milestone.submittedAt = null
      milestone.verifiedAt = null
      milestone.rejectedAt = null
      milestone.rejectionReason = null

      milestone.save()
    }

    delulu.milestoneCount = newCount
    delulu.save()
  }
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
  milestone.save()
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

  // Update user points
  let user = User.load(delulu.creator)
  if (user != null) {
    user.deluluPoints = user.deluluPoints.plus(event.params.pointsEarned)
    user.save()
  }

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
    delulu.save()
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
    delulu.save()

    // Note: Challenge totalPoints can be calculated from aggregating delulu points
    // We'll skip updating it here to avoid AssemblyScript nullable type issues
  }
}
