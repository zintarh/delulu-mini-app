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

    // --- CONSTANTS ---
    uint256 public constant MAX_MILESTONES = 10;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1%
    uint256 public constant CLAIM_WINDOW = 30 days;
    uint256 public constant MIN_STAKE = 1e18; 

    // --- STATE ---
    IERC20 public currency; 
    address public vault; 
    address public goodDollarRegistry; 
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

    mapping(uint256 => Market) public delulus;
    mapping(uint256 => mapping(uint256 => Milestone)) public deluluMilestones;
    mapping(uint256 => Challenge) public challenges;
    mapping(address => uint256) public userDeluluPoints;
    mapping(address => string) public addressToUsername;
    mapping(string => address) public usernameToAddress;
    mapping(address => bool) public isSupportedToken;

    // --- EVENTS ---
    event ProfileUpdated(address indexed user, string username);
    event ChallengeCreated(uint256 indexed challengeId, string contentHash, uint256 poolAmount, uint256 startTime, uint256 duration);
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
    event DeluluJoinedChallenge(uint256 indexed deluluId, uint256 indexed challengeId);
    event PointsAllocated(uint256 indexed deluluId, uint256 points, uint256 totalPoints);
    event MilestonesAdded(uint256 indexed deluluId, uint256 count);
    event MilestoneSubmitted(uint256 indexed deluluId, uint256 indexed milestoneId, string proofLink);
    event MilestoneVerified(uint256 indexed deluluId, uint256 indexed milestoneId, uint256 pointsEarned);
    event MilestoneRejected(uint256 indexed deluluId, uint256 indexed milestoneId, string reason);
    event SupportStaked(uint256 indexed deluluId, address indexed supporter, uint256 amount, uint256 totalSupporters);
    event SupportClaimed(uint256 indexed deluluId, address indexed creator, uint256 netSupport, uint256 fee);
    event ChallengeRewardClaimed(uint256 indexed challengeId, uint256 indexed deluluId, address indexed creator, uint256 netReward, uint256 fee);
    event VaultSwept(address indexed vault, uint256 netAmount, uint256 fee);
    event CurrencyUpdated(address indexed newCurrency);
    event RegistryUpdated(address indexed newRegistry);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _defaultCurrency, address _vault, address _gDollar) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        currency = IERC20(_defaultCurrency);
        isSupportedToken[_defaultCurrency] = true;
        vault = _vault;
        goodDollarRegistry = _gDollar;
        
        nextDeluluId = 1;
        nextChallengeId = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- SYSTEM ADMIN FUNCTIONS ---

    function setCurrency(address _token) external onlyOwner {
        currency = IERC20(_token);
        isSupportedToken[_token] = true;
        emit CurrencyUpdated(_token);
    }

    function setGoodDollarRegistry(address _registry) external onlyOwner {
        goodDollarRegistry = _registry;
        emit RegistryUpdated(_registry);
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    function setTokenSupport(address _token, bool _status) external onlyOwner {
        isSupportedToken[_token] = _status;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

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

    function createChallenge(string calldata _contentHash, uint256 _poolAmount, uint256 _duration) external onlyOwner {
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
        emit ChallengeCreated(challengeId, _contentHash, _poolAmount, startTime, _duration);
    }

    function allocatePoints(uint256 deluluId, uint256 points) external onlyOwner {
        Market storage d = delulus[deluluId];
        if (d.challengeId == 0) revert ChallengeNotFound();
        Challenge storage c = challenges[d.challengeId];
        
        c.totalPoints = (c.totalPoints - d.points) + points;
        d.points = points;
        userDeluluPoints[d.creator] += points;
        emit PointsAllocated(deluluId, points, c.totalPoints);
    }

    // --- CORE EXECUTION ---

    function createDelulu(address token, string calldata contentHash, uint256 stakingDeadline, uint256 resolutionDeadline, uint256 initialSupport) 
        external nonReentrant whenNotPaused returns (uint256) 
    {
        if (bytes(addressToUsername[msg.sender]).length == 0) revert ProfileRequired();
        if (stakingDeadline <= block.timestamp || resolutionDeadline <= stakingDeadline) revert InvalidDeadlines();
        if (!isSupportedToken[token]) revert Unauthorized();
        if (initialSupport < MIN_STAKE) revert StakeTooSmall();

        uint256 deluluId = nextDeluluId++;
        Market storage d = delulus[deluluId];
        d.id = deluluId;
        d.creator = msg.sender;
        d.token = token;
        d.contentHash = contentHash;
        d.stakingDeadline = stakingDeadline;
        d.resolutionDeadline = resolutionDeadline;
        d.totalSupportCollected = initialSupport;
        d.totalSupporters = 1;

        IERC20(token).safeTransferFrom(msg.sender, address(this), initialSupport);
        emit DeluluCreated(
            deluluId, 
            msg.sender, 
            token,
            contentHash, 
            stakingDeadline,
            resolutionDeadline,
            initialSupport,
            d.totalSupportCollected,
            d.totalSupporters
        );
        return deluluId;
    }

    function addMilestones(uint256 deluluId, bytes32[] calldata mHashes, uint256[] calldata mDurations) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (d.milestoneCount > 0) revert AlreadyInitialized();
        if (mHashes.length == 0 || mHashes.length > MAX_MILESTONES) revert TooManyMilestones();

        uint256 runningDeadline = block.timestamp;
        for (uint256 i = 0; i < mHashes.length; i++) {
            runningDeadline += mDurations[i];
            deluluMilestones[deluluId][i] = Milestone({
                descriptionHash: mHashes[i],
                deadline: runningDeadline,
                proofLink: "",
                isSubmitted: false,
                isVerified: false
            });
        }
        d.milestoneCount = mHashes.length;
        if (runningDeadline > d.resolutionDeadline) revert InvalidDeadlines();
        emit MilestonesAdded(deluluId, d.milestoneCount);
    }

    function submitMilestone(uint256 deluluId, uint256 milestoneId, string calldata proofLink) external {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        if (m.isVerified) revert MilestoneAlreadyCompleted();
        
        m.proofLink = proofLink;
        m.isSubmitted = true;
        emit MilestoneSubmitted(deluluId, milestoneId, proofLink);
    }

    function stakeDelulu(uint256 deluluId, uint256 amount) external nonReentrant whenNotPaused {
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
        if (!c.active || block.timestamp > c.startTime + c.duration) revert ChallengeExpired();
        d.challengeId = challengeId;
        emit DeluluJoinedChallenge(deluluId, challengeId);
    }

    // --- SETTLEMENT ---

    function verifyMilestone(uint256 deluluId, uint256 milestoneId, uint256 points) external onlyOwner {
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        if (!m.isSubmitted || m.isVerified) revert MilestoneNotFound();
        m.isVerified = true;
        userDeluluPoints[delulus[deluluId].creator] += points;
        emit MilestoneVerified(deluluId, milestoneId, points);
    }

    function rejectMilestone(uint256 deluluId, uint256 milestoneId, string calldata reason) external onlyOwner {
        Milestone storage m = deluluMilestones[deluluId][milestoneId];
        m.isSubmitted = false;
        emit MilestoneRejected(deluluId, milestoneId, reason);
    }

    function resolveDelulu(uint256 deluluId) external onlyOwner {
        delulus[deluluId].isResolved = true;
        emit DeluluResolved(deluluId);
    }

    function claimPersonalMarketSupport(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (!d.isResolved) revert NotResolved();
        if (d.rewardClaimed) revert AlreadyClaimed();

        uint256 total = d.totalSupportCollected;
        uint256 fee = (total * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = total - fee;

        d.rewardClaimed = true;
        IERC20(d.token).safeTransfer(goodDollarRegistry, fee);
        IERC20(d.token).safeTransfer(d.creator, net);
        emit SupportClaimed(deluluId, d.creator, net, fee);
    }

    function claimChallengeReward(uint256 deluluId) external nonReentrant {
        Market storage d = delulus[deluluId];
        Challenge storage c = challenges[d.challengeId];
        if (msg.sender != d.creator) revert Unauthorized();
        if (d.rewardClaimed) revert AlreadyClaimed();
        if (c.totalPoints == 0) revert NoPointsAllocated();
        if (block.timestamp <= c.startTime + c.duration) revert ChallengeNotClosed();

        uint256 reward = (d.points * c.poolAmount) / c.totalPoints;
        uint256 fee = (reward * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = reward - fee;

        d.rewardClaimed = true;
        totalReservedRewards -= reward;

        currency.safeTransfer(goodDollarRegistry, fee);
        currency.safeTransfer(d.creator, net);
        emit ChallengeRewardClaimed(d.challengeId, deluluId, d.creator, net, fee);
    }

    function sweepToVault(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance <= totalReservedRewards) revert InsufficientSweepBalance();
        uint256 sweepable = balance - totalReservedRewards;
        uint256 fee = (sweepable * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = sweepable - fee;
        IERC20(token).safeTransfer(vault, net);
        IERC20(token).safeTransfer(goodDollarRegistry, fee);
        emit VaultSwept(vault, net, fee);
    }

    // --- VIEWS ---

    function getMilestoneInfo(uint256 dId, uint256 mId) external view returns (bytes32, uint256, string memory, bool, bool) {
        Milestone storage m = deluluMilestones[dId][mId];
        return (m.descriptionHash, m.deadline, m.proofLink, m.isSubmitted, m.isVerified);
    }

    function getDeluluPoints(address user) external view returns (uint256) {
        return userDeluluPoints[user];
    }

    function getUsername(address user) external view returns (string memory) {
        return addressToUsername[user];
    }

    function getAddressByUsername(string calldata username) external view returns (address) {
        return usernameToAddress[username];
    }

    function isUsernameTaken(string calldata username) external view returns (bool) {
        return usernameToAddress[username] != address(0);
    }

    function refundChallengePool(uint256 challengeId) external onlyOwner {
        Challenge storage c = challenges[challengeId];
        if (c.totalPoints == 0) revert NoPointsAllocated();
        if (block.timestamp <= c.startTime + c.duration) revert ChallengeNotClosed();
        
        uint256 refundAmount = c.poolAmount;
        c.active = false;
        totalReservedRewards -= refundAmount;
        
        currency.safeTransfer(vault, refundAmount);
    }
}