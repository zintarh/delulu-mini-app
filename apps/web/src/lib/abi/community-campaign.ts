export const COMMUNITY_CAMPAIGN_ABI = [
	{
		"inputs": [],
		"name": "AlreadyJoinedCommunity",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "ChallengeAlreadyEnded",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotCommunityChallenge",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotJoinedCommunity",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "ProofTooSoon",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "participant",
				"type": "address"
			}
		],
		"name": "CommunityCampaignJoined",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "contentHash",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "duration",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "proofIntervalSeconds",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "creator",
				"type": "address"
			}
		],
		"name": "CommunityChallengeCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "endedAt",
				"type": "uint256"
			}
		],
		"name": "CommunityChallengeEnded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalPool",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "funder",
				"type": "address"
			}
		],
		"name": "CommunityChallengeFunded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "participant",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "proofLink",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pointsAwarded",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pointsTotal",
				"type": "uint256"
			}
		],
		"name": "CommunityProofSubmitted",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "communityCampaignJoined",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "communityCampaignPoints",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "communityChallengeEnded",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "communityProofInterval",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "contentHash",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "duration",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "proofIntervalSeconds",
				"type": "uint256"
			}
		],
		"name": "createCommunityChallenge",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			}
		],
		"name": "endCommunityChallenge",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "fundCommunityChallenge",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			}
		],
		"name": "isCommunityCampaign",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			}
		],
		"name": "joinCommunityCampaign",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "challengeId",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "proofLink",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "aiApproved",
				"type": "bool"
			}
		],
		"name": "submitCommunityProof",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const;
