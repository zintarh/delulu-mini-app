// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title CommunityMarketV1
 * @notice UUPS-upgradeable community campaign contract. Handles campaign creation,
 *         milestone tracking, paid-join economics, proof submission, and merkle
 *         prize claims after a campaign ends.
 *         Deploy behind an ERC1967 proxy; upgrade via owner-only upgradeToAndCall.
 */
contract CommunityMarketV1 is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
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
    error ProofBeforeStart();
    error InvalidForfeitPct();
    error AlreadyClaimed();
    error InvalidProof();
    error PayoutRootNotSet();
    error NoStakeToClaim();

    // --- CONSTANTS ---
    uint256 public constant DAY = 86400;
    uint256 public constant BASE_PROOF_POINTS = 1000;
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

    // Merkle payouts (set after campaign ends; winners claim pro-rata shares)
    mapping(uint256 => bytes32) public communityPayoutRoot;
    mapping(uint256 => uint256) public communityPayoutTotalClaimable;
    mapping(uint256 => mapping(address => bool)) public communityRewardClaimed;

    /// @dev Only used when a campaign's join token differs from `currency` — forfeited stake
    ///      can't be folded into poolAmount (denominated in currency) without mixing tokens,
    ///      so it accrues here instead for the owner to handle separately.
    mapping(address => uint256) public forfeitedStakeByToken;

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
    event CommunityPayoutRootSet(
        uint256 indexed campaignId,
        bytes32 merkleRoot,
        uint256 totalClaimable
    );
    event CommunityCampaignRewardClaimed(
        uint256 indexed campaignId,
        address indexed winner,
        uint256 amount
    );
    event CommunityJoinStakeClaimed(
        uint256 indexed campaignId,
        address indexed participant,
        address token,
        uint256 amount
    );
    event StakeForfeited(
        uint256 indexed campaignId,
        address indexed participant,
        address token,
        uint256 amount,
        uint256 missedMilestones
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _currency, address initialOwner) public initializer {
        if (_currency == address(0) || initialOwner == address(0)) revert InvalidInput();
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        currency = IERC20(_currency);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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

    /// @dev Locked once participants have joined — milestone count is the forfeit
    ///      denominator in claimCommunityJoinStake, so adding more after join would
    ///      retroactively penalize participants for milestones they never had a chance to see.
    function addCommunityCampaignMilestones(
        uint256          campaignId,
        string[] calldata mURIs,
        uint256[] calldata mDurations
    ) external {
        _requireCreatorOrOwner(campaignId);
        Campaign storage c = campaigns[campaignId];
        if (c.ended) revert AlreadyEnded();
        if (campaignParticipantCount[campaignId] > 0) revert CampaignAlreadyHasParticipants();
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

        uint256 startTime = campaignMilestoneStartTime[campaignId][milestoneId];
        if (block.timestamp < startTime) revert ProofBeforeStart();

        uint256 deadline = campaignMilestoneDeadline[campaignId][milestoneId];
        if (block.timestamp > deadline) revert ProofAfterDeadline();

        milestoneCompleted[campaignId][milestoneId][msg.sender] = true;

        uint256 streak = participantStreak[campaignId][msg.sender] + 1;
        participantStreak[campaignId][msg.sender] = streak;
        participantLastProofAt[campaignId][msg.sender] = block.timestamp;

        uint256 points = BASE_PROOF_POINTS;

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

    /**
     * @notice Publish the merkle root for winner payouts. Leaf =
     *         keccak256(abi.encodePacked(campaignId, wallet, amount)).
     *         Callable once the campaign has ended. Replacing the root is
     *         allowed only if no claims have been made yet (totalClaimable reset).
     */
    function setCommunityPayoutRoot(
        uint256 campaignId,
        bytes32 merkleRoot,
        uint256 totalClaimable
    ) external {
        _requireCreatorOrOwner(campaignId);
        Campaign storage c = campaigns[campaignId];
        if (!c.ended) revert CampaignNotEnded();
        if (merkleRoot == bytes32(0) || totalClaimable == 0) revert InvalidInput();
        if (totalClaimable > c.poolAmount) revert InvalidInput();
        communityPayoutRoot[campaignId] = merkleRoot;
        communityPayoutTotalClaimable[campaignId] = totalClaimable;
        emit CommunityPayoutRootSet(campaignId, merkleRoot, totalClaimable);
    }

    /**
     * @notice Winner claims their merkle-proven share of the prize pool.
     */
    function claimCommunityCampaignReward(
        uint256 campaignId,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.ended) revert CampaignNotEnded();
        bytes32 root = communityPayoutRoot[campaignId];
        if (root == bytes32(0)) revert PayoutRootNotSet();
        if (communityRewardClaimed[campaignId][msg.sender]) revert AlreadyClaimed();
        if (amount == 0 || amount > c.poolAmount) revert InvalidInput();

        bytes32 leaf = keccak256(abi.encodePacked(campaignId, msg.sender, amount));
        if (!MerkleProof.verify(proof, root, leaf)) revert InvalidProof();

        communityRewardClaimed[campaignId][msg.sender] = true;
        c.poolAmount -= amount;
        currency.safeTransfer(msg.sender, amount);
        emit CommunityCampaignRewardClaimed(campaignId, msg.sender, amount);
    }

    /**
     * @notice After a campaign ends, reclaim your paid join stake — minus `campaignForfeitPct`%
     *         per milestone you didn't complete (capped at 100%). Forfeited stake is added to
     *         `poolAmount` (when the join token matches `currency`), growing the prize pool
     *         winners claim from via `claimCommunityCampaignReward`.
     *         Free joins have zero stake and revert.
     */
    function claimCommunityJoinStake(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (c.creator == address(0)) revert CampaignNotFound();
        if (!c.ended) revert CampaignNotEnded();
        if (!campaignJoined[campaignId][msg.sender]) revert NotJoined();

        uint256 amount = participantStake[campaignId][msg.sender];
        if (amount == 0) revert NoStakeToClaim();

        participantStake[campaignId][msg.sender] = 0;

        uint256 totalMilestones = campaignMilestoneCount[campaignId];
        uint256 completed = participantCompletedMilestones[campaignId][msg.sender];
        uint256 missed = totalMilestones > completed ? totalMilestones - completed : 0;

        address token = campaignJoinToken[campaignId];
        IERC20 stakeToken = (token == address(0)) ? currency : IERC20(token);

        uint256 payout = amount;
        uint8 pctPerMiss = campaignForfeitPct[campaignId];
        if (pctPerMiss > 0 && missed > 0) {
            uint256 totalForfeitPct = uint256(pctPerMiss) * missed;
            if (totalForfeitPct > 100) totalForfeitPct = 100;
            uint256 forfeited = (amount * totalForfeitPct) / 100;
            payout = amount - forfeited;

            // token(0) is the "use default currency" sentinel, but an explicit
            // address(currency) means the same thing — treat both identically
            // so forfeited stake always reaches the pool when it's actually the
            // same token, regardless of which form was used to configure it.
            if (token == address(0) || token == address(currency)) {
                c.poolAmount += forfeited;
            } else {
                // Different token than the pool's currency — can't mix denominations.
                forfeitedStakeByToken[token] += forfeited;
            }

            emit StakeForfeited(campaignId, msg.sender, address(stakeToken), forfeited, missed);
        }

        stakeToken.safeTransfer(msg.sender, payout);

        emit CommunityJoinStakeClaimed(campaignId, msg.sender, address(stakeToken), payout);
    }

    /**
     * @notice Owner-only recovery for forfeited stake accrued in a token that didn't match
     *         `currency` and so couldn't be folded directly into a campaign's poolAmount.
     */
    function withdrawForfeitedStake(address token, address to, uint256 amount)
        external onlyOwner nonReentrant
    {
        if (to == address(0)) revert InvalidInput();
        if (amount == 0 || amount > forfeitedStakeByToken[token]) revert InvalidInput();
        forfeitedStakeByToken[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
    }

    // Owner can withdraw the remaining pool after the campaign ends
    // (e.g. unclaimed dust). Prefer winner self-claim via merkle when possible.
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

    /// @dev Reserved for future storage without breaking upgrades.
    /// Reduced from 50 → 47 for communityPayoutRoot / TotalClaimable / RewardClaimed,
    /// then 47 → 46 for forfeitedStakeByToken.
    uint256[46] private __gap;
}
