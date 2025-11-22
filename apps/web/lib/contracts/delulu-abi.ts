// Delulu Contract ABI
// Generated from contracts/Delulu.sol

export const deluluAbi = [
  // Constructor
  {
    inputs: [{ internalType: "address", name: "_cUSDAddress", type: "address" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "string", name: "delulu", type: "string" },
      { indexed: false, internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "DelusionCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: false, internalType: "enum Delulu.DelusionStatus", name: "outcome", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "believePool", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "doubtPool", type: "uint256" },
    ],
    name: "DelusionFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "reward", type: "uint256" },
    ],
    name: "RewardClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "enum Delulu.StakePosition", name: "position", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "StakePlaced",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "enum Delulu.StakePosition", name: "fromPosition", type: "uint8" },
      { indexed: false, internalType: "enum Delulu.StakePosition", name: "toPosition", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "penaltyPaid", type: "uint256" },
    ],
    name: "StakeSwitched",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "penalty", type: "uint256" },
    ],
    name: "StakeWithdrawn",
    type: "event",
  },

  // Write Functions
  {
    inputs: [
      { internalType: "string", name: "_delulu", type: "string" },
      { internalType: "uint256", name: "_deadline", type: "uint256" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
      { internalType: "bool", name: "_position", type: "bool" },
    ],
    name: "createDelusion",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "stakeBelieve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "stakeDoubt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "switchToBelieve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "switchToDoubt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "withdrawStake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "finalizeDelusionSuccess",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "finalizeDelusionFail",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Read Functions
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "getDelusion",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "string", name: "delulu", type: "string" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint256", name: "believePool", type: "uint256" },
          { internalType: "uint256", name: "doubtPool", type: "uint256" },
          { internalType: "uint256", name: "believerCount", type: "uint256" },
          { internalType: "uint256", name: "doubterCount", type: "uint256" },
          { internalType: "enum Delulu.DelusionStatus", name: "status", type: "uint8" },
        ],
        internalType: "struct Delulu.Delusion",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" },
    ],
    name: "getUserStake",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "enum Delulu.StakePosition", name: "position", type: "uint8" },
          { internalType: "uint256", name: "stakedAt", type: "uint256" },
          { internalType: "bool", name: "hasClaimed", type: "bool" },
        ],
        internalType: "struct Delulu.UserStake",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "getPools",
    outputs: [
      { internalType: "uint256", name: "believePool", type: "uint256" },
      { internalType: "uint256", name: "doubtPool", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "getOutcome",
    outputs: [{ internalType: "enum Delulu.DelusionStatus", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "delusionCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "cUSD",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "platformVault",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "climateVault",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

