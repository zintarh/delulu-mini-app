import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  DeluluCancelled,
  DeluluCreated,
  DeluluResolved,
  EmergencyRefund,
  OwnershipTransferred,
  Paused,
  StakePlaced,
  Unpaused,
  WinningsClaimed
} from "../generated/DeluluMarket/DeluluMarket"

export function createDeluluCancelledEvent(
  deluluId: BigInt,
  cancelledBy: Address
): DeluluCancelled {
  let deluluCancelledEvent = changetype<DeluluCancelled>(newMockEvent())

  deluluCancelledEvent.parameters = []

  deluluCancelledEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  deluluCancelledEvent.parameters.push(
    new ethereum.EventParam(
      "cancelledBy",
      ethereum.Value.fromAddress(cancelledBy)
    )
  )

  return deluluCancelledEvent
}

export function createDeluluCreatedEvent(
  deluluId: BigInt,
  creator: Address,
  contentHash: string,
  stakingDeadline: BigInt,
  resolutionDeadline: BigInt,
  creatorStake: BigInt
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
  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "stakingDeadline",
      ethereum.Value.fromUnsignedBigInt(stakingDeadline)
    )
  )
  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "resolutionDeadline",
      ethereum.Value.fromUnsignedBigInt(resolutionDeadline)
    )
  )
  deluluCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "creatorStake",
      ethereum.Value.fromUnsignedBigInt(creatorStake)
    )
  )

  return deluluCreatedEvent
}

export function createDeluluResolvedEvent(
  deluluId: BigInt,
  outcome: boolean,
  winningPool: BigInt,
  losingPool: BigInt
): DeluluResolved {
  let deluluResolvedEvent = changetype<DeluluResolved>(newMockEvent())

  deluluResolvedEvent.parameters = []

  deluluResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  deluluResolvedEvent.parameters.push(
    new ethereum.EventParam("outcome", ethereum.Value.fromBoolean(outcome))
  )
  deluluResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "winningPool",
      ethereum.Value.fromUnsignedBigInt(winningPool)
    )
  )
  deluluResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "losingPool",
      ethereum.Value.fromUnsignedBigInt(losingPool)
    )
  )

  return deluluResolvedEvent
}

export function createEmergencyRefundEvent(
  deluluId: BigInt,
  user: Address,
  amount: BigInt
): EmergencyRefund {
  let emergencyRefundEvent = changetype<EmergencyRefund>(newMockEvent())

  emergencyRefundEvent.parameters = []

  emergencyRefundEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  emergencyRefundEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  emergencyRefundEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return emergencyRefundEvent
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

export function createStakePlacedEvent(
  deluluId: BigInt,
  user: Address,
  amount: BigInt,
  side: boolean,
  newTotalPoolStake: BigInt
): StakePlaced {
  let stakePlacedEvent = changetype<StakePlaced>(newMockEvent())

  stakePlacedEvent.parameters = []

  stakePlacedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  stakePlacedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  stakePlacedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  stakePlacedEvent.parameters.push(
    new ethereum.EventParam("side", ethereum.Value.fromBoolean(side))
  )
  stakePlacedEvent.parameters.push(
    new ethereum.EventParam(
      "newTotalPoolStake",
      ethereum.Value.fromUnsignedBigInt(newTotalPoolStake)
    )
  )

  return stakePlacedEvent
}

export function createUnpausedEvent(account: Address): Unpaused {
  let unpausedEvent = changetype<Unpaused>(newMockEvent())

  unpausedEvent.parameters = []

  unpausedEvent.parameters.push(
    new ethereum.EventParam("account", ethereum.Value.fromAddress(account))
  )

  return unpausedEvent
}

export function createWinningsClaimedEvent(
  deluluId: BigInt,
  user: Address,
  payout: BigInt
): WinningsClaimed {
  let winningsClaimedEvent = changetype<WinningsClaimed>(newMockEvent())

  winningsClaimedEvent.parameters = []

  winningsClaimedEvent.parameters.push(
    new ethereum.EventParam(
      "deluluId",
      ethereum.Value.fromUnsignedBigInt(deluluId)
    )
  )
  winningsClaimedEvent.parameters.push(
    new ethereum.EventParam("user", ethereum.Value.fromAddress(user))
  )
  winningsClaimedEvent.parameters.push(
    new ethereum.EventParam("payout", ethereum.Value.fromUnsignedBigInt(payout))
  )

  return winningsClaimedEvent
}
