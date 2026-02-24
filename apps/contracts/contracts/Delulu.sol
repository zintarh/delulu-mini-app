// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Delulu is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
{
    using SafeERC20 for IERC20;

    // --- ERRORS ---
    error StakingIsClosed();
    error AlreadyResolved();
    error NotResolved();
    error UserIsNotWinner();
    error AlreadyClaimed();
    error InvalidDeadlines();
    error DeluluNotFound();
    error NotRefundable();
    error NoStakeToRefund();
    error InvalidTokenAddress();
    error TokenNotSupported();
    error EmptyContentHash();
    error StakeTooSmall();
    error StakeTooLarge();
    error StakeLimitExceeded();
    error MarketCancelled();
    error PayoutCalculationError();
    error CannotSwitchSides();
    error Unauthorized();
    error StakingDeadlineTooFar();      
    error ResolutionDeadlineTooFar();  
    error SlippageTooHigh();            

    uint256 public constant EMERGENCY_REFUND_DELAY = 7 days;
    uint256 private constant PRECISION = 1e18;
    uint256 public constant MIN_STAKE = 1e18; 
    uint256 public constant MAX_STAKE = 1_000_000_000 * 1e18; 
    uint256 public constant MAX_STAKE_PER_USER = 100_000 * 1e18; 
    uint256 public constant MAX_STAKING_DURATION = 365 days;
    uint256 public constant MAX_RESOLUTION_DURATION = 730 days;

    IERC20 public currency; 
    uint256 public nextDeluluId; 

    struct Market {
        uint256 id;
        address creator;
        address token; 
        string contentHash;
        uint256 stakingDeadline;
        uint256 resolutionDeadline;
        uint256 totalBelieverStake;
        uint256 totalDoubterStake;
        bool outcome;
        bool isResolved;
        bool isCancelled;
    }

    struct UserPosition {
        uint256 amount;
        bool side;
        bool claimed;
    }

    enum DeluluState { OPEN, LOCKED, RESOLVED, CANCELLED }

    mapping(uint256 => Market) public delulus;
    mapping(uint256 => mapping(address => UserPosition)) public userStakes;
    mapping(uint256 => mapping(address => uint256)) public userTotalStaked;
    mapping(address => bool) public isSupportedToken;

    uint256[49] private __gap; 

    event DeluluCreated(uint256 indexed deluluId, address indexed creator, address indexed token, string contentHash, uint256 stakingDeadline, uint256 resolutionDeadline, uint256 creatorStake);
    event StakePlaced(uint256 indexed deluluId, address indexed user, uint256 amount, bool side, uint256 newTotalPoolStake);
    event DeluluResolved(uint256 indexed deluluId, bool outcome, uint256 winningPool, uint256 losingPool);
    event WinningsClaimed(uint256 indexed deluluId, address indexed user, uint256 payout);
    event EmergencyRefund(uint256 indexed deluluId, address indexed user, uint256 amount);
    event DeluluCancelled(uint256 indexed deluluId, address indexed cancelledBy);
    event TokenSupportStatusChanged(address indexed token, bool status);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _defaultCurrency) public initializer {
        if (_defaultCurrency == address(0)) revert InvalidTokenAddress();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        currency = IERC20(_defaultCurrency);
        isSupportedToken[_defaultCurrency] = true;
        nextDeluluId = 1; 
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setTokenSupport(address _token, bool _status) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        isSupportedToken[_token] = _status;
        emit TokenSupportStatusChanged(_token, _status);
    }

    function createDelulu(
        address token, 
        string calldata contentHash,
        uint256 stakingDeadline,
        uint256 resolutionDeadline,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (!isSupportedToken[token]) revert TokenNotSupported();
        if (bytes(contentHash).length == 0) revert EmptyContentHash();
        if (amount < MIN_STAKE) revert StakeTooSmall();
        
        if (stakingDeadline <= block.timestamp) revert InvalidDeadlines();
        if (stakingDeadline > block.timestamp + MAX_STAKING_DURATION) revert StakingDeadlineTooFar();
        if (resolutionDeadline <= stakingDeadline) revert InvalidDeadlines();
        if (resolutionDeadline > stakingDeadline + MAX_RESOLUTION_DURATION) revert ResolutionDeadlineTooFar();

        uint256 deluluId = nextDeluluId++;

        delulus[deluluId] = Market({
            id: deluluId,
            creator: msg.sender,
            token: token, 
            contentHash: contentHash,
            stakingDeadline: stakingDeadline,
            resolutionDeadline: resolutionDeadline,
            totalBelieverStake: amount,
            totalDoubterStake: 0,
            outcome: false,
            isResolved: false,
            isCancelled: false
        });

        userStakes[deluluId][msg.sender] = UserPosition({amount: amount, side: true, claimed: false});
        userTotalStaked[deluluId][msg.sender] = amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit DeluluCreated(deluluId, msg.sender, token, contentHash, stakingDeadline, resolutionDeadline, amount);
        emit StakePlaced(deluluId, msg.sender, amount, true, amount);

        return deluluId;
    }

    function stakeOnDelulu(uint256 deluluId, bool side, uint256 amount, uint256 minPayout) external nonReentrant whenNotPaused {
        Market storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (block.timestamp >= delulu.stakingDeadline) revert StakingIsClosed();
        if (delulu.isResolved || delulu.isCancelled) revert AlreadyResolved();
        if (userTotalStaked[deluluId][msg.sender] + amount > MAX_STAKE_PER_USER) revert StakeLimitExceeded();

        uint256 expectedPayout = _calculatePotentialPayout(delulu.totalBelieverStake, delulu.totalDoubterStake, amount, side);
        if (expectedPayout < minPayout) revert SlippageTooHigh();

        if (side) delulu.totalBelieverStake += amount;
        else delulu.totalDoubterStake += amount;

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0) {
            position.side = side;
            position.amount = amount;
        } else {
            if (position.side != side) revert CannotSwitchSides();
            position.amount += amount;
        }

        userTotalStaked[deluluId][msg.sender] += amount;
        IERC20(delulu.token).safeTransferFrom(msg.sender, address(this), amount);

        emit StakePlaced(deluluId, msg.sender, amount, side, side ? delulu.totalBelieverStake : delulu.totalDoubterStake);
    }

    function claimWinnings(uint256 deluluId) external nonReentrant whenNotPaused {
        Market storage delulu = delulus[deluluId];
        if (!delulu.isResolved) revert NotResolved();
        if (delulu.isCancelled) revert MarketCancelled();

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0) revert NoStakeToRefund();
        if (position.claimed) revert AlreadyClaimed();
        if (position.side != delulu.outcome) revert UserIsNotWinner();

        position.claimed = true;
        uint256 winningPool = delulu.outcome ? delulu.totalBelieverStake : delulu.totalDoubterStake;
        uint256 totalPool = delulu.totalBelieverStake + delulu.totalDoubterStake;
        uint256 netPayout = (position.amount * totalPool) / winningPool;
        
        IERC20(delulu.token).safeTransfer(msg.sender, netPayout);
        emit WinningsClaimed(deluluId, msg.sender, netPayout);
    }

    function emergencyRefund(uint256 deluluId) external nonReentrant {
        Market storage delulu = delulus[deluluId];
        bool isRefundable = delulu.isCancelled || 
            (block.timestamp > delulu.resolutionDeadline + EMERGENCY_REFUND_DELAY && !delulu.isResolved);

        if (!isRefundable) revert NotRefundable();

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0 || position.claimed) revert NoStakeToRefund();

        uint256 amount = position.amount;
        position.claimed = true;

        IERC20(delulu.token).safeTransfer(msg.sender, amount);
        emit EmergencyRefund(deluluId, msg.sender, amount);
    }

    function resolveDelulu(uint256 deluluId, bool outcome) external {
        Market storage delulu = delulus[deluluId];
        if (msg.sender != owner() && msg.sender != delulu.creator) revert Unauthorized();
        if (delulu.isResolved) revert AlreadyResolved();
        delulu.outcome = outcome;
        delulu.isResolved = true;
        emit DeluluResolved(deluluId, outcome, delulu.totalBelieverStake, delulu.totalDoubterStake);
    }

    function cancelDelulu(uint256 deluluId) external {
        Market storage delulu = delulus[deluluId];
        if (msg.sender != owner() && msg.sender != delulu.creator) revert Unauthorized();
        delulu.isCancelled = true;
        emit DeluluCancelled(deluluId, msg.sender);
    }

    function _calculatePotentialPayout(uint256 bPool, uint256 dPool, uint256 amt, bool isBel) internal pure returns (uint256) {
        uint256 cur = isBel ? bPool : dPool;
        uint256 opp = isBel ? dPool : bPool;
        if (opp == 0) return amt;
        uint256 nP = cur + amt;
        return (amt * (nP + opp)) / nP;
    }

    function getMarketToken(uint256 deluluId) external view returns (address) {
        return delulus[deluluId].token;
    }

    function getTokenAddress() external view returns (address) {
        return address(currency);
    }

    function getDeluluState(uint256 deluluId) external view returns (DeluluState) {
        Market storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (delulu.isCancelled) return DeluluState.CANCELLED;
        if (delulu.isResolved) return DeluluState.RESOLVED;
        if (block.timestamp >= delulu.stakingDeadline) return DeluluState.LOCKED;
        return DeluluState.OPEN;
    }

    function getDelulu(uint256 deluluId) external view returns (Market memory) {
        return delulus[deluluId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}