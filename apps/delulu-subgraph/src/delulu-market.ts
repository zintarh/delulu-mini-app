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
  CommunityChallengeCreated as CommunityChallengeCreatedEvent,
  CommunityCampaignJoined as CommunityCampaignJoinedEvent,
  CommunityProofSubmitted as CommunityProofSubmittedEvent,
  CommunityChallengeFunded as CommunityChallengeFundedEvent,
  CommunityChallengeEnded as CommunityChallengeEndedEvent,
  CommunityCampaignMilestonesAdded as CommunityCampaignMilestonesAddedEvent,
  CommunityCampaignMilestoneProofSubmitted as CommunityCampaignMilestoneProofSubmittedEvent,
  DeluluMarket as DeluluMarketContract
} from "../generated/DeluluMarket/DeluluMarket"
import { User, Delulu, Claim, Milestone, Challenge, CreatorStats, ShareTrade, ShareHolding, Tip, CommunityCampaignParticipant, CommunityProof, CommunityCampaignMilestone, CommunityCampaignMilestoneCompletion } from "../generated/schema"

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

  delulu.creatorStake = event.params.initialSupport
  delulu.totalSupportCollected = event.params.totalSupportCollected
  delulu.totalG = event.params.initialSupport.plus(event.params.totalSupportCollected)
  delulu.totalSupporters = event.params.totalSupporters

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


  let _ = getOrCreateCreatorStats(userId, event.block.timestamp)
}

export function handleMilestonesAdded(event: MilestonesAddedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    let previousCount = delulu.milestoneCount
    let newCount = event.params.count

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
    milestone.descriptionHash = Bytes.fromI32(0) 
    milestone.deadline = BigInt.fromI32(0) 
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

  delulu.totalSupportCollected = delulu.totalSupportCollected.plus(event.params.data.amount)
  delulu.totalG = delulu.totalG.plus(event.params.data.amount)
  delulu.totalSupporters = delulu.totalSupporters.plus(BigInt.fromI32(1))
  delulu.save()

  let milestoneEntityId = deluluId + "-" + event.params.data.milestoneId.toString()
  let milestone = Milestone.load(milestoneEntityId)
  if (milestone != null) {
    milestone.totalTipSupport = milestone.totalTipSupport.plus(event.params.data.amount)
    milestone.tipCount = milestone.tipCount.plus(BigInt.fromI32(1))
    milestone.save()
  }

  let stats = getOrCreateCreatorStats(delulu.creator as Bytes, event.block.timestamp)
  stats.totalSupportCollected = stats.totalSupportCollected.plus(event.params.data.amount)
  stats.save()

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

  let user = User.load(delulu.creator)
  if (user != null) {
    user.deluluPoints = user.deluluPoints.plus(event.params.pointsEarned)
    user.save()
  }

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
  challenge.totalPoints = BigInt.fromI32(0) 
  challenge.active = true
  challenge.createdAt = event.block.timestamp
  challenge.isCommunity = false
  challenge.isEnded = false
  challenge.endedAt = null
  challenge.proofIntervalSeconds = null
  challenge.milestoneCount = BigInt.fromI32(0)
  // Legacy admin challenges are never paid community campaigns
  challenge.isPaid = false
  challenge.joinToken = null
  challenge.joinAmount = BigInt.fromI32(0)
  challenge.forfeitPct = 0
  challenge.forfeitPool = BigInt.fromI32(0)

  challenge.save()
}

export function handleCommunityChallengeCreated(event: CommunityChallengeCreatedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let challenge = Challenge.load(challengeId)
  if (challenge == null) {
    challenge = new Challenge(challengeId)
    challenge.challengeId = event.params.challengeId
    challenge.contentHash = event.params.contentHash
    challenge.poolAmount = BigInt.fromI32(0)
    challenge.startTime = event.block.timestamp
    challenge.duration = event.params.duration
    challenge.totalPoints = BigInt.fromI32(0)
    challenge.active = true
    challenge.createdAt = event.block.timestamp
  }
  challenge.isCommunity = true
  challenge.isEnded = false
  challenge.endedAt = null
  challenge.proofIntervalSeconds = event.params.proofIntervalSeconds
  challenge.milestoneCount = BigInt.fromI32(0)
  // Economics defaults (overwritten by CommunityCampaignPaidConfigured if paid)
  challenge.isPaid = false
  challenge.joinToken = null
  challenge.joinAmount = BigInt.fromI32(0)
  challenge.forfeitPct = 0
  challenge.forfeitPool = BigInt.fromI32(0)
  challenge.save()
}

export function handleCommunityCampaignJoined(event: CommunityCampaignJoinedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let participantAddress = event.params.participant
  let participantId = participantAddress.toHexString().toLowerCase()
  let id = challengeId + "-" + participantId

  let user = getOrCreateUser(participantAddress, event.block.timestamp)
  let participant = CommunityCampaignParticipant.load(id)
  if (participant == null) {
    participant = new CommunityCampaignParticipant(id)
    participant.challenge = challengeId
    participant.challengeId = event.params.challengeId
    participant.participant = user.id
    participant.participantAddress = participantId
    participant.pointsTotal = BigInt.fromI32(0)
    participant.completedMilestoneCount = BigInt.fromI32(0)
    participant.streak = BigInt.fromI32(0)
    participant.lastProofAt = null
    participant.joinedAt = event.block.timestamp
    participant.stakeAmount = BigInt.fromI32(0)
    participant.forfeitedAmount = BigInt.fromI32(0)
  }
  participant.save()
}

export function handleCommunityProofSubmitted(event: CommunityProofSubmittedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let participantAddress = event.params.participant
  let participantId = participantAddress.toHexString().toLowerCase()
  let rowId = challengeId + "-" + participantId

  let user = getOrCreateUser(participantAddress, event.block.timestamp)
  let participant = CommunityCampaignParticipant.load(rowId)
  if (participant == null) {
    participant = new CommunityCampaignParticipant(rowId)
    participant.challenge = challengeId
    participant.challengeId = event.params.challengeId
    participant.participant = user.id
    participant.participantAddress = participantId
    participant.joinedAt = event.block.timestamp
    participant.stakeAmount = BigInt.fromI32(0)
    participant.forfeitedAmount = BigInt.fromI32(0)
  }
  participant.pointsTotal = event.params.pointsTotal
  participant.streak = participant.streak.plus(BigInt.fromI32(1))
  participant.lastProofAt = event.block.timestamp
  participant.save()

  let challenge = Challenge.load(challengeId)
  if (challenge != null) {
    challenge.totalPoints = challenge.totalPoints.plus(event.params.pointsAwarded)
    challenge.save()
  }

  let proofId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let proof = new CommunityProof(proofId)
  proof.challenge = challengeId
  proof.challengeId = event.params.challengeId
  proof.participant = user.id
  proof.participantAddress = participantId
  proof.proofLink = event.params.proofLink
  proof.pointsAwarded = event.params.pointsAwarded
  proof.pointsTotal = event.params.pointsTotal
  proof.txHash = event.transaction.hash
  proof.createdAt = event.block.timestamp
  proof.save()
}

export function handleCommunityChallengeFunded(event: CommunityChallengeFundedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let challenge = Challenge.load(challengeId)
  if (challenge == null) return
  challenge.poolAmount = event.params.totalPool
  challenge.save()
}

export function handleCommunityChallengeEnded(event: CommunityChallengeEndedEvent): void {
  let challengeId = event.params.challengeId.toString()
  let challenge = Challenge.load(challengeId)
  if (challenge == null) return
  challenge.isEnded = true
  challenge.endedAt = event.params.endedAt
  challenge.active = false
  challenge.save()
}

export function handleCommunityCampaignMilestonesAdded(
  event: CommunityCampaignMilestonesAddedEvent
): void {
  let challengeId = event.params.challengeId.toString()
  let challenge = Challenge.load(challengeId)
  if (challenge == null) {
    challenge = new Challenge(challengeId)
    challenge.challengeId = event.params.challengeId
    challenge.contentHash = ""
    challenge.poolAmount = BigInt.fromI32(0)
    challenge.startTime = event.block.timestamp
    challenge.duration = BigInt.fromI32(0)
    challenge.totalPoints = BigInt.fromI32(0)
    challenge.active = true
    challenge.createdAt = event.block.timestamp
    challenge.isCommunity = true
    challenge.isEnded = false
    challenge.endedAt = null
    challenge.proofIntervalSeconds = null
    challenge.milestoneCount = BigInt.fromI32(0)
    challenge.isPaid = false
    challenge.joinToken = null
    challenge.joinAmount = BigInt.fromI32(0)
    challenge.forfeitPct = 0
    challenge.forfeitPool = BigInt.fromI32(0)
  }

  let contract = DeluluMarketContract.bind(event.address)
  let previousCount = challenge.milestoneCount.toI32()
  let newCount = event.params.milestoneCount.toI32()

  for (let i = previousCount; i < newCount; i++) {
    let milestoneId = BigInt.fromI32(i)
    let id = challengeId + "-" + i.toString()
    if (CommunityCampaignMilestone.load(id) != null) continue

    let milestone = new CommunityCampaignMilestone(id)
    milestone.challenge = challengeId
    milestone.challengeId = event.params.challengeId
    milestone.milestoneId = milestoneId
    milestone.milestoneURI = contract.communityChallengeMilestoneURI(
      event.params.challengeId,
      milestoneId
    )
    milestone.startTime = contract.communityChallengeMilestoneStartTime(
      event.params.challengeId,
      milestoneId
    )
    milestone.deadline = contract.communityChallengeMilestoneDeadline(
      event.params.challengeId,
      milestoneId
    )
    milestone.createdAt = event.block.timestamp
    milestone.save()
  }

  challenge.milestoneCount = event.params.milestoneCount
  challenge.save()
}

export function handleCommunityCampaignMilestoneProofSubmitted(
  event: CommunityCampaignMilestoneProofSubmittedEvent
): void {
  let challengeId = event.params.challengeId.toString()
  let milestoneId = event.params.milestoneId
  let participantAddress = event.params.participant
  let participantId = participantAddress.toHexString().toLowerCase()
  let rowId = challengeId + "-" + participantId
  let milestoneRowId = challengeId + "-" + milestoneId.toString()

  let user = getOrCreateUser(participantAddress, event.block.timestamp)
  let participant = CommunityCampaignParticipant.load(rowId)
  if (participant == null) {
    participant = new CommunityCampaignParticipant(rowId)
    participant.challenge = challengeId
    participant.challengeId = event.params.challengeId
    participant.participant = user.id
    participant.participantAddress = participantId
    participant.joinedAt = event.block.timestamp
    participant.completedMilestoneCount = BigInt.fromI32(0)
    participant.streak = BigInt.fromI32(0)
    participant.stakeAmount = BigInt.fromI32(0)
    participant.forfeitedAmount = BigInt.fromI32(0)
  }
  participant.pointsTotal = event.params.pointsTotal
  participant.completedMilestoneCount = participant.completedMilestoneCount.plus(
    BigInt.fromI32(1)
  )
  participant.streak = participant.completedMilestoneCount
  participant.lastProofAt = event.block.timestamp

  // Compute forfeit: count milestones with passed deadlines not completed by this participant
  let challenge = Challenge.load(challengeId)
  if (challenge != null && challenge.isPaid && challenge.forfeitPct > 0 && participant.stakeAmount.gt(BigInt.fromI32(0))) {
    let contract = DeluluMarketContract.bind(event.address)
    let totalMilestones = challenge.milestoneCount.toI32()
    let currentMilestoneId = milestoneId.toI32()
    let missedCount = 0
    for (let i = 0; i < currentMilestoneId; i++) {
      let mId = BigInt.fromI32(i)
      let deadline = contract.communityChallengeMilestoneDeadline(event.params.challengeId, mId)
      if (deadline.lt(event.block.timestamp)) {
        let completed = contract.communityMilestoneCompleted(event.params.challengeId, mId, participantAddress)
        if (!completed) {
          missedCount = missedCount + 1
        }
      }
    }
    // forfeitedAmount = missedCount * stakeAmount * forfeitPct / 100
    let newForfeit = participant.stakeAmount
      .times(BigInt.fromI32(missedCount))
      .times(BigInt.fromI32(challenge.forfeitPct))
      .div(BigInt.fromI32(100))
    let delta = newForfeit.minus(participant.forfeitedAmount)
    if (delta.gt(BigInt.fromI32(0))) {
      participant.forfeitedAmount = newForfeit
      challenge.forfeitPool = challenge.forfeitPool.plus(delta)
      challenge.save()
    }
    let _ = totalMilestones // suppress unused warning
  }

  participant.save()

  // Update challenge total points (challenge may already be loaded/saved by forfeit block above)
  let challengeForPoints = Challenge.load(challengeId)
  if (challengeForPoints != null) {
    challengeForPoints.totalPoints = challengeForPoints.totalPoints.plus(event.params.pointsAwarded)
    challengeForPoints.save()
  }

  let completionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let completion = new CommunityCampaignMilestoneCompletion(completionId)
  completion.challenge = challengeId
  completion.challengeId = event.params.challengeId
  completion.milestone = milestoneRowId
  completion.milestoneId = milestoneId
  completion.participant = user.id
  completion.participantAddress = participantId
  completion.proofLink = event.params.proofLink
  completion.pointsAwarded = event.params.pointsAwarded
  completion.pointsTotal = event.params.pointsTotal
  completion.txHash = event.transaction.hash
  completion.createdAt = event.block.timestamp
  completion.save()
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
