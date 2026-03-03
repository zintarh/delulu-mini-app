import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  DeluluCreated,
  SupportStaked,
  SupportClaimed,
  ChallengeRewardClaimed,
  ProfileUpdated,
  MilestonesAdded,
  MilestoneSubmitted,
  MilestoneVerified,
  MilestoneRejected,
  ChallengeCreated,
  OwnershipTransferred,
  Paused,
  Unpaused
} from "../generated/DeluluMarket/DeluluMarket"

export function createDeluluCreatedEvent(
  deluluId: BigInt,
  creator: Address,
  contentHash: string
): DeluluCreated {
  let deluluCreatedEvent = changetype<DeluluCreated>(newMockEvent())

  deluluCreatedEvent.parameters = []

  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "contentHash",
      ethereum.Value.fromString(contentHash)
    )
  )

  return deluluCreatedEvent
}

export function createSupportStakedEvent(
  deluluId: BigInt,
  supporter: Address,
  amount: BigInt,
  totalSupporters: BigInt
): SupportStaked {
  let supportStakedEvent = changetype<SupportStaked>(newMockEvent())

  supportStakedEvent.parameters = []

  supportStakedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  supportStakedEvent.parameters.push(
    new ethereum.EventParam("supporter", ethereum.Value.fromAddress(supporter))
  )
  supportStakedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  supportStakedEvent.parameters.push(
    new ethereum.EventParam(
      "totalSupporters",
      ethereum.Value.fromUnsignedBigInt(totalSupporters)
    )
  )

  return supportStakedEvent
}

export function createSupportClaimedEvent(
  deluluId: BigInt,
  creator: Address,
  netSupport: BigInt,
  fee: BigInt
): SupportClaimed {
  let supportClaimedEvent = changetype<SupportClaimed>(newMockEvent())

  supportClaimedEvent.parameters = []

  supportClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  supportClaimedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  supportClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "netSupport",
      ethereum.Value.fromUnsignedBigInt(netSupport)
    )
  )
  supportClaimedEvent.parameters.push(
    new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee))
  )

  return supportClaimedEvent
}

export function createChallengeRewardClaimedEvent(
  challengeId: BigInt,
  deluluId: BigInt,
  creator: Address,
  netReward: BigInt,
  fee: BigInt
): ChallengeRewardClaimed {
  let challengeRewardClaimedEvent = changetype<ChallengeRewardClaimed>(newMockEvent())

  challengeRewardClaimedEvent.parameters = []

  challengeRewardClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "challengeId",
      ethereum.Value.fromUnsignedBigInt(challengeId)
    )
  )
  challengeRewardClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  challengeRewardClaimedEvent.parameters.push(
    new ethereum.EventParam("creator", ethereum.Value.fromAddress(creator))
  )
  challengeRewardClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "netReward",
      ethereum.Value.fromUnsignedBigInt(netReward)
    )
  )
  challengeRewardClaimedEvent.parameters.push(
    new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee))
  )

  return challengeRewardClaimedEvent
}

export function createProfileUpdatedEvent(
  user: Address,
  username: string
): ProfileUpdated {
  let profileUpdatedEvent = changetype<ProfileUpdated>(newMockEvent())

  profileUpdatedEvent.parameters = []

  profileUpdatedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  profileUpdatedEvent.parameters.push(
    new ethereum.EventParam("username", ethereum.Value.fromString(username))
  )

  return profileUpdatedEvent
}

export function createMilestonesAddedEvent(
  deluluId: BigInt,
  count: BigInt
): MilestonesAdded {
  let milestonesAddedEvent = changetype<MilestonesAdded>(newMockEvent())

  milestonesAddedEvent.parameters = []

  milestonesAddedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  milestonesAddedEvent.parameters.push(
    new ethereum.EventParam("count", ethereum.Value.fromUnsignedBigInt(count))
  )

  return milestonesAddedEvent
}

export function createMilestoneSubmittedEvent(
  deluluId: BigInt,
  milestoneId: BigInt,
  proofLink: string
): MilestoneSubmitted {
  let milestoneSubmittedEvent = changetype<MilestoneSubmitted>(newMockEvent())

  milestoneSubmittedEvent.parameters = []

  milestoneSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  milestoneSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "milestoneId",
      ethereum.Value.fromUnsignedBigInt(milestoneId)
    )
  )
  milestoneSubmittedEvent.parameters.push(
    new ethereum.EventParam("proofLink", ethereum.Value.fromString(proofLink))
  )

  return milestoneSubmittedEvent
}

export function createMilestoneVerifiedEvent(
  deluluId: BigInt,
  milestoneId: BigInt,
  pointsEarned: BigInt
): MilestoneVerified {
  let milestoneVerifiedEvent = changetype<MilestoneVerified>(newMockEvent())

  milestoneVerifiedEvent.parameters = []

  milestoneVerifiedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  milestoneVerifiedEvent.parameters.push(
    new ethereum.EventParam(
      "milestoneId",
      ethereum.Value.fromUnsignedBigInt(milestoneId)
    )
  )
  milestoneVerifiedEvent.parameters.push(
    new ethereum.EventParam(
      "pointsEarned",
      ethereum.Value.fromUnsignedBigInt(pointsEarned)
    )
  )

  return milestoneVerifiedEvent
}

export function createMilestoneRejectedEvent(
  deluluId: BigInt,
  milestoneId: BigInt,
  reason: string
): MilestoneRejected {
  let milestoneRejectedEvent = changetype<MilestoneRejected>(newMockEvent())

  milestoneRejectedEvent.parameters = []

  milestoneRejectedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  milestoneRejectedEvent.parameters.push(
    new ethereum.EventParam(
      "milestoneId",
      ethereum.Value.fromUnsignedBigInt(milestoneId)
    )
  )
  milestoneRejectedEvent.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  )

  return milestoneRejectedEvent
}

export function createChallengeCreatedEvent(
  challengeId: BigInt,
  contentHash: string,
  poolAmount: BigInt
): ChallengeCreated {
  let challengeCreatedEvent = changetype<ChallengeCreated>(newMockEvent())

  challengeCreatedEvent.parameters = []

  challengeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "challengeId",
      ethereum.Value.fromUnsignedBigInt(challengeId)
    )
  )
  challengeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "contentHash",
      ethereum.Value.fromString(contentHash)
    )
  )
  challengeCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "poolAmount",
      ethereum.Value.fromUnsignedBigInt(poolAmount)
    )
  )

  return challengeCreatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = []

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPausedEvent(account: Address): Paused {
  let pausedEvent = changetype<Paused>(newMockEvent())

  pausedEvent.parameters = []

  pausedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return pausedEvent
}

export function createUnpausedEvent(account: Address): Unpaused {
  let unpausedEvent = changetype<Unpaused>(newMockEvent())

  unpausedEvent.parameters = []

  unpausedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return unpausedEvent
}

