// DeluluOracle Contract ABI
// Generated from DeluluOracle contract

export const deluluAbi = [
  // Constructor
  {
    inputs: [
      { internalType: "address", name: "_cUSDAddress", type: "address" }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { indexed: false, internalType: "uint256", name: "stake", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "deadline", type: "uint256" }
    ],
    name: "DelusionCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: false, internalType: "bool", name: "result", type: "bool" }
    ],
    name: "DelusionVerified",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "staker", type: "address" },
      { indexed: false, internalType: "uint8", name: "newPosition", type: "uint8" }
    ],
    name: "PositionSwitched",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "staker", type: "address" },
      { indexed: false, internalType: "uint8", name: "position", type: "uint8" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "StakePlaced",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "delusionId", type: "uint256" },
      { indexed: true, internalType: "address", name: "claimer", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "WinningsClaimed",
    type: "event"
  },

  // Read Functions
  {
    inputs: [],
    name: "cUSD",
    outputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "delusionCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "delusions",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "believePool", type: "uint256" },
      { internalType: "uint256", name: "doubtPool", type: "uint256" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "bool", name: "result", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "getDelusion",
    outputs: [
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "believePool", type: "uint256" },
      { internalType: "uint256", name: "doubtPool", type: "uint256" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "bool", name: "result", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" }
    ],
    name: "getUserStake",
    outputs: [
      { internalType: "uint8", name: "position", type: "uint8" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bool", name: "claimed", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "address", name: "_user", type: "address" }
    ],
    name: "calculatePotentialWinnings",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCUSDAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" }
    ],
    name: "stakes",
    outputs: [
      { internalType: "uint8", name: "position", type: "uint8" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bool", name: "claimed", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  },

  // Write Functions
  {
    inputs: [
      { internalType: "string", name: "_description", type: "string" },
      { internalType: "uint256", name: "_durationInSeconds", type: "uint256" },
      { internalType: "uint256", name: "_stakeAmount", type: "uint256" }
    ],
    name: "createDelusion",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "uint256", name: "_amount", type: "uint256" }
    ],
    name: "stakeBelieve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "uint256", name: "_amount", type: "uint256" }
    ],
    name: "stakeDoubt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "switchToDoubt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_delusionId", type: "uint256" },
      { internalType: "bool", name: "_result", type: "bool" }
    ],
    name: "verifyDelusion",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "_delusionId", type: "uint256" }],
    name: "claimWinnings",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;
