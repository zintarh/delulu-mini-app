// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CommunityMarketV1
 * @notice Standalone community campaign contract. Handles campaign creation,
 *         milestone tracking, paid-join economics, and proof submission.
 *         Deployed separately from the personal-goals proxy so each contract
 *         stays within the 24 KB EIP-170 bytecode limit.
 */
contract CommunityMarketV1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- ERRORS ---
    error InvalidInput();
    error CampaignNotFound();
    error Unauthorized();
    error AlreadyJoined();
    error NotJoined();
    error AlreadyEnded();
    error CampaignNotEnded();
    error CampaignAlreadyHasParticipants();
    error NoMilestones();
    error MilestoneNotFound();
    error AlreadyCompleted();
    error ProofAfterDeadline();
    error InvalidForfeitPct();

    // --- CONSTANTS ---
    uint256 public constant DAY = 86400;
    uint256 public constant BASE_PROOF_POINTS = 10;
    uint256 public constant STREAK_BONUS = 1;
    uint256 public constant MAX_STREAK_BONUS = 7;

    // --- STATE ---
    IERC20 public currency;
    uint256 public nextCampaignId;

    struct Campaign {
        string  contentHash;
        uint256 poolAmount;
        uint256 startTime;
        uint256 duration;
        uint256 proofIntervalSeconds;
        bool    active;
        bool    ended;
        address creator;
    }

    mapping(uint256 => Campaign) public campaigns;

    // Milestone definitions (set by campaign owner before participants join)
    mapping(uint256 => uint256) public campaignMilestoneCount;
    mapping(uint256 => mapping(uint256 => string))  public campaignMilestoneURI;
    mapping(uint256 => mapping(uint256 => uint256)) public campaignMilestoneStartTime;
    mapping(uint256 => mapping(uint256 => uint256)) public campaignMilestoneDeadline;

    // Per-participant state
    mapping(uint256 => mapping(address => bool))    public campaignJoined;
    mapping(uint256 => mapping(address => uint256)) public participantPoints;
    mapping(uint256 => mapping(address => uint256)) public participantCompletedMilestones;
    mapping(uint256 => mapping(address => uint256)) public participantLastProofAt;
    mapping(uint256 => mapping(address => uint256)) public participantStreak;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public milestoneCompleted;

    // Economics (paid campaigns)
    mapping(uint256 => bool)    public campaignIsPaid;
    mapping(uint256 => address) public campaignJoinToken;
    mapping(uint256 => uint256) public campaignJoinAmount;
    mapping(uint256 => uint8)   public campaignForfeitPct;
    mapping(uint256 => mapping(address => uint256)) public participantStake;
    mapping(uint256 => uint256) public campaignParticipantCount;

    // --- EVENTS ---
    event CommunityChallengeCreated(
        uint256 indexed campaignId,
        string  contentHash,
        uint256 duration,
        uint256 proofIntervalSeconds,
        address indexed creator
    );
    event CommunityCampaignPaidConfigured(
        uint256 indexed campaignId,
        bool    isPaid,
        address joinToken,
        uint256 joinAmount,
        uint8   forfeitPct
    );
    event CommunityCampaignMilestonesAdded(
        uint256 indexed campaignId,
        uint256 milestoneCount
    );
    event CommunityCampaignJoined(
        uint256 indexed campaignId,
        address indexed participant
    );
    event CommunityCampaignMilestoneProofSubmitted(
        uint256 indexed campaignId,
        uint256 indexed milestoneId,
        address indexed participant,
        string  proofLink,
        uint256 pointsAwarded,
        uint256 pointsTotal
    );
    event CommunityChallengeFunded(
        uint256 indexed campaignId,
        uint256 totalPool,
        uint256 addedAmount,
        address indexed funder
    );
    event CommunityChallengeEnded(
        uint256 indexed campaignId,
        uint256 endedAt
    );

    // --- CONSTRUCTOR ---
    constructor(address _currency, address initialOwner) Ownable(initialOwner) {
        if (_currency == address(0)) revert InvalidInput();
        currency = IERC20(_currency);
    }

    // --- CAMPAIGN LIFECYCLE ---

    function createCommunityChallenge(
        string calldata contentHash,
        uint256 duration,
        uint256 proofIntervalSeconds
    ) external returns (uint256) {
        if (duration == 0) revert InvalidInput();
        if (proofIntervalSeconds == 0) proofIntervalSeconds = DAY;

        uint256 campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            contentHash:          contentHash,
            poolAmount:           0,
            startTime:            block.timestamp,
            duration:             duration,
            proofIntervalSeconds: proofIntervalSeconds,
            active:               true,
            ended:                false,
            creator:              msg.sender
        });

        emit CommunityChallengeCreated(
            campaignId, contentHash, duration, proofIntervalSeconds, msg.sender
        );
        return campaignId;
    }

    function setCommunityCampaignEconomics(
        uint256 campaignId,
        bool    isPaid,
        address joinToken,
        uint256 joinAmount,
        uint8   forfeitPct
    ) external {
        _requireCreatorOrOwner(campaignId);
        // Lock economics once participants have joined — prevents stake rug.
        if (campaignParticipantCount[campaignId] > 0) revert CampaignAlreadyHasParticipants();
        if (isPaid && joinAmount == 0) revert InvalidInput();
        if (isPaid && forfeitPct != 0 && forfeitPct != 2 && forfeitPct != 5 && forfeitPct != 10) {
            revert InvalidForfeitPct();
        }
        campaignIsPaid[campaignId]     = isPaid;
        campaignJoinToken[campaignId]  = joinToken;
        campaignJoinAmount[campaignId] = joinAmount;
        campaignForfeitPct[campaignId] = forfeitPct;
        emit CommunityCampaignPaidConfigured(campaignId, isPaid, joinToken, joinAmount, forfeitPct);
    }

    function addCommunityCampaignMilestones(
        uint256          campaignId,
        string[] calldata mURIs,
        uint256[] calldata mDurations
    ) external {
        _requireCreatorOrOwner(campaignId);
        Campaign storage c = campaigns[campaignId];
        if (c.ended) revert AlreadyEnded();
        if (mURIs.length == 0 || mURIs.length != mDurations.length) revert InvalidInput();

        uint256 startIndex  = campaignMilestoneCount[campaignId];
        uint256 runningTime = startIndex == 0
            ? c.startTime
            : campaignMilestoneDeadline[campaignId][startIndex - 1];

        for (uint256 i = 0; i < mURIs.length;) {
            if (mDurations[i] == 0) revert InvalidInput();
            uint256 deadline = runningTime + mDurations[i];
            campaignMilestoneURI[campaignId][startIndex + i]       = mURIs[i];
            campaignMilestoneStartTime[campaignId][startIndex + i]  = runningTime;
            campaignMilestoneDeadline[campaignId][startIndex + i]   = deadline;
            runningTime = deadline;
            unchecked { ++i; }
        }

        uint256 newCount = startIndex + mURIs.length;
        campaignMilestoneCount[campaignId] = newCount;
        emit CommunityCampaignMilestonesAdded(campaignId, newCount);
    }

    function joinCommunityCampaign(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.active || c.ended) revert CampaignNotFound();
        if (campaignMilestoneCount[campaignId] == 0) revert NoMilestones();
        if (campaignJoined[campaignId][msg.sender]) revert AlreadyJoined();

        if (campaignIsPaid[campaignId]) {
            address token  = campaignJoinToken[campaignId];
            uint256 amount = campaignJoinAmount[campaignId];
            IERC20 stakeToken = (token == address(0)) ? currency : IERC20(token);
            stakeToken.safeTransferFrom(msg.sender, address(this), amount);
            participantStake[campaignId][msg.sender] = amount;
        }

        campaignJoined[campaignId][msg.sender] = true;
        campaignParticipantCount[campaignId]++;
        emit CommunityCampaignJoined(campaignId, msg.sender);
    }

    function submitCommunityCampaignMilestoneProof(
        uint256 campaignId,
        uint256 milestoneId,
        string calldata proofLink
    ) external {
        Campaign storage c = campaigns[campaignId];
        if (!c.active || c.ended) revert CampaignNotFound();
        if (!campaignJoined[campaignId][msg.sender]) revert NotJoined();
        if (milestoneId >= campaignMilestoneCount[campaignId]) revert MilestoneNotFound();
        if (milestoneCompleted[campaignId][milestoneId][msg.sender]) revert AlreadyCompleted();

        uint256 deadline = campaignMilestoneDeadline[campaignId][milestoneId];
        if (block.timestamp > deadline) revert ProofAfterDeadline();

        milestoneCompleted[campaignId][milestoneId][msg.sender] = true;

        uint256 streak = participantStreak[campaignId][msg.sender] + 1;
        participantStreak[campaignId][msg.sender] = streak;
        participantLastProofAt[campaignId][msg.sender] = block.timestamp;

        uint256 streakBonus = streak > MAX_STREAK_BONUS ? MAX_STREAK_BONUS : streak;
        uint256 points = BASE_PROOF_POINTS + streakBonus * STREAK_BONUS;

        uint256 newTotal = participantPoints[campaignId][msg.sender] + points;
        participantPoints[campaignId][msg.sender] = newTotal;
        participantCompletedMilestones[campaignId][msg.sender]++;

        emit CommunityCampaignMilestoneProofSubmitted(
            campaignId, milestoneId, msg.sender, proofLink, points, newTotal
        );
    }

    function fundCommunityChallenge(uint256 campaignId, uint256 amount) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.creator == address(0)) revert CampaignNotFound();
        if (c.ended) revert AlreadyEnded();
        if (amount == 0) revert InvalidInput();
        currency.safeTransferFrom(msg.sender, address(this), amount);
        c.poolAmount += amount;
        emit CommunityChallengeFunded(campaignId, c.poolAmount, amount, msg.sender);
    }

    function endCommunityChallenge(uint256 campaignId) external {
        _requireCreatorOrOwner(campaignId);
        Campaign storage c = campaigns[campaignId];
        if (c.ended) revert AlreadyEnded();
        c.ended  = true;
        c.active = false;
        emit CommunityChallengeEnded(campaignId, block.timestamp);
    }

    // Owner can withdraw the pool after the campaign ends (to distribute to winners).
    function withdrawPool(uint256 campaignId, address to, uint256 amount)
        external onlyOwner nonReentrant
    {
        if (to == address(0)) revert InvalidInput();
        Campaign storage c = campaigns[campaignId];
        if (!c.ended) revert CampaignNotEnded();
        if (amount == 0 || amount > c.poolAmount) revert InvalidInput();
        c.poolAmount -= amount;
        currency.safeTransfer(to, amount);
    }

    // --- INTERNAL ---

    function _requireCreatorOrOwner(uint256 campaignId) internal view {
        Campaign storage c = campaigns[campaignId];
        if (c.creator == address(0)) revert CampaignNotFound();
        if (msg.sender != c.creator && msg.sender != owner()) revert Unauthorized();
    }

    // --- VIEW HELPERS ---

    function isCampaignActive(uint256 campaignId) external view returns (bool) {
        Campaign storage c = campaigns[campaignId];
        return c.active && !c.ended && block.timestamp <= c.startTime + c.duration;
    }
}
