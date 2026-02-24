import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import { User, Delulu, Stake, Claim } from "../generated/schema"
import {
  handleDeluluCreated,
  handleDeluluCancelled,
  handleDeluluResolved,
  handleStakePlaced,
  handleWinningsClaimed
} from "../src/delulu-market"
import {
  createDeluluCreatedEvent,
  createDeluluCancelledEvent,
  createDeluluResolvedEvent,
  createStakePlacedEvent,
  createWinningsClaimedEvent
} from "./delulu-market-utils"

let CREATOR = Address.fromString("0x0000000000000000000000000000000000000001")
let STAKER = Address.fromString("0x0000000000000000000000000000000000000002")
let DELULU_ID = BigInt.fromI32(1)
let STAKE_AMOUNT = BigInt.fromI32(1000)

describe("handleDeluluCreated", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates User and Delulu entities", () => {
    let event = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash123",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(event)

    assert.entityCount("User", 1)
    assert.entityCount("Delulu", 1)

    let creatorId = CREATOR.toHexString()
    assert.fieldEquals("User", CREATOR.toHex(), "totalStaked", "1000")

    assert.fieldEquals("Delulu", "1", "onChainId", "1")
    assert.fieldEquals("Delulu", "1", "contentHash", "QmTestHash123")
    assert.fieldEquals("Delulu", "1", "creatorStake", "1000")
    assert.fieldEquals("Delulu", "1", "totalBelieverStake", "1000")
    assert.fieldEquals("Delulu", "1", "totalDoubterStake", "0")
    assert.fieldEquals("Delulu", "1", "isResolved", "false")
    assert.fieldEquals("Delulu", "1", "isCancelled", "false")
  })

  test("reuses existing User on second market creation", () => {
    let event1 = createDeluluCreatedEvent(
      BigInt.fromI32(1),
      CREATOR,
      "QmHash1",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      BigInt.fromI32(500)
    )
    handleDeluluCreated(event1)

    let event2 = createDeluluCreatedEvent(
      BigInt.fromI32(2),
      CREATOR,
      "QmHash2",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      BigInt.fromI32(300)
    )
    handleDeluluCreated(event2)

    assert.entityCount("User", 1)
    assert.entityCount("Delulu", 2)
    assert.fieldEquals("User", CREATOR.toHex(), "totalStaked", "800")
  })
})

describe("handleDeluluCancelled", () => {
  afterEach(() => {
    clearStore()
  })

  test("sets isCancelled to true on existing Delulu", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(createEvent)

    let cancelEvent = createDeluluCancelledEvent(DELULU_ID, CREATOR)
    handleDeluluCancelled(cancelEvent)

    assert.fieldEquals("Delulu", "1", "isCancelled", "true")
  })
})

describe("handleDeluluResolved", () => {
  afterEach(() => {
    clearStore()
  })

  test("sets resolution fields on Delulu", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(createEvent)

    let resolveEvent = createDeluluResolvedEvent(
      DELULU_ID,
      true,
      BigInt.fromI32(2000),
      BigInt.fromI32(500)
    )
    handleDeluluResolved(resolveEvent)

    assert.fieldEquals("Delulu", "1", "isResolved", "true")
    assert.fieldEquals("Delulu", "1", "outcome", "true")
    assert.fieldEquals("Delulu", "1", "winningPool", "2000")
    assert.fieldEquals("Delulu", "1", "losingPool", "500")
  })
})

describe("handleStakePlaced", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Stake, updates User and Delulu believer pool", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(createEvent)

    let stakeEvent = createStakePlacedEvent(
      DELULU_ID,
      STAKER,
      BigInt.fromI32(500),
      true,
      BigInt.fromI32(1500)
    )
    handleStakePlaced(stakeEvent)

    assert.entityCount("User", 2)
    assert.entityCount("Stake", 1)
    assert.fieldEquals("User", STAKER.toHex(), "totalStaked", "500")
    assert.fieldEquals("Delulu", "1", "totalBelieverStake", "1500")
  })

  test("updates doubter pool when side is false", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(createEvent)

    let stakeEvent = createStakePlacedEvent(
      DELULU_ID,
      STAKER,
      BigInt.fromI32(300),
      false,
      BigInt.fromI32(1300)
    )
    handleStakePlaced(stakeEvent)

    assert.fieldEquals("Delulu", "1", "totalDoubterStake", "300")
  })
})

describe("handleWinningsClaimed", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Claim entity", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash",
      BigInt.fromI32(1700000000),
      BigInt.fromI32(1700100000),
      STAKE_AMOUNT
    )
    handleDeluluCreated(createEvent)

    let claimEvent = createWinningsClaimedEvent(
      DELULU_ID,
      CREATOR,
      BigInt.fromI32(1500)
    )
    handleWinningsClaimed(claimEvent)

    assert.entityCount("Claim", 1)
  })
})
