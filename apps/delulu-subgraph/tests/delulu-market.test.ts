import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { DeluluCancelled } from "../generated/schema"
import { DeluluCancelled as DeluluCancelledEvent } from "../generated/DeluluMarket/DeluluMarket"
import { handleDeluluCancelled } from "../src/delulu-market"
import { createDeluluCancelledEvent } from "./delulu-market-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let deluluId = BigInt.fromI32(234)
    let cancelledBy = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let newDeluluCancelledEvent = createDeluluCancelledEvent(
      deluluId,
      cancelledBy
    )
    handleDeluluCancelled(newDeluluCancelledEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("DeluluCancelled created and stored", () => {
    assert.entityCount("DeluluCancelled", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "DeluluCancelled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "deluluId",
      "234"
    )
    assert.fieldEquals(
      "DeluluCancelled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "cancelledBy",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
