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
  handleSupportStaked,
  handleSupportClaimed,
  handleChallengeRewardClaimed,
  handleProfileUpdated,
  handleMilestonesAdded,
  handleMilestoneSubmitted,
  handleMilestoneVerified,
  handleMilestoneRejected,
  handleChallengeCreated
} from "../src/delulu-market"
import {
  createDeluluCreatedEvent,
  createSupportStakedEvent,
  createSupportClaimedEvent,
  createChallengeRewardClaimedEvent,
  createProfileUpdatedEvent,
  createMilestonesAddedEvent,
  createMilestoneSubmittedEvent,
  createMilestoneVerifiedEvent,
  createMilestoneRejectedEvent,
  createChallengeCreatedEvent
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
      "QmTestHash123"
    )
    handleDeluluCreated(event)

    assert.entityCount("User", 1)
    assert.entityCount("Delulu", 1)

    assert.fieldEquals("Delulu", "1", "onChainId", "1")
    assert.fieldEquals("Delulu", "1", "contentHash", "QmTestHash123")
    assert.fieldEquals("Delulu", "1", "isResolved", "false")
    assert.fieldEquals("Delulu", "1", "isCancelled", "false")
    assert.fieldEquals("Delulu", "1", "totalSupportCollected", "0")
    assert.fieldEquals("Delulu", "1", "totalSupporters", "0")
  })

  test("reuses existing User on second market creation", () => {
    let event1 = createDeluluCreatedEvent(
      BigInt.fromI32(1),
      CREATOR,
      "QmHash1"
    )
    handleDeluluCreated(event1)

    let event2 = createDeluluCreatedEvent(
      BigInt.fromI32(2),
      CREATOR,
      "QmHash2"
    )
    handleDeluluCreated(event2)

    assert.entityCount("User", 1)
    assert.entityCount("Delulu", 2)
  })
})

describe("handleSupportStaked", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Stake, updates User and Delulu support", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let stakeEvent = createSupportStakedEvent(
      DELULU_ID,
      STAKER,
      BigInt.fromI32(500),
      BigInt.fromI32(2)
    )
    handleSupportStaked(stakeEvent)

    assert.entityCount("User", 2)
    assert.entityCount("Stake", 1)
    assert.fieldEquals("User", STAKER.toHex(), "totalStaked", "500")
    assert.fieldEquals("Delulu", "1", "totalSupportCollected", "500")
    assert.fieldEquals("Delulu", "1", "totalSupporters", "2")
    assert.fieldEquals("Delulu", "1", "totalBelieverStake", "500")
  })
})

describe("handleSupportClaimed", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Claim entity", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let claimEvent = createSupportClaimedEvent(
      DELULU_ID,
      CREATOR,
      BigInt.fromI32(1500),
      BigInt.fromI32(100)
    )
    handleSupportClaimed(claimEvent)

    assert.entityCount("Claim", 1)
    assert.fieldEquals("Claim", claimEvent.transaction.hash.toHex() + "-" + claimEvent.logIndex.toString(), "claimType", "support")
    assert.fieldEquals("Delulu", "1", "rewardClaimed", "true")
  })
})

describe("handleChallengeRewardClaimed", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Claim entity with challenge type", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let claimEvent = createChallengeRewardClaimedEvent(
      BigInt.fromI32(1),
      DELULU_ID,
      CREATOR,
      BigInt.fromI32(2000),
      BigInt.fromI32(200)
    )
    handleChallengeRewardClaimed(claimEvent)

    assert.entityCount("Claim", 1)
    assert.fieldEquals("Claim", claimEvent.transaction.hash.toHex() + "-" + claimEvent.logIndex.toString(), "claimType", "challenge")
    assert.fieldEquals("Delulu", "1", "rewardClaimed", "true")
  })
})

describe("handleProfileUpdated", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates or updates User with username", () => {
    let event = createProfileUpdatedEvent(CREATOR, "testuser")
    handleProfileUpdated(event)

    assert.entityCount("User", 1)
    assert.fieldEquals("User", CREATOR.toHex(), "username", "testuser")
  })
})

describe("handleMilestonesAdded", () => {
  afterEach(() => {
    clearStore()
  })

  test("updates milestone count on Delulu", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let milestonesEvent = createMilestonesAddedEvent(
      DELULU_ID,
      BigInt.fromI32(3)
    )
    handleMilestonesAdded(milestonesEvent)

    assert.fieldEquals("Delulu", "1", "milestoneCount", "3")
  })
})

describe("handleMilestoneSubmitted", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Milestone entity", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let submitEvent = createMilestoneSubmittedEvent(
      DELULU_ID,
      BigInt.fromI32(0),
      "https://proof.link"
    )
    handleMilestoneSubmitted(submitEvent)

    assert.entityCount("Milestone", 1)
    assert.fieldEquals("Milestone", "1-0", "isSubmitted", "true")
    assert.fieldEquals("Milestone", "1-0", "proofLink", "https://proof.link")
  })
})

describe("handleMilestoneVerified", () => {
  afterEach(() => {
    clearStore()
  })

  test("updates Milestone and User points", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let verifyEvent = createMilestoneVerifiedEvent(
      DELULU_ID,
      BigInt.fromI32(0),
      BigInt.fromI32(100)
    )
    handleMilestoneVerified(verifyEvent)

    assert.entityCount("Milestone", 1)
    assert.fieldEquals("Milestone", "1-0", "isVerified", "true")
    assert.fieldEquals("Milestone", "1-0", "pointsEarned", "100")
    assert.fieldEquals("User", CREATOR.toHex(), "deluluPoints", "100")
  })
})

describe("handleMilestoneRejected", () => {
  afterEach(() => {
    clearStore()
  })

  test("updates Milestone rejection status", () => {
    let createEvent = createDeluluCreatedEvent(
      DELULU_ID,
      CREATOR,
      "QmTestHash"
    )
    handleDeluluCreated(createEvent)

    let rejectEvent = createMilestoneRejectedEvent(
      DELULU_ID,
      BigInt.fromI32(0),
      "Invalid proof"
    )
    handleMilestoneRejected(rejectEvent)

    assert.entityCount("Milestone", 1)
    assert.fieldEquals("Milestone", "1-0", "isSubmitted", "false")
    assert.fieldEquals("Milestone", "1-0", "rejectionReason", "Invalid proof")
  })
})

describe("handleChallengeCreated", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Challenge entity", () => {
    let event = createChallengeCreatedEvent(
      BigInt.fromI32(1),
      "QmChallengeHash",
      BigInt.fromI32(10000)
    )
    handleChallengeCreated(event)

    assert.entityCount("Challenge", 1)
    assert.fieldEquals("Challenge", "1", "challengeId", "1")
    assert.fieldEquals("Challenge", "1", "contentHash", "QmChallengeHash")
    assert.fieldEquals("Challenge", "1", "poolAmount", "10000")
    assert.fieldEquals("Challenge", "1", "active", "true")
  })
})
