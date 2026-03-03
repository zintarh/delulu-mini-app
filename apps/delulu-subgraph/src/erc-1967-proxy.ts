import { Upgraded as UpgradedEvent } from "../generated/ERC1967Proxy/ERC1967Proxy"
import { Upgraded } from "../generated/schema"

export function handleUpgraded(event: UpgradedEvent): void {
  let entityId =
    event.transaction.hash.toHexString() +
    "-" +
    event.logIndex.toString()
  let entity = new Upgraded(entityId)
  entity.implementation = event.params.implementation

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
