// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DeluluMarket (Production Ready - No Platform Fee)
 * @notice Parimutuel prediction market with zero platform fees
 * @dev Winners split the entire pool proportionally based on their stake
 * @author DeluluMarket Team
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
    error InvalidDeadlines();
    error DeluluNotFound();
    error NotRefundable();
    error NoStakeToRefund();
    error InvalidTokenAddress();
    error EmptyContentHash();
    error StakeTooSmall();
    error StakeTooLarge();
    error StakeLimitExceeded();
    error QueryTooLarge();
    error SlippageTooHigh();
    error StakingDeadlineTooFar();
    error ResolutionDeadlineTooFar();
    error MarketCancelled();
    error PayoutCalculationError();
    error CannotSwitchSides();

    // ============ Constants ============
    uint256 public constant EMERGENCY_REFUND_DELAY = 7 days;
    uint256 private constant PRECISION = 1e18;

    // Stake limits (18 decimals for cUSD/USDC)
    uint256 public constant MIN_STAKE = 1e18; // 1 token minimum
    uint256 public constant MAX_STAKE = 1_000_000_000 * 1e18; // 1 billion token max
    uint256 public constant MAX_STAKE_PER_USER = 100_000 * 1e18; // 100k per user per market

    // Deadline limits
    uint256 public constant MAX_STAKING_DURATION = 365 days;
    uint256 public constant MAX_RESOLUTION_DURATION = 730 days;

    // Query limits
    uint256 public constant MAX_DELULUS_PER_QUERY = 100;

    // ============ State Variables ============
    IERC20 public immutable stablecoin;
    uint256 public nextDeluluId = 1;

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
    mapping(uint256 => mapping(address => uint256)) public userTotalStaked;

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
        uint256 payout
    );

    event EmergencyRefund(
        uint256 indexed deluluId,
        address indexed user,
        uint256 amount
    );

    event DeluluCancelled(uint256 indexed deluluId);

    // ============ Constructor ============
    /**
     * @param stablecoinAddress Address of stablecoin (USDC/cUSD)
     * @dev Mainnet USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
     * @dev Celo cUSD: 0x765DE816845861e75A25fCA122bb6898B8B1282a
     * @dev Base Sepolia USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
     */
    constructor(address stablecoinAddress) Ownable(msg.sender) {
        if (stablecoinAddress == address(0)) revert InvalidTokenAddress();
        stablecoin = IERC20(stablecoinAddress);
    }

    // ============ Write Functions ============

    /**
     * @notice Create a new Delulu prediction market
     * @param contentHash IPFS hash of prediction details
     * @param stakingDeadline Timestamp when staking closes
     * @param resolutionDeadline Timestamp when resolution must occur by
     * @param amount Creator's initial stake (automatically placed on Believer side)
     * @return deluluId The ID of the newly created market
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

        // Deadline validation
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
            side: true, // Creator is always a Believer
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
     * @param deluluId Market ID to stake on
     * @param side true = Believer (prediction will happen), false = Doubter (won't happen)
     * @param amount Amount of tokens to stake
     * @param minPayout Minimum acceptable payout (slippage protection)
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
            // First stake on this market
            position.side = side;
            position.amount = amount;
        } else {
            // Adding to existing position
            if (position.side != side) revert CannotSwitchSides();
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
     * @notice Resolve a market (Admin only)
     * @param deluluId Market ID to resolve
     * @param outcome true = Believers win, false = Doubters win
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
        if (delulu.isCancelled) revert MarketCancelled();

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
     * @notice Claim winnings after market resolution (NO PLATFORM FEE)
     * @param deluluId Market ID to claim from
     * @dev Winners receive their proportional share of the ENTIRE pool
     * @dev Formula: userPayout = (userStake / winningPool) * totalPool
     */
    function claimWinnings(
        uint256 deluluId
    ) external nonReentrant whenNotPaused {
        Delulu storage delulu = delulus[deluluId];

        // Validation
        if (delulu.id == 0) revert DeluluNotFound();
        if (!delulu.isResolved) revert NotResolved();
        if (delulu.isCancelled) revert MarketCancelled();

        UserPosition storage position = userStakes[deluluId][msg.sender];

        if (position.amount == 0) revert NoStakeToRefund();
        if (position.claimed) revert AlreadyClaimed();
        if (position.side != delulu.outcome) revert UserIsNotWinner();

        // CEI: Mark claimed BEFORE calculations
        position.claimed = true;

        uint256 winningPool = delulu.outcome
            ? delulu.totalBelieverStake
            : delulu.totalDoubterStake;
        uint256 losingPool = delulu.outcome
            ? delulu.totalDoubterStake
            : delulu.totalBelieverStake;

        uint256 netPayout;

        // Edge case: No opposition, return original stake
        if (losingPool == 0) {
            netPayout = position.amount;
        } else {
            // Normal case: Calculate proportional payout
            if (winningPool == 0) revert PayoutCalculationError();

            uint256 totalPool = winningPool + losingPool;

            // Calculate user's proportional share with high precision
            // userShare = (userStake / winningPool)
            uint256 userShare = (position.amount * PRECISION) / winningPool;

            // grossPayout = userShare * totalPool
            uint256 grossPayout = (userShare * totalPool) / PRECISION;

            // NO PLATFORM FEE - user gets full payout
            netPayout = grossPayout;

            // Sanity check: payout should always be >= original stake
            if (netPayout < position.amount) revert PayoutCalculationError();
        }

        // CEI: External call LAST
        stablecoin.safeTransfer(msg.sender, netPayout);

        emit WinningsClaimed(deluluId, msg.sender, netPayout);
    }

    /**
     * @notice Emergency refund for cancelled or unresolved markets
     * @param deluluId Market ID to refund from
     * @dev Users can claim refunds if:
     *      1. Market is cancelled by admin, OR
     *      2. Market not resolved 7 days after resolution deadline
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
     * @notice Cancel a market and allow refunds (Admin only)
     * @param deluluId Market ID to cancel
     */
    function cancelDelulu(uint256 deluluId) external onlyOwner {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (delulu.isResolved) revert AlreadyResolved();

        delulu.isCancelled = true;
        emit DeluluCancelled(deluluId);
    }

    // ============ Emergency Controls ============

    /**
     * @notice Pause all market operations (Admin only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause market operations (Admin only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Calculate potential payout for a stake
     * @param deluluId Market ID
     * @param amount Amount to potentially stake
     * @param isBeliever true for Believer side, false for Doubter side
     * @return Expected payout if this side wins (includes original stake)
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
     * @notice Internal payout calculation (NO PLATFORM FEE)
     * @dev Formula: (amount / newPoolSize) * totalPool
     */
    function _calculatePotentialPayout(
        uint256 believerPool,
        uint256 doubterPool,
        uint256 amount,
        bool isBeliever
    ) internal pure returns (uint256) {
        uint256 currentPool = isBeliever ? believerPool : doubterPool;
        uint256 opposingPool = isBeliever ? doubterPool : believerPool;

        // If no opposition, return original stake
        if (opposingPool == 0) return amount;

        uint256 newPool = currentPool + amount;

        // Safety check
        if (newPool == 0) return 0;

        uint256 totalPool = newPool + opposingPool;

        // Calculate proportional payout
        uint256 userShare = (amount * PRECISION) / newPool;
        uint256 grossPayout = (userShare * totalPool) / PRECISION;

        // NO PLATFORM FEE - return full payout
        return grossPayout;
    }

    /**
     * @notice Calculate current odds multiplier for a side
     * @param deluluId Market ID
     * @param isBeliever true for Believer odds, false for Doubter odds
     * @return Multiplier in 18 decimals (e.g., 1.5e18 = 1.5x)
     */
    function getOddsMultiplier(
        uint256 deluluId,
        bool isBeliever
    ) external view returns (uint256) {
        Delulu storage delulu = delulus[deluluId];
        if (delulu.id == 0) return 0;

        uint256 winningPool = isBeliever
            ? delulu.totalBelieverStake
            : delulu.totalDoubterStake;
        uint256 totalPool = delulu.totalBelieverStake +
            delulu.totalDoubterStake;

        if (winningPool == 0 || totalPool == 0) return PRECISION; // 1.0x

        // multiplier = totalPool / winningPool
        return (totalPool * PRECISION) / winningPool;
    }

    /**
     * @notice Check if user can claim winnings
     * @param deluluId Market ID
     * @param user User address
     * @return true if user can claim
     */
    function isClaimable(
        uint256 deluluId,
        address user
    ) public view returns (bool) {
        Delulu storage delulu = delulus[deluluId];

        if (!delulu.isResolved || delulu.isCancelled) return false;

        UserPosition storage position = userStakes[deluluId][user];
        if (position.claimed) return false;
        if (position.amount == 0) return false;

        return position.side == delulu.outcome;
    }

    /**
     * @notice Get user's position in a market
     * @param deluluId Market ID
     * @param user User address
     * @return UserPosition struct with amount, side, and claimed status
     */
    function getUserPosition(
        uint256 deluluId,
        address user
    ) external view returns (UserPosition memory) {
        return userStakes[deluluId][user];
    }

    /**
     * @notice Get current state of a market
     * @param deluluId Market ID
     * @return DeluluState enum (OPEN, LOCKED, RESOLVED, CANCELLED)
     */
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

    /**
     * @notice Get market details
     * @param deluluId Market ID
     * @return Delulu struct with all market information
     */
    function getDelulu(uint256 deluluId) external view returns (Delulu memory) {
        return delulus[deluluId];
    }

    /**
     * @notice Get multiple markets (pagination support)
     * @param startId Starting market ID
     * @param count Number of markets to fetch (max 100)
     * @return Array of Delulu structs
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

    /**
     * @notice Get stablecoin token address
     * @return Token contract address
     */
    function getTokenAddress() external view returns (address) {
        return address(stablecoin);
    }
}
