import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  CommitmentCreated as CommitmentCreatedEvent,
  VerifierInviteAccepted as VerifierInviteAcceptedEvent,
  ProofSubmitted as ProofSubmittedEvent,
  PeriodResolvedSuccess as PeriodResolvedSuccessEvent,
  PeriodResolvedForfeited as PeriodResolvedForfeitedEvent,
  FriendRewardCredited as FriendRewardCreditedEvent,
  CommitmentCancelled as CommitmentCancelledEvent,
} from "../generated/ForfeitMarket/ForfeitMarket"
import { ForfeitCommitment, ForfeitPeriodResolution, ForfeitFriendReward, User } from "../generated/schema"

// Entity IDs for ForfeitMarket are prefixed with "fm1-", following the same
// per-datasource convention CommunityMarketV1 uses ("cm1-"), so a Forfeit
// commitment can never collide with a Challenge/campaign entity ID even
// though both ultimately key off a plain incrementing on-chain counter.
function fmId(commitmentId: BigInt): string {
  return "fm1-" + commitmentId.toString()
}

// Matches BASE_PROOF_POINTS in apps/web/src/lib/dashboard/campaign-constants.ts — a
// resolved forfeit period is treated the same as a verified campaign milestone for
// leaderboard purposes, so both feed the same User.deluluPoints total.
const FORFEIT_PROOF_POINTS = BigInt.fromI32(1000)

function getOrCreateUser(address: Bytes): User {
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

export function handleFMCommitmentCreated(event: CommitmentCreatedEvent): void {
  let id = fmId(event.params.commitmentId)
  let user = getOrCreateUser(event.params.creator)

  let commitment = new ForfeitCommitment(id)
  commitment.commitmentId = event.params.commitmentId
  commitment.creator = user.id
  commitment.creatorAddress = event.params.creator.toHexString().toLowerCase()
  commitment.token = event.params.token
  commitment.stakeAmount = event.params.stakeAmount
  commitment.destinationType = event.params.destinationType
  commitment.destinationAddr = event.params.destinationAddr
  commitment.cadence = event.params.cadence
  commitment.periodSeconds = event.params.periodSeconds
  commitment.totalPeriods = event.params.totalPeriods.toI32()
  commitment.currentPeriodIndex = 0
  commitment.currentPeriodDeadline = event.params.firstDeadline
  let zeroAddress = Bytes.fromHexString("0x0000000000000000000000000000000000000000")
  commitment.verifier = event.params.verifier
  // A pending (not-yet-accepted) friend-verifier invite looks identical on this event
  // to self/AI-verify (verifier == address(0)) — the CommitmentCreated event doesn't
  // carry the invite-code hash. handleFMVerifierInviteAccepted flips this once a friend
  // actually claims the role; until then it's indistinguishable from self-verify here,
  // which is fine since off-chain (Supabase) is the source of truth for "was an invite
  // even sent" — the subgraph only needs to know the current effective verifier.
  commitment.hasPendingVerifierInvite = event.params.verifier.equals(zeroAddress)
  commitment.active = true
  commitment.cancelled = false
  commitment.createdAt = event.block.timestamp
  commitment.save()
}

export function handleFMVerifierInviteAccepted(event: VerifierInviteAcceptedEvent): void {
  let commitment = ForfeitCommitment.load(fmId(event.params.commitmentId))
  if (commitment == null) return
  commitment.verifier = event.params.verifier
  commitment.hasPendingVerifierInvite = false
  commitment.save()
}

export function handleFMProofSubmitted(event: ProofSubmittedEvent): void {
  // Proof links themselves are stored off-chain (Supabase, keyed by tx hash) — this
  // handler intentionally does nothing on-chain beyond letting the event exist for
  // indexers/analytics; ForfeitCommitment's queryable state doesn't change until a
  // period actually resolves.
}

export function handleFMPeriodResolvedSuccess(event: PeriodResolvedSuccessEvent): void {
  let commitment = ForfeitCommitment.load(fmId(event.params.commitmentId))
  if (commitment == null) return

  let resolutionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let resolution = new ForfeitPeriodResolution(resolutionId)
  resolution.commitment = commitment.id
  resolution.commitmentId = event.params.commitmentId
  resolution.periodIndex = event.params.periodIndex.toI32()
  resolution.outcome = "success"
  resolution.resolver = event.params.resolver
  resolution.creatorAddress = commitment.creatorAddress
  resolution.pointsAwarded = FORFEIT_PROOF_POINTS
  resolution.txHash = event.transaction.hash
  resolution.createdAt = event.block.timestamp
  resolution.save()

  // Points go to the creator (the one who did the task), not event.params.resolver —
  // resolver is the creator for self/AI-verify but the named friend for friend-verify.
  let creator = User.load(commitment.creator)
  if (creator != null) {
    creator.deluluPoints = creator.deluluPoints.plus(FORFEIT_PROOF_POINTS)
    creator.save()
  }

  if (event.params.commitmentEnded) {
    commitment.active = false
  } else {
    commitment.currentPeriodIndex = commitment.currentPeriodIndex + 1
    commitment.currentPeriodDeadline = commitment.currentPeriodDeadline.plus(
      commitment.periodSeconds
    )
  }
  commitment.save()
}

export function handleFMPeriodResolvedForfeited(event: PeriodResolvedForfeitedEvent): void {
  let commitment = ForfeitCommitment.load(fmId(event.params.commitmentId))
  if (commitment == null) return

  let resolutionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let resolution = new ForfeitPeriodResolution(resolutionId)
  resolution.commitment = commitment.id
  resolution.commitmentId = event.params.commitmentId
  resolution.periodIndex = event.params.periodIndex.toI32()
  resolution.outcome = "forfeited"
  resolution.resolver = event.params.keeper
  resolution.creatorAddress = commitment.creatorAddress
  resolution.bountyPaid = event.params.bountyPaid
  resolution.platformFee = event.params.platformFee
  resolution.destinationType = event.params.destinationType
  resolution.destinationAddr = event.params.destinationAddr
  resolution.amountToDestination = event.params.amountToDestination
  resolution.txHash = event.transaction.hash
  resolution.createdAt = event.block.timestamp
  resolution.save()

  // A single forfeited period ends the whole commitment (see ForfeitMarket.sol).
  commitment.active = false
  commitment.save()
}

// Fires from _distributeForfeitedStake for Friend destinations, regardless of
// whether the forfeiture came from resolveCommitmentForfeited (deadline miss)
// or cancelCommitment (voluntary) — unlike ForfeitPeriodResolution, which
// cancelCommitment never creates, so this is the only reliable place to catch
// "a friend was just credited" for both paths.
export function handleFMFriendRewardCredited(event: FriendRewardCreditedEvent): void {
  let commitment = ForfeitCommitment.load(fmId(event.params.commitmentId))
  if (commitment == null) return

  let rewardId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let reward = new ForfeitFriendReward(rewardId)
  reward.commitment = commitment.id
  reward.commitmentId = event.params.commitmentId
  reward.recipientAddress = event.params.recipient.toHexString().toLowerCase()
  reward.token = event.params.token
  reward.amount = event.params.amount
  reward.txHash = event.transaction.hash
  reward.createdAt = event.block.timestamp
  reward.save()
}

export function handleFMCommitmentCancelled(event: CommitmentCancelledEvent): void {
  let commitment = ForfeitCommitment.load(fmId(event.params.commitmentId))
  if (commitment == null) return
  commitment.active = false
  commitment.cancelled = true
  commitment.save()
}
