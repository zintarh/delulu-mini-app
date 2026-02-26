import { BigInt } from "@graphprotocol/graph-ts"
import {
  DeluluCancelled as DeluluCancelledEvent,
  DeluluCreated as DeluluCreatedEvent,
  DeluluResolved as DeluluResolvedEvent,
  EmergencyRefund as EmergencyRefundEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Paused as PausedEvent,
  ProfileUpdated as ProfileUpdatedEvent,
  SenateUpdated as SenateUpdatedEvent,
  StakePlaced as StakePlacedEvent,
  Unpaused as UnpausedEvent,
  WinningsClaimed as WinningsClaimedEvent
} from "../generated/DeluluMarket/DeluluMarket"
import { User, Delulu, Stake, Claim } from "../generated/schema"

export function handleDeluluCreated(event: DeluluCreatedEvent): void {
  let userId = event.params.creator
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
  }

  user.totalStaked = user.totalStaked.plus(event.params.creatorStake)
  user.save()

  let deluluId = event.params.deluluId.toString()
  let delulu = new Delulu(deluluId)

  delulu.onChainId = event.params.deluluId
  delulu.creator = userId
  delulu.creatorAddress = event.params.creator.toHexString()
  delulu.token = event.params.token
  delulu.contentHash = event.params.contentHash
  delulu.stakingDeadline = event.params.stakingDeadline
  delulu.resolutionDeadline = event.params.resolutionDeadline
  delulu.createdAt = event.block.timestamp
  delulu.creatorStake = event.params.creatorStake
  // IMPORTANT: initialize pools to zero; stakes are added in handleStakePlaced
  delulu.totalBelieverStake = BigInt.fromI32(0)
  delulu.totalDoubterStake = BigInt.fromI32(0)
  delulu.winningPool = BigInt.fromI32(0)
  delulu.losingPool = BigInt.fromI32(0)
  delulu.isResolved = false
  delulu.isCancelled = false

  delulu.save()
}

export function handleStakePlaced(event: StakePlacedEvent): void {
  let userId = event.params.user
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
  }

  user.totalStaked = user.totalStaked.plus(event.params.amount)
  user.save()

  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    if (event.params.side) {
      delulu.totalBelieverStake = delulu.totalBelieverStake.plus(
        event.params.amount
      )
    } else {
      delulu.totalDoubterStake = delulu.totalDoubterStake.plus(
        event.params.amount
      )
    }
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
  stake.side = event.params.side
  stake.txHash = event.transaction.hash
  stake.createdAt = event.block.timestamp

  stake.save()
}

export function handleDeluluResolved(event: DeluluResolvedEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.isResolved = true
    delulu.outcome = event.params.outcome
    delulu.winningPool = event.params.winningPool
    delulu.losingPool = event.params.losingPool
    delulu.save()
  }
}

export function handleDeluluCancelled(event: DeluluCancelledEvent): void {
  let deluluId = event.params.deluluId.toString()
  let delulu = Delulu.load(deluluId)

  if (delulu != null) {
    delulu.isCancelled = true
    delulu.save()
  }
}

export function handleWinningsClaimed(event: WinningsClaimedEvent): void {
  let userId = event.params.user
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
    user.save()
  }

  let claimId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString()
  let claim = new Claim(claimId)

  claim.delulu = event.params.deluluId.toString()
  claim.user = userId
  claim.amount = event.params.payout
  claim.txHash = event.transaction.hash
  claim.createdAt = event.block.timestamp

  claim.save()
}

export function handleEmergencyRefund(event: EmergencyRefundEvent): void { }

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void { }

export function handlePaused(event: PausedEvent): void { }

export function handleUnpaused(event: UnpausedEvent): void { }

export function handleProfileUpdated(event: ProfileUpdatedEvent): void {
  let userId = event.params.user
  let user = User.load(userId)

  if (user == null) {
    user = new User(userId)
    user.totalStaked = BigInt.fromI32(0)
  }

  user.username = event.params.username
  user.metadataHash = event.params.metadataHash
  user.save()
}

export function handleSenateUpdated(event: SenateUpdatedEvent): void {
  // Senate updates are administrative events
  // Can be tracked if needed, but not required for core functionality
}
