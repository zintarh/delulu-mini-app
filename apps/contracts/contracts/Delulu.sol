pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**`
 * @title DeluluMarket (Security Hardened Version)
 * @notice Parimutuel prediction market with enhanced security controls
 * @dev Addresses critical findings from security audit
 */
contract DeluluMarket is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ============ Custom Errors ============
    error StakingIsClosed();
    error StakingNotYetClosed();
    error AlreadyResolved();
    error NotResolved();
    error UserIsNotWinner();
    error AlreadyClaimed();
    error InsufficientStake();
    error InvalidDeadlines();
    error DeluluNotFound();
    error NotRefundable();
    error NoStakeToRefund();
    error TransferFailed();
    error InvalidTokenAddress();
    error EmptyContentHash();
    error StakeTooSmall();
    error StakeTooLarge();
    error StakeLimitExceeded();
    error QueryTooLarge();
    error SlippageTooHigh();
    error StakingDeadlineTooFar();
    error ResolutionDeadlineTooFar();

    // ============ Constants ============
    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant EMERGENCY_REFUND_DELAY = 7 days;
    uint256 private constant PRECISION = 1e18;

    // NEW: Stake limits (UPDATED FOR 18 DECIMALS / cUSD)
    uint256 public constant MIN_STAKE = 1e18; // 1 cUSD
    uint256 public constant MAX_STAKE = 1_000_000_000 * 1e18; // 1 Billion cUSD max (Safe overflow buffer)
    uint256 public constant MAX_STAKE_PER_USER = 100_000 * 1e18; // 100k cUSD per user per market

    // NEW: Deadline limits
    uint256 public constant MAX_STAKING_DURATION = 365 days;
    uint256 public constant MAX_RESOLUTION_DURATION = 730 days;

    // NEW: Query limits
    uint256 public constant MAX_DELULUS_PER_QUERY = 100;

    // ============ State Variables ============
    IERC20 public immutable stablecoin;
    uint256 public nextDeluluId = 1;
    uint256 public totalFeesCollected;

    // ============ Structs ============
    struct Delulu {
        uint256 id;
        address creator;
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

    enum DeluluState {
        OPEN,
        LOCKED,
        RESOLVED,
        CANCELLED
    }

    // ============ Storage ============
    mapping(uint256 => Delulu) public delulus;
    mapping(uint256 => mapping(address => UserPosition)) public userStakes;
    mapping(uint256 => mapping(address => uint256)) public userTotalStaked; // NEW: Track per-user totals

    // ============ Events ============
    event DeluluCreated(
        uint256 indexed deluluId,
        address indexed creator,
        string contentHash,
        uint256 stakingDeadline,
        uint256 resolutionDeadline,
        uint256 creatorStake
    );

    event StakePlaced(
        uint256 indexed deluluId,
        address indexed user,
        uint256 amount,
        bool side,
        uint256 newTotalPoolStake
    );

    event DeluluResolved(
        uint256 indexed deluluId,
        bool outcome,
        uint256 winningPool,
        uint256 losingPool
    );

    event WinningsClaimed(
        uint256 indexed deluluId,
        address indexed user,
        uint256 payout,
        uint256 feeCharged
    );

    event FeeCollected(uint256 indexed deluluId, uint256 amount);

    event EmergencyRefund(
        uint256 indexed deluluId,
        address indexed user,
        uint256 amount
    );

    event DelululCancelled(uint256 indexed deluluId);

    event FeesWithdrawn(address indexed owner, uint256 amount);

    // ============ Constructor ============
    /**
     * @param stablecoinAddress Address of stablecoin (USDC/cUSD)
     * @dev Mainnet USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
     * @dev Sepolia USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
     */
    constructor(address stablecoinAddress) Ownable(msg.sender) {
        if (stablecoinAddress == address(0)) revert InvalidTokenAddress();
        stablecoin = IERC20(stablecoinAddress);
    }

    // ============ Write Functions ============

    /**
     * @notice Create a new Delulu market
     * @param contentHash IPFS hash of prediction (cannot be empty)
     * @param stakingDeadline When staking closes
     * @param resolutionDeadline When resolution must occur by
     * @param amount Creator's initial stake (becomes first Believer)
     */
    function createDelulu(
        string calldata contentHash,
        uint256 stakingDeadline,
        uint256 resolutionDeadline,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Input validation
        if (bytes(contentHash).length == 0) revert EmptyContentHash();
        if (amount < MIN_STAKE) revert StakeTooSmall();
        if (amount > MAX_STAKE) revert StakeTooLarge();

        // Deadline validation with bounds
        if (stakingDeadline <= block.timestamp) revert InvalidDeadlines();
        if (stakingDeadline > block.timestamp + MAX_STAKING_DURATION)
            revert StakingDeadlineTooFar();
        if (resolutionDeadline <= stakingDeadline) revert InvalidDeadlines();
        if (resolutionDeadline > stakingDeadline + MAX_RESOLUTION_DURATION)
            revert ResolutionDeadlineTooFar();

        uint256 deluluId = nextDeluluId++;

        delulus[deluluId] = Delulu({
            id: deluluId,
            creator: msg.sender,
            contentHash: contentHash,
            stakingDeadline: stakingDeadline,
            resolutionDeadline: resolutionDeadline,
            totalBelieverStake: amount,
            totalDoubterStake: 0,
            outcome: false,
            isResolved: false,
            isCancelled: false
        });

        userStakes[deluluId][msg.sender] = UserPosition({
            amount: amount,
            side: true,
            claimed: false
        });

        userTotalStaked[deluluId][msg.sender] = amount;

        // CEI: Transfer AFTER state updates
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        emit DeluluCreated(
            deluluId,
            msg.sender,
            contentHash,
            stakingDeadline,
            resolutionDeadline,
            amount
        );

        emit StakePlaced(deluluId, msg.sender, amount, true, amount);

        return deluluId;
    }

    /**
     * @notice Stake on a Delulu outcome with slippage protection
     * @param deluluId Market ID
     * @param side true = Believer, false = Doubter
     * @param amount Stake amount
     * @param minPayout Minimum acceptable payout (reverts if odds worse than expected)
     */
    function stakeOnDelulu(
        uint256 deluluId,
        bool side,
        uint256 amount,
        uint256 minPayout
    ) external nonReentrant whenNotPaused {
        Delulu storage delulu = delulus[deluluId];

        // Validation
        if (delulu.id == 0) revert DeluluNotFound();
        if (block.timestamp >= delulu.stakingDeadline) revert StakingIsClosed();
        if (delulu.isResolved || delulu.isCancelled) revert AlreadyResolved();
        if (amount < MIN_STAKE) revert StakeTooSmall();
        if (amount > MAX_STAKE) revert StakeTooLarge();

        // Per-user stake limit
        if (userTotalStaked[deluluId][msg.sender] + amount > MAX_STAKE_PER_USER)
            revert StakeLimitExceeded();

        // Slippage protection: Check expected payout BEFORE state changes
        uint256 expectedPayout = _calculatePotentialPayout(
            delulu.totalBelieverStake,
            delulu.totalDoubterStake,
            amount,
            side
        );
        if (expectedPayout < minPayout) revert SlippageTooHigh();

        // Update state
        if (side) {
            delulu.totalBelieverStake += amount;
        } else {
            delulu.totalDoubterStake += amount;
        }

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0) {
            position.side = side;
            position.amount = amount;
        } else {
            require(position.side == side, "Cannot switch sides");
            position.amount += amount;
        }

        userTotalStaked[deluluId][msg.sender] += amount;

        uint256 newTotalPoolStake = side
            ? delulu.totalBelieverStake
            : delulu.totalDoubterStake;

        // CEI: Transfer AFTER state updates
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        emit StakePlaced(deluluId, msg.sender, amount, side, newTotalPoolStake);
    }

    /**
     * @notice Resolve market (Admin only)
     */
    function resolveDelulu(
        uint256 deluluId,
        bool outcome
    ) external onlyOwner nonReentrant {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (block.timestamp < delulu.stakingDeadline)
            revert StakingNotYetClosed();
        if (delulu.isResolved) revert AlreadyResolved();
        if (delulu.isCancelled) revert AlreadyResolved();

        delulu.outcome = outcome;
        delulu.isResolved = true;

        uint256 winningPool = outcome
            ? delulu.totalBelieverStake
            : delulu.totalDoubterStake;
        uint256 losingPool = outcome
            ? delulu.totalDoubterStake
            : delulu.totalBelieverStake;

        emit DeluluResolved(deluluId, outcome, winningPool, losingPool);
    }

    /**
     * @notice Claim winnings
     */
    function claimWinnings(
        uint256 deluluId
    ) external nonReentrant whenNotPaused {
        if (!isClaimable(deluluId, msg.sender)) revert UserIsNotWinner();

        Delulu storage delulu = delulus[deluluId];
        UserPosition storage position = userStakes[deluluId][msg.sender];

        // CEI: Mark claimed BEFORE calculations
        position.claimed = true;

        uint256 winningPool = delulu.outcome
            ? delulu.totalBelieverStake
            : delulu.totalDoubterStake;
        uint256 losingPool = delulu.outcome
            ? delulu.totalDoubterStake
            : delulu.totalBelieverStake;

        uint256 netPayout;
        uint256 platformFee;

        // Zero opposition = no fee
        if (losingPool == 0) {
            netPayout = position.amount;
            platformFee = 0;
        } else {
            uint256 totalPool = winningPool + losingPool;
            uint256 userShare = (position.amount * PRECISION) / winningPool;
            uint256 grossPayout = (userShare * totalPool) / PRECISION;

            platformFee = (grossPayout * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
            netPayout = grossPayout - platformFee;
        }

        totalFeesCollected += platformFee;

        // CEI: External call LAST
        stablecoin.safeTransfer(msg.sender, netPayout);

        // Emit events after transfer for perfect CEI
        if (platformFee > 0) {
            emit FeeCollected(deluluId, platformFee);
        }
        emit WinningsClaimed(deluluId, msg.sender, netPayout, platformFee);
    }

    /**
     * @notice Emergency refund
     */
    function emergencyRefund(uint256 deluluId) external nonReentrant {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();

        bool isRefundable = delulu.isCancelled ||
            (block.timestamp >
                delulu.resolutionDeadline + EMERGENCY_REFUND_DELAY &&
                !delulu.isResolved);

        if (!isRefundable) revert NotRefundable();

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0 || position.claimed) revert NoStakeToRefund();

        uint256 refundAmount = position.amount;
        position.claimed = true;

        stablecoin.safeTransfer(msg.sender, refundAmount);

        emit EmergencyRefund(deluluId, msg.sender, refundAmount);
    }

    /**
     * @notice Cancel market (Admin)
     */
    function cancelDelulu(uint256 deluluId) external onlyOwner {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (delulu.isResolved) revert AlreadyResolved();

        delulu.isCancelled = true;
        emit DelululCancelled(deluluId);
    }

    /**
     * @notice Withdraw fees (Admin)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;

        stablecoin.safeTransfer(msg.sender, amount);

        emit FeesWithdrawn(msg.sender, amount);
    }

    // ============ Emergency Controls ============

    /**
     * @notice Pause all operations (Admin only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause operations (Admin only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Calculate potential payout
     */
    function getPotentialPayout(
        uint256 deluluId,
        uint256 amount,
        bool isBeliever
    ) external view returns (uint256) {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) return 0;

        return
            _calculatePotentialPayout(
                delulu.totalBelieverStake,
                delulu.totalDoubterStake,
                amount,
                isBeliever
            );
    }

    /**
     * @notice Internal payout calculation
     */
    function _calculatePotentialPayout(
        uint256 believerPool,
        uint256 doubterPool,
        uint256 amount,
        bool isBeliever
    ) internal pure returns (uint256) {
        uint256 currentPool = isBeliever ? believerPool : doubterPool;
        uint256 opposingPool = isBeliever ? doubterPool : believerPool;

        if (opposingPool == 0) return amount;

        uint256 newPool = currentPool + amount;
        uint256 totalPool = newPool + opposingPool;

        uint256 userShare = (amount * PRECISION) / newPool;
        uint256 grossPayout = (userShare * totalPool) / PRECISION;

        uint256 platformFee = (grossPayout * PLATFORM_FEE_BPS) /
            BPS_DENOMINATOR;
        return grossPayout - platformFee;
    }

    /**
     * @notice Check if user can claim
     */
    function isClaimable(
        uint256 deluluId,
        address user
    ) public view returns (bool) {
        Delulu storage delulu = delulus[deluluId];
        if (!delulu.isResolved) return false;

        UserPosition storage position = userStakes[deluluId][user];
        if (position.claimed) return false;
        if (position.amount == 0) return false;

        return position.side == delulu.outcome;
    }

    function getUserPosition(
        uint256 deluluId,
        address user
    ) external view returns (UserPosition memory) {
        return userStakes[deluluId][user];
    }

    function getDeluluState(
        uint256 deluluId
    ) external view returns (DeluluState) {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();

        if (delulu.isCancelled) return DeluluState.CANCELLED;
        if (delulu.isResolved) return DeluluState.RESOLVED;
        if (block.timestamp >= delulu.stakingDeadline)
            return DeluluState.LOCKED;
        return DeluluState.OPEN;
    }

    function getDelulu(uint256 deluluId) external view returns (Delulu memory) {
        return delulus[deluluId];
    }

    /**
     * @notice Get multiple Delulus with query limit
     */
    function getDelulus(
        uint256 startId,
        uint256 count
    ) external view returns (Delulu[] memory) {
        if (count > MAX_DELULUS_PER_QUERY) revert QueryTooLarge();

        uint256 endId = startId + count;
        if (endId > nextDeluluId) {
            endId = nextDeluluId;
        }

        uint256 resultCount = endId - startId;
        Delulu[] memory result = new Delulu[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = delulus[startId + i];
        }

        return result;
    }

    function getTokenAddress() external view returns (address) {
        return address(stablecoin);
    }
}

