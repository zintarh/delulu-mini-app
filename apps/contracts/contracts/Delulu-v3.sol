// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Delulu Protocol v3.0 (Master)
 * @notice Social Support, Milestones, and Admin-Led Challenges.
 */
contract Delulu is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // --- ERRORS ---
    error InvalidDeadlines();
    error DeluluNotFound();
    error ChallengeNotFound();
    error ChallengeExpired();
    error ChallengeNotClosed();
    error MilestoneNotFound();
    error MilestoneAlreadyCompleted();
    error Unauthorized();
    error ProfileRequired();
    error UsernameTaken();
    error InvalidUsername();
    error TooManyMilestones();
    error MilestoneExpired();
    error AlreadyInitialized();
    error AlreadyClaimed();
    error NoPointsAllocated();
    error ClaimPeriodExpired();
    error InsufficientSweepBalance();
    error NotResolved();
    error StakeTooSmall();
    error StakingIsClosed();
    error AlreadySettled();
    error MilestonesCannotBeReset();
    error MilestoneCannotBeDeleted();

    // --- CONSTANTS ---
    uint256 public constant MAX_MILESTONES = 10;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant KEEPER_BOUNTY_BPS = 100; // 1% bounty on slashed stake
    uint256 public constant SCOUT_FEE_BPS = 200; // 2% of eligible tips go to scouts
    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MIN_STAKE = 1e18;

    // Bonding curve pricing for per-delulu shares (Friend.tech-style).
    // cost = sum_{i=S+1}^{S+amount} i^2 * SHARE_PRICE_SCALE / SHARE_PRICE_FACTOR
    uint256 public constant SHARE_PRICE_SCALE = 1e18;
    uint256 public constant SHARE_PRICE_FACTOR = 16000;
    uint256 public constant SHARE_CREATOR_FEE_BPS = 300; // 3% of curve cost on buys/sells to creator

    // --- STATE ---
    IERC20 public currency;
    address public vault;
    address public platformFeeAddress;
    uint256 public nextDeluluId;
    uint256 public nextChallengeId;
    uint256 public totalReservedRewards;

    struct Milestone {
        bytes32 descriptionHash;
        uint256 deadline;
        string proofLink;
        bool isSubmitted;
        bool isVerified;
    }

    struct Challenge {
        uint256 id;
        string contentHash;
        uint256 poolAmount;
        uint256 startTime;
        uint256 duration;
        uint256 totalPoints;
        bool active;
    }

    struct Market {
        uint256 id;
        address creator;
        address token;
        string contentHash;
        uint256 stakingDeadline;
        uint256 resolutionDeadline;
        uint256 totalSupportCollected;
        uint256 totalSupporters;
        uint256 milestoneCount;
        uint256 challengeId;
        uint256 points;
        bool isResolved;
        bool rewardClaimed;
    }

    struct TipEventData {
        uint256 deluluId;
        uint256 milestoneId;
        address tipper;
        uint256 amount;
        bool isScout;
        bool isGenesis;
        bool isFinisher;
    }

    mapping(uint256 => Market) public delulus;
    mapping(uint256 => mapping(uint256 => Milestone)) public deluluMilestones;
    mapping(uint256 => Challenge) public challenges;
    mapping(address => uint256) public userDeluluPoints;
    mapping(address => string) public addressToUsername;
    mapping(string => address) public usernameToAddress;
    mapping(address => bool) public isSupportedToken;

    // ─── New State (APPEND ONLY – do not reorder existing vars) ─────────

    // Scouts: first backers during Genesis window
    mapping(uint256 => address[3]) public firstScouts;
    mapping(uint256 => uint8) public scoutCount;
    mapping(uint256 => mapping(address => uint256)) public scoutEarnings;

    // Pro‑rata stake refund pool (creator stake only, never supporter tips)
    mapping(uint256 => uint256) public failedStakePool;
    mapping(uint256 => uint256) public totalSupportForProRata;
    mapping(uint256 => mapping(address => uint256)) public supporterAmount;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;

    // Milestone-level support aggregates
    mapping(uint256 => mapping(uint256 => uint256))
        public milestoneTotalSupport;

    mapping(address => uint256) public finishedGoalsCount;

    address public verifier;

    mapping(uint256 => mapping(uint256 => uint256)) public milestoneStartTime;
    mapping(uint256 => mapping(uint256 => uint256)) public milestoneTippingStart;
    mapping(uint256 => mapping(uint256 => uint256)) public milestoneTippingEnd;
    mapping(uint256 => mapping(uint256 => bool)) public milestoneIsMissed;

    mapping(uint256 => bool) public marketIsStaked;
    mapping(uint256 => uint256) public marketStakedAmount;
    mapping(uint256 => uint256) public marketFinisherWindowEnd;
    mapping(uint256 => bool) public marketIsFailed;

    mapping(uint256 => mapping(uint256 => string)) public milestoneURI;
    
    mapping(uint256 => mapping(uint256 => bool)) public milestoneIsDeleted;


    mapping(uint256 => uint256) public shareSupply;
    mapping(uint256 => mapping(address => uint256)) public shareBalance;
    mapping(address => mapping(address => uint256)) public pendingCreatorShareFeesByToken;

    // --- EVENTS ---
    event ProfileUpdated(address indexed user, string username);
    event ChallengeCreated(
        uint256 indexed challengeId,
        string contentHash,
        uint256 poolAmount,
        uint256 startTime,
        uint256 duration
    );
    event DeluluCreated(
        uint256 indexed deluluId,
        address indexed creator,
        address indexed token,
        string contentHash,
        uint256 stakingDeadline,
        uint256 resolutionDeadline,
        uint256 initialSupport,
        uint256 totalSupportCollected,
        uint256 totalSupporters
    );
    event DeluluResolved(uint256 indexed deluluId);
    event DeluluJoinedChallenge(
        uint256 indexed deluluId,
        uint256 indexed challengeId
    );
    event PointsAllocated(
        uint256 indexed deluluId,
        uint256 points,
        uint256 totalPoints
    );
    event MilestonesAdded(uint256 indexed deluluId, uint256 count);
    event MilestonesReset(uint256 indexed deluluId);
    event MilestoneDeleted(uint256 indexed deluluId, uint256 indexed milestoneId);
    event MilestoneSubmitted(
        uint256 indexed deluluId,
        uint256 indexed milestoneId,
        string proofLink
    );
    event MilestoneVerified(
        uint256 indexed deluluId,
        uint256 indexed milestoneId,
        uint256 pointsEarned
    );
    event MilestoneRejected(
        uint256 indexed deluluId,
        uint256 indexed milestoneId,
        string reason
    );
    event SupportStaked(
        uint256 indexed deluluId,
        address indexed supporter,
        uint256 amount,
        uint256 totalSupporters
    );
    event SupportClaimed(
        uint256 indexed deluluId,
        address indexed creator,
        uint256 netSupport,
        uint256 fee
    );
    event ChallengeRewardClaimed(
        uint256 indexed challengeId,
        uint256 indexed deluluId,
        address indexed creator,
        uint256 netReward,
        uint256 fee
    );
    event CurrencyUpdated(address indexed newCurrency);
    event PlatformFeeAddressUpdated(address indexed newPlatformFeeAddress);

    // ─── New Events for advanced flows / frames ─────────────────────────

    event MilestoneSubmittedDetailed(
        uint256 indexed deluluId,
        uint256 indexed milestoneId,
        string proofLink,
        uint256 tippingWindowEnd
    );

    event MilestoneMissed(
        uint256 indexed deluluId,
        uint256 indexed milestoneId
    );

    event TipExecuted(TipEventData data);

    event GoalFailed(
        uint256 indexed deluluId,
        uint256 stakedAmountAllocatedToSupporters
    );

    event StakeRefundClaimed(
        uint256 indexed deluluId,
        address indexed supporter,
        uint256 amount
    );
    event ScoutEarningsClaimed(
        uint256 indexed deluluId,
        address indexed scout,
        uint256 amount
    );

    event SharesBought(
        uint256 indexed deluluId,
        address indexed buyer,
        uint256 amount,
        uint256 curveCost,
        uint256 protocolFee,
        uint256 creatorFee
    );

    event SharesSold(
        uint256 indexed deluluId,
        address indexed seller,
        uint256 amount,
        uint256 curveProceeds,
        uint256 protocolFee,
        uint256 creatorFee
    );
    // Emitted once per milestone on creation with all static configuration
    event MilestoneCreatedDetailed(
        uint256 indexed deluluId,
        uint256 indexed milestoneId,
        bytes32 descriptionHash,
        string uri,
        uint256 startTime,
        uint256 deadline
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _defaultCurrency,
        address _vault,
        address _gDollar
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        currency = IERC20(_defaultCurrency);
        isSupportedToken[_defaultCurrency] = true;
        vault = _vault;
        platformFeeAddress = _gDollar;

        nextDeluluId = 1;
        nextChallengeId = 1;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // --- SYSTEM ADMIN FUNCTIONS ---

    function setCurrency(address _token) external onlyOwner {
        currency = IERC20(_token);
        isSupportedToken[_token] = true;
        emit CurrencyUpdated(_token);
    }

    function setPlatformFeeAddress(address _platform) external onlyOwner {
        platformFeeAddress = _platform;
        emit PlatformFeeAddressUpdated(_platform);
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setTokenSupport(address _token, bool _status) external onlyOwner {
        isSupportedToken[_token] = _status;
    }

    // --- VERIFIER ROLE FOR MILESTONES ---

    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    modifier onlyVerifier() {
        if (msg.sender != verifier && msg.sender != owner())
            revert Unauthorized();
        _;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- PROFILE SYSTEM ---

    function setProfile(string calldata _username) external {
        uint256 len = bytes(_username).length;
        if (len < 3 || len > 16) revert InvalidUsername();
        if (usernameToAddress[_username] != address(0)) revert UsernameTaken();

        string memory oldUsername = addressToUsername[msg.sender];
        if (bytes(oldUsername).length > 0) {
            delete usernameToAddress[oldUsername];
        }

        addressToUsername[msg.sender] = _username;
        usernameToAddress[_username] = msg.sender;
        emit ProfileUpdated(msg.sender, _username);
    }

    // --- CHALLENGE LOGIC ---

    function createChallenge(
        string calldata _contentHash,
        uint256 _poolAmount,
        uint256 _duration
    ) external {
        currency.safeTransferFrom(msg.sender, address(this), _poolAmount);
        uint256 challengeId = nextChallengeId++;
        uint256 startTime = block.timestamp;
        challenges[challengeId] = Challenge({
            id: challengeId,
            contentHash: _contentHash,
            poolAmount: _poolAmount,
            startTime: startTime,
            duration: _duration,
            totalPoints: 0,
            active: true
        });
        totalReservedRewards += _poolAmount;
        emit ChallengeCreated(
            challengeId,
            _contentHash,
            _poolAmount,
            startTime,
            _duration
        );
    }

    function allocatePoints(
        uint256 deluluId,
        uint256 points
    ) external onlyOwner {
        Market storage d = delulus[deluluId];
        if (d.challengeId == 0) revert ChallengeNotFound();
        Challenge storage c = challenges[d.challengeId];

        c.totalPoints = (c.totalPoints - d.points) + points;
        d.points = points;
        userDeluluPoints[d.creator] += points;
        emit PointsAllocated(deluluId, points, c.totalPoints);
    }

    // --- CORE EXECUTION ---

    function createDelulu(
        address token,
        string calldata contentHash,
        uint256 /*stakingDeadline*/,
        uint256 resolutionDeadline,
        uint256 initialSupport
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (bytes(addressToUsername[msg.sender]).length == 0)
            revert ProfileRequired();
        if (!isSupportedToken[token]) revert Unauthorized();
        if (initialSupport < MIN_STAKE) revert StakeTooSmall();

        uint256 deluluId = nextDeluluId++;
        Market storage d = delulus[deluluId];
        d.id = deluluId;
        d.creator = msg.sender;
        d.token = token;
        d.contentHash = contentHash;
        // Genesis window: strictly 24 hours from creation
        uint256 genesisEnd = block.timestamp + 24 hours;
        if (resolutionDeadline <= genesisEnd) revert InvalidDeadlines();
        d.stakingDeadline = genesisEnd;
        d.resolutionDeadline = resolutionDeadline;
        // Tips are tracked separately from creator stake
        d.totalSupportCollected = 0;
        d.totalSupporters = 0;
        // Optional creator stake – acts as skin in the game
        marketIsStaked[deluluId] = initialSupport > 0;
        marketStakedAmount[deluluId] = initialSupport;

        IERC20(token).safeTransferFrom(
            msg.sender,
            address(this),
            initialSupport
        );
        emit DeluluCreated(
            deluluId,
            msg.sender,
            token,
            contentHash,
            genesisEnd,
            resolutionDeadline,
            initialSupport,
            d.totalSupportCollected, // 0 at creation
            d.totalSupporters // 0 at creation
        );
        return deluluId;
    }

    /**
     * @notice Get the deadline of the last active (non-deleted) milestone, or current time if none exist
     */
    function _getLastActiveMilestoneDeadline(uint256 deluluId) internal view returns (uint256) {
        Market storage d = delulus[deluluId];
        if (d.milestoneCount == 0) {
            return block.timestamp;
        }
        
        // Find the last non-deleted milestone
        for (uint256 i = d.milestoneCount; i > 0; i--) {
            uint256 idx = i - 1;
            if (!milestoneIsDeleted[deluluId][idx] && deluluMilestones[deluluId][idx].deadline > 0) {
                return deluluMilestones[deluluId][idx].deadline;
            }
        }
        return block.timestamp;
    }

    function addMilestones(
        uint256 deluluId,
        string[] calldata mURIs,
        uint256[] calldata mDurations
    ) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (mURIs.length == 0 || mURIs.length > MAX_MILESTONES)
            revert TooManyMilestones();
        if (mURIs.length != mDurations.length) revert TooManyMilestones();

        // Check total milestone count won't exceed MAX_MILESTONES
        uint256 activeCount = 0;
        for (uint256 i = 0; i < d.milestoneCount; i++) {
            if (!milestoneIsDeleted[deluluId][i]) {
                activeCount++;
            }
        }
        if (activeCount + mURIs.length > MAX_MILESTONES) revert TooManyMilestones();

        // Calculate starting time from last active milestone or current time
        uint256 runningTime = _getLastActiveMilestoneDeadline(deluluId);
        uint256 startIndex = d.milestoneCount;
        
        for (uint256 i = 0; i < mURIs.length; i++) {
            uint256 milestoneIndex = startIndex + i;
            uint256 startTime = runningTime;
            uint256 duration = mDurations[i];
            uint256 deadline = startTime + duration;
            bytes32 descHash = keccak256(bytes(mURIs[i]));

            deluluMilestones[deluluId][milestoneIndex] = Milestone({
                descriptionHash: descHash,
                deadline: deadline,
                proofLink: "",
                isSubmitted: false,
                isVerified: false
            });

            // Store human-readable / IPFS metadata URI and emit for indexing
            milestoneURI[deluluId][milestoneIndex] = mURIs[i];
            emit MilestoneCreatedDetailed(
                deluluId,
                milestoneIndex,
                descHash,
                mURIs[i],
                startTime,
                deadline
            );

            // store extended milestone timing data in separate mappings
            milestoneStartTime[deluluId][milestoneIndex] = startTime;
            milestoneTippingStart[deluluId][milestoneIndex] = 0;
            milestoneTippingEnd[deluluId][milestoneIndex] = 0;
            milestoneIsMissed[deluluId][milestoneIndex] = false;
            milestoneIsDeleted[deluluId][milestoneIndex] = false;

            runningTime = deadline;
        }
        d.milestoneCount = startIndex + mURIs.length;
        if (runningTime > d.resolutionDeadline) revert InvalidDeadlines();
        emit MilestonesAdded(deluluId, d.milestoneCount);
    }

    /**
     * @notice Reset milestones for a delulu. Only allowed if no milestones have been submitted.
     * @param deluluId The ID of the delulu
     */
    function resetMilestones(uint256 deluluId) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (d.milestoneCount == 0) revert MilestoneNotFound();
        
        // Check that no milestones have been submitted
        for (uint256 i = 0; i < d.milestoneCount; i++) {
            if (deluluMilestones[deluluId][i].isSubmitted) {
                revert MilestonesCannotBeReset();
            }
        }

        // Reset all milestone data
        for (uint256 i = 0; i < d.milestoneCount; i++) {
            delete deluluMilestones[deluluId][i];
            delete milestoneURI[deluluId][i];
            delete milestoneStartTime[deluluId][i];
            delete milestoneTippingStart[deluluId][i];
            delete milestoneTippingEnd[deluluId][i];
            delete milestoneIsMissed[deluluId][i];
            delete milestoneTotalSupport[deluluId][i];
        }

        // Reset milestone count
        d.milestoneCount = 0;

        emit MilestonesReset(deluluId);
    }

    /**
     * @notice Delete a specific milestone. Only allowed if milestone hasn't been submitted.
     * @param deluluId The ID of the delulu
     * @param milestoneId The ID of the milestone to delete
     */
    function deleteMilestone(uint256 deluluId, uint256 milestoneId) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (milestoneId >= d.milestoneCount) revert MilestoneNotFound();
        if (milestoneIsDeleted[deluluId][milestoneId]) revert MilestoneNotFound();
        
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        
        // Cannot delete if submitted or verified
        if (m.isSubmitted || m.isVerified) {
            revert MilestoneCannotBeDeleted();
        }

        // Cannot delete if milestone deadline has passed (past milestone)
        if (block.timestamp > m.deadline || milestoneIsMissed[deluluId][milestoneId]) {
            revert MilestoneCannotBeDeleted();
        }

        // Mark as deleted (soft delete to preserve indices)
        milestoneIsDeleted[deluluId][milestoneId] = true;
        
        emit MilestoneDeleted(deluluId, milestoneId);
    }

    function submitMilestone(
        uint256 deluluId,
        uint256 milestoneId,
        string calldata proofLink
    ) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (milestoneIsDeleted[deluluId][milestoneId]) revert MilestoneNotFound();
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        if (m.isVerified) revert MilestoneAlreadyCompleted();
        if (block.timestamp > m.deadline) {
            milestoneIsMissed[deluluId][milestoneId] = true;
            emit MilestoneMissed(deluluId, milestoneId);
            revert MilestoneExpired();
        }

        m.proofLink = proofLink;
        m.isSubmitted = true;
        // Open a dynamic tipping window based on milestone duration
        uint256 window = calculateTippingWindow(
            milestoneStartTime[deluluId][milestoneId],
            m.deadline
        );
        if (window > 0) {
            milestoneTippingStart[deluluId][milestoneId] = block.timestamp;
            milestoneTippingEnd[deluluId][milestoneId] =
                block.timestamp +
                window;
        }

        emit MilestoneSubmitted(deluluId, milestoneId, proofLink);
        emit MilestoneSubmittedDetailed(
            deluluId,
            milestoneId,
            proofLink,
            milestoneTippingEnd[deluluId][milestoneId]
        );
    }

    function stakeDelulu(
        uint256 deluluId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();
        if (block.timestamp >= d.stakingDeadline) revert StakingIsClosed();

        d.totalSupportCollected += amount;
        d.totalSupporters += 1;
        userDeluluPoints[msg.sender] += 10;

        IERC20(d.token).safeTransferFrom(msg.sender, address(this), amount);
        emit SupportStaked(deluluId, msg.sender, amount, d.totalSupporters);
    }

    function joinChallenge(uint256 deluluId, uint256 challengeId) external {
        Market storage d = delulus[deluluId];
        Challenge storage c = challenges[challengeId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (!c.active || block.timestamp > c.startTime + c.duration)
            revert ChallengeExpired();
        d.challengeId = challengeId;
        emit DeluluJoinedChallenge(deluluId, challengeId);
    }

    // --- TIPPING WINDOWS & SUPPORT ---

    /**
     * @notice Calculate the tipping window duration for a milestone.
     * Uses 15% of the milestone duration, clamped between 6h and 72h.
     */
    function calculateTippingWindow(
        uint256 start,
        uint256 deadline
    ) public pure returns (uint256) {
        if (deadline <= start) return 0;
        uint256 duration = deadline - start;
        uint256 window = (duration * 15) / 100; // 15%
        if (window < 6 hours) window = 6 hours;
        if (window > 72 hours) window = 72 hours;
        return window;
    }

    // --- SHARES BONDING CURVE (FRIEND.TECH STYLE) ---

    /**
     * @dev Internal helper: sum of squares from `fromInclusive` to `toInclusive`.
     * Uses the identity: 1^2 + ... + n^2 = n(n+1)(2n+1)/6.
     */
    function _sumOfSquares(
        uint256 fromInclusive,
        uint256 toInclusive
    ) internal pure returns (uint256) {
        if (toInclusive < fromInclusive) {
            return 0;
        }

        // sumTo(n) = n(n+1)(2n+1)/6
        uint256 n = toInclusive;
        uint256 sumToN = (n * (n + 1) * ((2 * n) + 1)) / 6;

        if (fromInclusive == 1) {
            return sumToN;
        }

        uint256 m = fromInclusive - 1;
        uint256 sumToM = (m * (m + 1) * ((2 * m) + 1)) / 6;
        return sumToN - sumToM;
    }

    /**
     * @notice Returns the curve cost (excluding fees) to buy `amount` shares for a given delulu.
     */
    function getShareBuyPrice(
        uint256 deluluId,
        uint256 amount
    ) public view returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();

        uint256 supply = shareSupply[deluluId];
        uint256 fromInclusive = supply + 1;
        uint256 toInclusive = supply + amount;
        uint256 sumSquares = _sumOfSquares(fromInclusive, toInclusive);

        return (sumSquares * SHARE_PRICE_SCALE) / SHARE_PRICE_FACTOR;
    }

    /**
     * @notice Returns the curve proceeds (excluding fees) from selling `amount` shares of a given delulu.
     */
    function getShareSellProceeds(
        uint256 deluluId,
        uint256 amount
    ) public view returns (uint256) {
        if (amount == 0) {
            return 0;
        }
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();

        uint256 supply = shareSupply[deluluId];
        if (amount > supply) {
            return 0;
        }

        uint256 fromInclusive = supply - amount + 1;
        uint256 toInclusive = supply;
        uint256 sumSquares = _sumOfSquares(fromInclusive, toInclusive);

        return (sumSquares * SHARE_PRICE_SCALE) / SHARE_PRICE_FACTOR;
    }

    /**
     * @notice Buy `amount` shares in a delulu using the bonding curve.
     * @param deluluId The ID of the delulu
     * @param amount Number of shares to buy
     * @param maxCost Maximum total cost (curve + fees) the caller is willing to pay (slippage protection)
     */
    function buyShares(
        uint256 deluluId,
        uint256 amount,
        uint256 maxCost
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert StakeTooSmall();

        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();
        if (d.isResolved || marketIsFailed[deluluId]) revert AlreadySettled();
        // Disallow new buys after resolution deadline has passed
        if (block.timestamp >= d.resolutionDeadline) revert StakingIsClosed();

        uint256 curveCost = getShareBuyPrice(deluluId, amount);
        if (curveCost == 0) revert StakeTooSmall();

        uint256 protocolFee = (curveCost * PROTOCOL_FEE_BPS) /
            BPS_DENOMINATOR;
        uint256 creatorFee = (curveCost * SHARE_CREATOR_FEE_BPS) /
            BPS_DENOMINATOR;
        uint256 totalCost = curveCost + protocolFee + creatorFee;

        if (maxCost > 0 && totalCost > maxCost) {
            revert InsufficientSweepBalance();
        }

        // Pull token from buyer
        IERC20(d.token).safeTransferFrom(
            msg.sender,
            address(this),
            totalCost
        );

        // Protocol fee is paid out immediately; bonding curve collateral (curveCost) stays in contract.
        if (protocolFee > 0) {
            IERC20(d.token).safeTransfer(platformFeeAddress, protocolFee);
        }

        // Creator fee is added to a claimable balance to avoid reverts on transfer.
        if (creatorFee > 0) {
            pendingCreatorShareFeesByToken[d.creator][d.token] += creatorFee;
        }

        // Mint shares
        shareSupply[deluluId] += amount;
        shareBalance[deluluId][msg.sender] += amount;

        emit SharesBought(
            deluluId,
            msg.sender,
            amount,
            curveCost,
            protocolFee,
            creatorFee
        );
    }

    /**
     * @notice Sell `amount` shares in a delulu back to the bonding curve.
     * @param deluluId The ID of the delulu
     * @param amount Number of shares to sell
     * @param minProceeds Minimum net proceeds (after fees) the caller is willing to accept (slippage protection)
     */
    function sellShares(
        uint256 deluluId,
        uint256 amount,
        uint256 minProceeds
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert StakeTooSmall();

        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();

        uint256 balance = shareBalance[deluluId][msg.sender];
        if (amount > balance) revert StakeTooSmall();

        uint256 curveProceeds = getShareSellProceeds(deluluId, amount);
        if (curveProceeds == 0) revert StakeTooSmall();

        uint256 protocolFee = (curveProceeds * PROTOCOL_FEE_BPS) /
            BPS_DENOMINATOR;
        uint256 creatorFee = (curveProceeds * SHARE_CREATOR_FEE_BPS) /
            BPS_DENOMINATOR;
        uint256 netProceeds = curveProceeds - protocolFee - creatorFee;

        if (minProceeds > 0 && netProceeds < minProceeds) {
            revert InsufficientSweepBalance();
        }

        // Burn shares
        shareSupply[deluluId] -= amount;
        shareBalance[deluluId][msg.sender] = balance - amount;

        // Pay protocol fee immediately.
        if (protocolFee > 0) {
            IERC20(d.token).safeTransfer(platformFeeAddress, protocolFee);
        }

        // Accrue creator fee.
        if (creatorFee > 0) {
            pendingCreatorShareFeesByToken[d.creator][d.token] += creatorFee;
        }

        // Pay seller from bonding curve reserve.
        IERC20(d.token).safeTransfer(msg.sender, netProceeds);

        emit SharesSold(
            deluluId,
            msg.sender,
            amount,
            curveProceeds,
            protocolFee,
            creatorFee
        );
    }

    /**
     * @notice Claim accumulated creator fees from share trades for a specific token.
     * @param token The ERC20 token address in which fees were accrued (per-delulu token)
     */
    function claimCreatorShareFees(address token) external nonReentrant {
        uint256 amount = pendingCreatorShareFeesByToken[msg.sender][token];
        if (amount == 0) {
            revert StakeTooSmall();
        }
        pendingCreatorShareFeesByToken[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Support a delulu during Genesis or an active milestone tipping window.
     * @dev This is the preferred entrypoint for new flows; legacy stakeDelulu remains for compatibility.
     */
    function tipMilestone(
        uint256 deluluId,
        uint256 milestoneId,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();

        bool isGenesis = block.timestamp <= d.stakingDeadline;
        bool isFinisher = marketFinisherWindowEnd[deluluId] > 0 &&
            block.timestamp <= marketFinisherWindowEnd[deluluId];

        {
            // Single check block using standalone milestone mappings
            if (
                !isGenesis &&
                !isFinisher &&
                (milestoneTippingStart[deluluId][milestoneId] == 0 ||
                    block.timestamp <
                    milestoneTippingStart[deluluId][milestoneId] ||
                    block.timestamp >
                    milestoneTippingEnd[deluluId][milestoneId] ||
                    milestoneIsMissed[deluluId][milestoneId])
            ) {
                revert StakingIsClosed();
            }
        }

        d.totalSupporters += 1;
        userDeluluPoints[msg.sender] += 10;
        supporterAmount[deluluId][msg.sender] += amount;
        totalSupportForProRata[deluluId] += amount;
        milestoneTotalSupport[deluluId][milestoneId] += amount;

        // One call to handle Scouts, creator revenue, and the event emission
        _processScouts(
            deluluId,
            milestoneId,
            amount,
            isGenesis,
            isFinisher,
            msg.sender
        );

        IERC20(d.token).safeTransferFrom(msg.sender, address(this), amount);
        emit SupportStaked(deluluId, msg.sender, amount, d.totalSupporters);
    }

    function _processScouts(
        uint256 deluluId,
        uint256 milestoneId,
        uint256 amount,
        bool isGenesis,
        bool isFinisher,
        address tipper
    ) internal {
        bool isScout = false;
        uint256 creatorAmount = amount;

        if (isGenesis) {
            uint8 count = scoutCount[deluluId];
            if (count < 3) {
                address[3] storage scouts = firstScouts[deluluId];
                bool alreadyScout = false;
                for (uint8 i = 0; i < count; i++) {
                    if (scouts[i] == tipper) {
                        alreadyScout = true;
                        break;
                    }
                }
                if (!alreadyScout) {
                    scouts[count] = tipper;
                    scoutCount[deluluId] = count + 1;
                    isScout = true;
                }
            }
        } else if (scoutCount[deluluId] > 0) {
            uint8 sCount = scoutCount[deluluId];
            address[3] storage scoutsForGoal = firstScouts[deluluId];
            bool senderIsScout = false;
            for (uint8 j = 0; j < sCount; j++) {
                if (scoutsForGoal[j] == tipper) {
                    senderIsScout = true;
                    break;
                }
            }

            if (!senderIsScout) {
                uint256 scoutCut = (amount * SCOUT_FEE_BPS) /
                    BPS_DENOMINATOR;
                if (scoutCut > 0) {
                    uint256 perScout = scoutCut / sCount;
                    creatorAmount = amount - (perScout * sCount);
                    // Optimized loop: Use a local mapping pointer to save stack space
                    mapping(address => uint256)
                        storage earnings = scoutEarnings[deluluId];
                    for (uint8 k = 0; k < sCount; k++) {
                        earnings[scoutsForGoal[k]] += perScout;
                    }
                }
            }
        }

        delulus[deluluId].totalSupportCollected += creatorAmount;

        TipEventData memory eventData = TipEventData({
            deluluId: deluluId,
            milestoneId: milestoneId,
            tipper: tipper,
            amount: amount,
            isScout: isScout,
            isGenesis: isGenesis,
            isFinisher: isFinisher
        });

        emit TipExecuted(eventData);
    }

    // --- SETTLEMENT ---

    function verifyMilestone(
        uint256 deluluId,
        uint256 milestoneId,
        uint256 points
    ) external onlyVerifier {
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        if (!m.isSubmitted || m.isVerified) revert MilestoneNotFound();
        m.isVerified = true;
        userDeluluPoints[delulus[deluluId].creator] += points;
        emit MilestoneVerified(deluluId, milestoneId, points);
    }

    function rejectMilestone(
        uint256 deluluId,
        uint256 milestoneId,
        string calldata reason
    ) external onlyVerifier {
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        m.isSubmitted = false;
        emit MilestoneRejected(deluluId, milestoneId, reason);
    }

    function resolveDelulu(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();
        if (d.isResolved || marketIsFailed[deluluId]) revert AlreadySettled();
        // Allow either creator or owner to resolve
        if (msg.sender != d.creator && msg.sender != owner())
            revert Unauthorized();
        // Only after resolution deadline has passed
        if (block.timestamp < d.resolutionDeadline) revert InvalidDeadlines();

        d.isResolved = true;
        // Open 48h finisher window for late supporters
        marketFinisherWindowEnd[deluluId] = block.timestamp + 48 hours;
        finishedGoalsCount[d.creator] += 1;

        emit DeluluResolved(deluluId);
    }

    function claimPersonalMarketSupport(
        uint256 deluluId
    ) external nonReentrant {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (!d.isResolved || marketIsFailed[deluluId]) revert NotResolved();
        if (d.rewardClaimed) revert AlreadyClaimed();

        uint256 tips = d.totalSupportCollected;
        uint256 fee = (tips * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netTips = tips - fee;
        uint256 stakeToReturn = marketStakedAmount[deluluId];

        d.rewardClaimed = true;
        marketStakedAmount[deluluId] = 0; // Zero out stake to prevent any accounting edge cases

        IERC20(d.token).safeTransfer(platformFeeAddress, fee);
        IERC20(d.token).safeTransfer(d.creator, netTips + stakeToReturn);

        emit SupportClaimed(deluluId, d.creator, netTips + stakeToReturn, fee);
    }

    function claimChallengeReward(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        Challenge storage c = challenges[d.challengeId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (d.rewardClaimed) revert AlreadyClaimed();
        if (c.totalPoints == 0) revert NoPointsAllocated();
        if (block.timestamp <= c.startTime + c.duration)
            revert ChallengeNotClosed();

        uint256 reward = (d.points * c.poolAmount) / c.totalPoints;
        uint256 fee = (reward * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = reward - fee;

        d.rewardClaimed = true;
        totalReservedRewards -= reward;

        currency.safeTransfer(platformFeeAddress, fee);
        currency.safeTransfer(d.creator, net);
        emit ChallengeRewardClaimed(
            d.challengeId,
            deluluId,
            d.creator,
            net,
            fee
        );
    }

    /**
     * @notice Mark a goal as failed and allocate creator stake to the supporter refund pool.
     * @dev Internal helper shared by owner-settlement and permissionless slashing.
     */
    function _failGoal(
        uint256 deluluId,
        address slasher,
        bool payBounty
    ) internal {
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();
        if (d.isResolved || marketIsFailed[deluluId]) revert AlreadySettled();

        marketIsFailed[deluluId] = true;
        d.isResolved = true;

        uint256 stake = marketStakedAmount[deluluId];
        if (stake == 0) {
            emit GoalFailed(deluluId, 0);
            return;
        }

        marketStakedAmount[deluluId] = 0;

        uint256 bounty = 0;
        uint256 pool = stake;

        if (payBounty && slasher != address(0)) {
            bounty = (stake * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
            if (bounty > 0) {
                pool = stake - bounty;
                IERC20(d.token).safeTransfer(slasher, bounty);
            }
        }

        failedStakePool[deluluId] += pool;
        emit GoalFailed(deluluId, pool);
    }

    /**
     * @notice Owner-triggered failure settlement for a goal (no bounty).
     */
    function settleGoalFailure(
        uint256 deluluId
    ) external nonReentrant onlyOwner {
        _failGoal(deluluId, address(0), false);
    }

    /**
     * @notice Permissionless slashing for abandoned goals with missed milestones.
     * @dev Caller receives a small bounty from the creator's staked amount.
     */
    function slashAbandonedGoal(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        if (d.id == 0) revert DeluluNotFound();
        if (d.isResolved || marketIsFailed[deluluId]) revert AlreadySettled();

        bool hasMissed = false;
        uint256 count = d.milestoneCount;
        for (uint256 i = 0; i < count; i++) {
            Milestone storage m = deluluMilestones[deluluId][i];
            if (
                block.timestamp > m.deadline &&
                !m.isSubmitted &&
                !m.isVerified
            ) {
                hasMissed = true;
                break;
            }
        }

        if (!hasMissed) revert MilestoneNotFound();

        _failGoal(deluluId, msg.sender, true);
    }

    /**
     * @notice Claim pro‑rata share of the creator's slashed stake for a failed goal.
     * @dev Uses withdrawal pattern to avoid gas blowups. Non-reentrant.
     */
    function claimRefund(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        if (!marketIsFailed[deluluId]) revert NotResolved();
        if (refundClaimed[deluluId][msg.sender]) revert AlreadyClaimed();

        uint256 userSupport = supporterAmount[deluluId][msg.sender];
        if (userSupport == 0) revert StakeTooSmall();

        uint256 pool = failedStakePool[deluluId];
        uint256 total = totalSupportForProRata[deluluId];
        if (pool == 0 || total == 0) revert NotResolved();

        uint256 amountOut = (pool * userSupport) / total;
        refundClaimed[deluluId][msg.sender] = true;

        if (amountOut > 0) {
            IERC20(d.token).safeTransfer(msg.sender, amountOut);
        }

        emit StakeRefundClaimed(deluluId, msg.sender, amountOut);
    }

    /**
     * @notice Claim accumulated scout earnings for a specific goal.
     */
    function claimScoutEarnings(uint256 deluluId) external nonReentrant {
        uint256 amount = scoutEarnings[deluluId][msg.sender];
        require(amount > 0, "No scout earnings");

        scoutEarnings[deluluId][msg.sender] = 0;

        Market storage d = delulus[deluluId];
        IERC20(d.token).safeTransfer(msg.sender, amount);

        emit ScoutEarningsClaimed(deluluId, msg.sender, amount);
    }

    // --- VIEWS ---

    function getMilestoneInfo(
        uint256 dId,
        uint256 mId
    ) external view returns (bytes32, uint256, string memory, bool, bool) {
        Milestone storage m = deluluMilestones[dId][mId];
        return (
            m.descriptionHash,
            m.deadline,
            m.proofLink,
            m.isSubmitted,
            m.isVerified
        );
    }

    function getDeluluPoints(address user) external view returns (uint256) {
        return userDeluluPoints[user];
    }

    function getUsername(address user) external view returns (string memory) {
        return addressToUsername[user];
    }

    function getAddressByUsername(
        string calldata username
    ) external view returns (address) {
        return usernameToAddress[username];
    }

    function isUsernameTaken(
        string calldata username
    ) external view returns (bool) {
        return usernameToAddress[username] != address(0);
    }

    function refundChallengePool(uint256 challengeId) external onlyOwner {
        Challenge storage c = challenges[challengeId];
        if (c.totalPoints == 0) revert NoPointsAllocated();
        if (block.timestamp <= c.startTime + c.duration)
            revert ChallengeNotClosed();

        uint256 refundAmount = c.poolAmount;
        c.active = false;
        totalReservedRewards -= refundAmount;

        currency.safeTransfer(vault, refundAmount);
    }
}
