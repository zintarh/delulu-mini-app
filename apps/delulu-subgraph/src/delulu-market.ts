import {
  DeluluCancelled as DeluluCancelledEvent,
  DeluluCreated as DeluluCreatedEvent,
  DeluluResolved as DeluluResolvedEvent,
  EmergencyRefund as EmergencyRefundEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  StakePlaced as StakePlacedEvent,
  Unpaused as UnpausedEvent,
  WinningsClaimed as WinningsClaimedEvent
} from "../generated/DeluluMarket/DeluluMarket"
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
} from "../generated/schema"

export function handleDeluluCancelled(event: DeluluCancelledEvent): void {
  let entity = new DeluluCancelled(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.cancelledBy = event.params.cancelledBy

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDeluluCreated(event: DeluluCreatedEvent): void {
  let entity = new DeluluCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.creator = event.params.creator
  entity.contentHash = event.params.contentHash
  entity.stakingDeadline = event.params.stakingDeadline
  entity.resolutionDeadline = event.params.resolutionDeadline
  entity.creatorStake = event.params.creatorStake

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleDeluluResolved(event: DeluluResolvedEvent): void {
  let entity = new DeluluResolved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.outcome = event.params.outcome
  entity.winningPool = event.params.winningPool
  entity.losingPool = event.params.losingPool

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleEmergencyRefund(event: EmergencyRefundEvent): void {
  let entity = new EmergencyRefund(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.user = event.params.user
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePaused(event: PausedEvent): void {
  let entity = new Paused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.account = event.params.account

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleStakePlaced(event: StakePlacedEvent): void {
  let entity = new StakePlaced(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.user = event.params.user
  entity.amount = event.params.amount
  entity.side = event.params.side
  entity.newTotalPoolStake = event.params.newTotalPoolStake

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUnpaused(event: UnpausedEvent): void {
  let entity = new Unpaused(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.account = event.params.account

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleWinningsClaimed(event: WinningsClaimedEvent): void {
  let entity = new WinningsClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.deluluId = event.params.deluluId
  entity.user = event.params.user
  entity.payout = event.params.payout

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
