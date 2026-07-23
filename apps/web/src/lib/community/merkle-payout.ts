import {
  encodePacked,
  keccak256,
  type Address,
  type Hex,
} from "viem";

/** Leaf matching CommunityMarketV1: keccak256(abi.encodePacked(campaignId, wallet, amount)). */
export function communityPayoutLeaf(
  campaignId: bigint,
  wallet: Address,
  amountWei: bigint,
): Hex {
  return keccak256(
    encodePacked(
      ["uint256", "address", "uint256"],
      [campaignId, wallet, amountWei],
    ),
  );
}

function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) < BigInt(b)
    ? keccak256(encodePacked(["bytes32", "bytes32"], [a, b]))
    : keccak256(encodePacked(["bytes32", "bytes32"], [b, a]));
}

/**
 * OpenZeppelin MerkleProof-compatible tree (sorted pair hashing).
 * Odd nodes are promoted unchanged (same as common OZ examples).
 */
export function buildMerkleTreeFromLeaves(leaves: Hex[]): {
  root: Hex;
  getProof: (index: number) => Hex[];
} {
  if (leaves.length === 0) throw new Error("Cannot build merkle tree with no leaves");

  const layers: Hex[][] = [leaves];
  while (layers[layers.length - 1]!.length > 1) {
    const prev = layers[layers.length - 1]!;
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      if (i + 1 === prev.length) {
        next.push(prev[i]!);
      } else {
        next.push(hashPair(prev[i]!, prev[i + 1]!));
      }
    }
    layers.push(next);
  }

  const getProof = (index: number): Hex[] => {
    if (index < 0 || index >= leaves.length) {
      throw new Error("Leaf index out of range");
    }
    const proof: Hex[] = [];
    let idx = index;
    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level]!;
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]!);
      }
      idx = Math.floor(idx / 2);
    }
    return proof;
  };

  return {
    root: layers[layers.length - 1]![0]!,
    getProof,
  };
}
