import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  CommunityChallengeCreated as CommunityChallengeCreatedEvent,
  CommunityCampaignPaidConfigured as CommunityCampaignPaidConfiguredEvent,
  CommunityCampaignMilestonesAdded as CommunityCampaignMilestonesAddedEvent,
  CommunityCampaignJoined as CommunityCampaignJoinedEvent,
  CommunityCampaignMilestoneProofSubmitted as CommunityCampaignMilestoneProofSubmittedEvent,
  CommunityChallengeFunded as CommunityChallengeFundedEvent,
  CommunityChallengeEnded as CommunityChallengeEndedEvent,
  CommunityMarketV1 as CommunityMarketV1Contract,
} from "../generated/CommunityMarketV1/CommunityMarketV1"
import {
  Challenge,
  CommunityCampaignParticipant,
  CommunityCampaignMilestone,
  CommunityCampaignMilestoneCompletion,
  User,
} from "../generated/schema"

// Entity IDs for CommunityMarketV1 are prefixed with "cm1-" to avoid
// collisions with challenges indexed from the DeluluMarket proxy.
function cmId(campaignId: BigInt): string {
  return "cm1-" + campaignId.toString()
}

function cmParticipantId(campaignId: BigInt, participant: Bytes): string {
  return "cm1-" + campaignId.toString() + "-" + participant.toHexString().toLowerCase()
}

function cmMilestoneId(campaignId: BigInt, milestoneId: BigInt): string {
  return "cm1-" + campaignId.toString() + "-" + milestoneId.toString()
}

function getOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let id = address.toHexString().toLowerCase()
  let user = User.load(Bytes.fromHexString(id))
  if (user == null) {
    user = new User(Bytes.fromHexString(id))
    user.totalStaked = BigInt.fromI32(0)
    user.deluluPoints = BigInt.fromI32(0)
    user.save()
  }
  return user
}

export function handleCMv1ChallengeCreated(event: CommunityChallengeCreatedEvent): void {
  let id = cmId(event.params.campaignId)
  let challenge = new Challenge(id)
  challenge.challengeId    = event.params.campaignId
  challenge.contentHash    = event.params.contentHash
  challenge.poolAmount     = BigInt.fromI32(0)
  challenge.startTime      = event.block.timestamp
  challenge.duration       = event.params.duration
  challenge.totalPoints    = BigInt.fromI32(0)
  challenge.active         = true
  challenge.createdAt      = event.block.timestamp
  challenge.isCommunity    = true
  challenge.isEnded        = false
  challenge.endedAt        = null
  challenge.proofIntervalSeconds = event.params.proofIntervalSeconds
  challenge.milestoneCount = BigInt.fromI32(0)
  challenge.isPaid         = false
  challenge.joinToken      = null
  challenge.joinAmount     = BigInt.fromI32(0)
  challenge.forfeitPct     = 0
  challenge.forfeitPool    = BigInt.fromI32(0)
  challenge.save()
}

export function handleCMv1PaidConfigured(event: CommunityCampaignPaidConfiguredEvent): void {
  let id = cmId(event.params.campaignId)
  let challenge = Challenge.load(id)
  if (challenge == null) return
  challenge.isPaid     = event.params.isPaid
  challenge.joinToken  = event.params.isPaid ? event.params.joinToken : null
  challenge.joinAmount = event.params.isPaid ? event.params.joinAmount : BigInt.fromI32(0)
  challenge.forfeitPct = event.params.isPaid ? event.params.forfeitPct : 0
  challenge.save()
}

export function handleCMv1MilestonesAdded(event: CommunityCampaignMilestonesAddedEvent): void {
  let campaignId = event.params.campaignId
  let id = cmId(campaignId)
  let challenge = Challenge.load(id)
  if (challenge == null) return

  let contract = CommunityMarketV1Contract.bind(event.address)
  let previousCount = challenge.milestoneCount.toI32()
  let newCount = event.params.milestoneCount.toI32()

  for (let i = previousCount; i < newCount; i++) {
    let mId = BigInt.fromI32(i)
    let milestoneEntityId = cmMilestoneId(campaignId, mId)
    if (CommunityCampaignMilestone.load(milestoneEntityId) != null) continue

    let milestone = new CommunityCampaignMilestone(milestoneEntityId)
    milestone.challenge    = id
    milestone.challengeId  = campaignId
    milestone.milestoneId  = mId
    milestone.milestoneURI = contract.campaignMilestoneURI(campaignId, mId)
    milestone.startTime    = contract.campaignMilestoneStartTime(campaignId, mId)
    milestone.deadline     = contract.campaignMilestoneDeadline(campaignId, mId)
    milestone.createdAt    = event.block.timestamp
    milestone.save()
  }

  challenge.milestoneCount = BigInt.fromI32(newCount)
  challenge.save()
}

export function handleCMv1CampaignJoined(event: CommunityCampaignJoinedEvent): void {
  let campaignId = event.params.campaignId
  let participantAddress = event.params.participant
  let user = getOrCreateUser(participantAddress, event.block.timestamp)
  let participantEntityId = cmParticipantId(campaignId, participantAddress)

  let contract = CommunityMarketV1Contract.bind(event.address)
  let stake = contract.participantStake(campaignId, participantAddress)

  let participant = CommunityCampaignParticipant.load(participantEntityId)
  if (participant == null) {
    participant = new CommunityCampaignParticipant(participantEntityId)
    participant.challenge                = cmId(campaignId)
    participant.challengeId              = campaignId
    participant.participant              = user.id
    participant.participantAddress       = participantAddress.toHexString().toLowerCase()
    participant.pointsTotal              = BigInt.fromI32(0)
    participant.completedMilestoneCount  = BigInt.fromI32(0)
    participant.streak                   = BigInt.fromI32(0)
    participant.lastProofAt              = null
    participant.joinedAt                 = event.block.timestamp
    participant.stakeAmount              = stake
    participant.forfeitedAmount          = BigInt.fromI32(0)
  } else {
    participant.stakeAmount = stake
  }
  participant.save()
}

export function handleCMv1MilestoneProofSubmitted(
  event: CommunityCampaignMilestoneProofSubmittedEvent
): void {
  let campaignId = event.params.campaignId
  let milestoneId = event.params.milestoneId
  let participantAddress = event.params.participant
  let user = getOrCreateUser(participantAddress, event.block.timestamp)

  let participantEntityId = cmParticipantId(campaignId, participantAddress)
  let participant = CommunityCampaignParticipant.load(participantEntityId)
  if (participant == null) {
    participant = new CommunityCampaignParticipant(participantEntityId)
    participant.challenge               = cmId(campaignId)
    participant.challengeId             = campaignId
    participant.participant             = user.id
    participant.participantAddress      = participantAddress.toHexString().toLowerCase()
    participant.pointsTotal             = BigInt.fromI32(0)
    participant.completedMilestoneCount = BigInt.fromI32(0)
    participant.streak                  = BigInt.fromI32(0)
    participant.joinedAt                = event.block.timestamp
    participant.stakeAmount             = BigInt.fromI32(0)
    participant.forfeitedAmount         = BigInt.fromI32(0)
  }
  participant.pointsTotal             = event.params.pointsTotal
  participant.completedMilestoneCount = participant.completedMilestoneCount.plus(BigInt.fromI32(1))
  participant.streak                  = participant.completedMilestoneCount
  participant.lastProofAt             = event.block.timestamp
  participant.save()

  let challenge = Challenge.load(cmId(campaignId))
  if (challenge != null) {
    challenge.totalPoints = challenge.totalPoints.plus(event.params.pointsAwarded)
    challenge.save()
  }

  let completionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let completion = new CommunityCampaignMilestoneCompletion(completionId)
  completion.challenge         = cmId(campaignId)
  completion.challengeId       = campaignId
  completion.milestone         = cmMilestoneId(campaignId, milestoneId)
  completion.milestoneId       = milestoneId
  completion.participant       = user.id
  completion.participantAddress = participantAddress.toHexString().toLowerCase()
  completion.proofLink         = event.params.proofLink
  completion.pointsAwarded     = event.params.pointsAwarded
  completion.pointsTotal       = event.params.pointsTotal
  completion.txHash            = event.transaction.hash
  completion.createdAt         = event.block.timestamp
  completion.save()
}

export function handleCMv1ChallengeFunded(event: CommunityChallengeFundedEvent): void {
  let challenge = Challenge.load(cmId(event.params.campaignId))
  if (challenge == null) return
  challenge.poolAmount = event.params.totalPool
  challenge.save()
}

export function handleCMv1ChallengeEnded(event: CommunityChallengeEndedEvent): void {
  let challenge = Challenge.load(cmId(event.params.campaignId))
  if (challenge == null) return
  challenge.isEnded = true
  challenge.endedAt = event.params.endedAt
  challenge.active  = false
  challenge.save()
}
