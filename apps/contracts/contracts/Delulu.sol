// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Delulu
 * @notice A social prediction market where users stake on claims (delusions)
 * @dev Built for Celo blockchain using cUSD stablecoin
 */
contract Delulu is ReentrancyGuard, Ownable {
    // ============ State Variables ============

    /// @notice Celo cUSD token addresses
    address public immutable cUSD;

    /// @notice Counter for delusion IDs
    uint256 public delusionCounter;

    /// @notice Platform fee vault (collected fees and penalties)
    uint256 public platformVault;

    /// @notice Climate fund vault (20% of platform fees)
    uint256 public climateVault;

    // ============ Constants ============

    /// @notice Platform fee in basis points (0.1% = 10 bps)
    uint256 public constant PLATFORM_FEE_BPS = 10;

    /// @notice Climate fund allocation (20% of platform fees)
    uint256 public constant CLIMATE_ALLOCATION_BPS = 2000;

    /// @notice Early withdrawal penalty (5%)
    uint256 public constant WITHDRAWAL_PENALTY_BPS = 500;

    /// @notice Minimum switch penalty (0.5%)
    uint256 public constant MIN_SWITCH_PENALTY_BPS = 50;

    /// @notice Maximum switch penalty (10%)
    uint256 public constant MAX_SWITCH_PENALTY_BPS = 1000;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ Enums ============

    enum DelusionStatus {
        Active,
        SuccessFinalized,
        FailedFinalized,
        Cancelled
    }

    enum StakePosition {
        None,
        Believe,
        Doubt
    }

    // ============ Structs ============

    struct Delusion {
        uint256 id;
        address creator;
        string delulu;
        uint256 createdAt;
        uint256 deadline;
        uint256 believePool;
        uint256 doubtPool;
        uint256 believerCount;
        uint256 doubterCount;
        DelusionStatus status;
    }

    struct UserStake {
        uint256 amount;
        StakePosition position;
        uint256 stakedAt;
        bool hasClaimed;
    }

    // ============ Storage Mappings ============

    /// @notice Mapping of delusion ID to Delusion struct
    mapping(uint256 => Delusion) public delusions;

    /// @notice Mapping of delusion ID to user address to UserStake
    mapping(uint256 => mapping(address => UserStake)) public userStakes;

    // ============ Events ============

    event DelusionCreated(
        uint256 indexed delusionId,
        address indexed creator,
        string delulu,
        uint256 deadline
    );

    event StakePlaced(
        uint256 indexed delusionId,
        address indexed user,
        StakePosition position,
        uint256 amount
    );

    event StakeSwitched(
        uint256 indexed delusionId,
        address indexed user,
        StakePosition fromPosition,
        StakePosition toPosition,
        uint256 penaltyPaid
    );

    event StakeWithdrawn(
        uint256 indexed delusionId,
        address indexed user,
        uint256 amount,
        uint256 penalty
    );

    event DelusionFinalized(
        uint256 indexed delusionId,
        DelusionStatus outcome,
        uint256 believePool,
        uint256 doubtPool
    );

    event RewardClaimed(
        uint256 indexed delusionId,
        address indexed user,
        uint256 reward
    );

    event PlatformFeesCollected(address indexed owner, uint256 amount);
    event ClimateFeesCollected(address indexed owner, uint256 amount);

    // ============ Constructor ============

    constructor(address _cUSDAddress) Ownable(msg.sender) {
        require(_cUSDAddress != address(0), "Invalid cUSD address");
        cUSD = _cUSDAddress;
    }

    // ============ Modifiers ============

    modifier delusionExists(uint256 _delusionId) {
        require(_delusionId > 0 && _delusionId <= delusionCounter, "Delusion does not exist");
        _;
    }

    modifier delusionActive(uint256 _delusionId) {
        require(delusions[_delusionId].status == DelusionStatus.Active, "Delusion not active");
        _;
    }

    modifier beforeDeadline(uint256 _delusionId) {
        require(block.timestamp < delusions[_delusionId].deadline, "Deadline passed");
        _;
    }

    modifier afterDeadline(uint256 _delusionId) {
        require(block.timestamp >= delusions[_delusionId].deadline, "Deadline not reached");
        _;
    }

    // ============ Core Functions ============

    /**
     * @notice Create a new delusion (claim/prediction) with initial stake
     * @param _delulu The delulu text
     * @param _deadline Unix timestamp for the deadline
     * @param _amount Initial stake amount in cUSD
     * @param _position Creator's position (true = Believe, false = Doubt)
     */
    function createDelusion(
        string memory _delulu,
        uint256 _deadline,
        uint256 _amount,
        bool _position
    ) external nonReentrant returns (uint256) {
        require(bytes(_delulu).length > 0, "Delulu text cannot be empty");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(_deadline <= block.timestamp + 365 days, "Deadline too far in future");
        require(_amount > 0, "Initial stake must be greater than 0");

        // Transfer tokens from creator
        require(
            IERC20(cUSD).transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        delusionCounter++;
        uint256 delusionId = delusionCounter;

        // Create delusion with creator's initial position
        delusions[delusionId] = Delusion({
            id: delusionId,
            creator: msg.sender,
            delulu: _delulu,
            createdAt: block.timestamp,
            deadline: _deadline,
            believePool: _position ? _amount : 0,
            doubtPool: _position ? 0 : _amount,
            believerCount: _position ? 1 : 0,
            doubterCount: _position ? 0 : 1,
            status: DelusionStatus.Active
        });

        // Record creator's stake
        userStakes[delusionId][msg.sender] = UserStake({
            amount: _amount,
            position: _position ? StakePosition.Believe : StakePosition.Doubt,
            stakedAt: block.timestamp,
            hasClaimed: false
        });

        emit DelusionCreated(delusionId, msg.sender, _delulu, _deadline);
        emit StakePlaced(
            delusionId,
            msg.sender,
            _position ? StakePosition.Believe : StakePosition.Doubt,
            _amount
        );

        return delusionId;
    }

    /**
     * @notice Stake tokens believing the delusion will succeed
     * @param _delusionId The delusion ID
     * @param _amount Amount of cUSD to stake
     */
    function stakeBelieve(uint256 _delusionId, uint256 _amount)
        external
        nonReentrant
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        beforeDeadline(_delusionId)
    {
        require(_amount > 0, "Amount must be greater than 0");

        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.position != StakePosition.Doubt, "Already staked on Doubt. Use switch function.");

        // Transfer tokens from user
        require(
            IERC20(cUSD).transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        // Calculate and collect platform fee
        uint256 platformFee = (_amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 climateFee = (platformFee * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
        uint256 netAmount = _amount - platformFee;

        platformVault += (platformFee - climateFee);
        climateVault += climateFee;

        // Update user stake
        if (userStake.position == StakePosition.None) {
            delusions[_delusionId].believerCount++;
            userStake.position = StakePosition.Believe;
            userStake.stakedAt = block.timestamp;
        }

        userStake.amount += netAmount;
        delusions[_delusionId].believePool += netAmount;

        emit StakePlaced(_delusionId, msg.sender, StakePosition.Believe, netAmount);
    }

    /**
     * @notice Stake tokens doubting the delusion will succeed
     * @param _delusionId The delusion ID
     * @param _amount Amount of cUSD to stake
     */
    function stakeDoubt(uint256 _delusionId, uint256 _amount)
        external
        nonReentrant
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        beforeDeadline(_delusionId)
    {
        require(_amount > 0, "Amount must be greater than 0");

        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.position != StakePosition.Believe, "Already staked on Believe. Use switch function.");

        // Transfer tokens from user
        require(
            IERC20(cUSD).transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        // Calculate and collect platform fee
        uint256 platformFee = (_amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 climateFee = (platformFee * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
        uint256 netAmount = _amount - platformFee;

        platformVault += (platformFee - climateFee);
        climateVault += climateFee;

        // Update user stake
        if (userStake.position == StakePosition.None) {
            delusions[_delusionId].doubterCount++;
            userStake.position = StakePosition.Doubt;
            userStake.stakedAt = block.timestamp;
        }

        userStake.amount += netAmount;
        delusions[_delusionId].doubtPool += netAmount;

        emit StakePlaced(_delusionId, msg.sender, StakePosition.Doubt, netAmount);
    }

    /**
     * @notice Switch stake from Doubt to Believe (with dynamic penalty)
     * @param _delusionId The delusion ID
     */
    function switchToBelieve(uint256 _delusionId)
        external
        nonReentrant
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        beforeDeadline(_delusionId)
    {
        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.position == StakePosition.Doubt, "Not staked on Doubt");
        require(userStake.amount > 0, "No stake to switch");

        // Calculate switch penalty (quadratic time-based)
        uint256 penalty = _calculateSwitchCost(_delusionId, userStake.amount);
        uint256 netAmount = userStake.amount - penalty;

        // Update pools
        delusions[_delusionId].doubtPool -= userStake.amount;
        delusions[_delusionId].believePool += netAmount;

        // Update counts
        delusions[_delusionId].doubterCount--;
        delusions[_delusionId].believerCount++;

        // Update user stake
        userStake.position = StakePosition.Believe;
        userStake.amount = netAmount;
        userStake.stakedAt = block.timestamp;

        // Penalty goes to platform vault
        uint256 climateFee = (penalty * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
        platformVault += (penalty - climateFee);
        climateVault += climateFee;

        emit StakeSwitched(_delusionId, msg.sender, StakePosition.Doubt, StakePosition.Believe, penalty);
    }

    /**
     * @notice Switch stake from Believe to Doubt (with dynamic penalty)
     * @param _delusionId The delusion ID
     */
    function switchToDoubt(uint256 _delusionId)
        external
        nonReentrant
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        beforeDeadline(_delusionId)
    {
        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.position == StakePosition.Believe, "Not staked on Believe");
        require(userStake.amount > 0, "No stake to switch");

        // Calculate switch penalty (quadratic time-based)
        uint256 penalty = _calculateSwitchCost(_delusionId, userStake.amount);
        uint256 netAmount = userStake.amount - penalty;

        // Update pools
        delusions[_delusionId].believePool -= userStake.amount;
        delusions[_delusionId].doubtPool += netAmount;

        // Update counts
        delusions[_delusionId].believerCount--;
        delusions[_delusionId].doubterCount++;

        // Update user stake
        userStake.position = StakePosition.Doubt;
        userStake.amount = netAmount;
        userStake.stakedAt = block.timestamp;

        // Penalty goes to platform vault
        uint256 climateFee = (penalty * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
        platformVault += (penalty - climateFee);
        climateVault += climateFee;

        emit StakeSwitched(_delusionId, msg.sender, StakePosition.Believe, StakePosition.Doubt, penalty);
    }

    /**
     * @notice Withdraw stake before deadline (with 5% penalty)
     * @param _delusionId The delusion ID
     */
    function withdrawStake(uint256 _delusionId)
        external
        nonReentrant
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        beforeDeadline(_delusionId)
    {
        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.amount > 0, "No stake to withdraw");
        require(userStake.position != StakePosition.None, "No active position");

        uint256 stakedAmount = userStake.amount;
        uint256 penalty = (stakedAmount * WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR;
        uint256 withdrawAmount = stakedAmount - penalty;

        // Update pools and counts
        if (userStake.position == StakePosition.Believe) {
            delusions[_delusionId].believePool -= stakedAmount;
            delusions[_delusionId].believerCount--;
        } else {
            delusions[_delusionId].doubtPool -= stakedAmount;
            delusions[_delusionId].doubterCount--;
        }

        // Reset user stake
        userStake.amount = 0;
        userStake.position = StakePosition.None;

        // Penalty goes to platform vault
        uint256 climateFee = (penalty * CLIMATE_ALLOCATION_BPS) / BPS_DENOMINATOR;
        platformVault += (penalty - climateFee);
        climateVault += climateFee;

        // Transfer withdrawal amount to user
        require(
            IERC20(cUSD).transfer(msg.sender, withdrawAmount),
            "Transfer failed"
        );

        emit StakeWithdrawn(_delusionId, msg.sender, withdrawAmount, penalty);
    }

    /**
     * @notice Finalize delusion as successful (believers win)
     * @param _delusionId The delusion ID
     * @dev Only creator can finalize. In production, this would verify proof.
     */
    function finalizeDelusionSuccess(uint256 _delusionId)
        external
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        afterDeadline(_delusionId)
    {
        Delusion storage delusion = delusions[_delusionId];
        require(msg.sender == delusion.creator, "Only creator can finalize");

        delusion.status = DelusionStatus.SuccessFinalized;

        emit DelusionFinalized(
            _delusionId,
            DelusionStatus.SuccessFinalized,
            delusion.believePool,
            delusion.doubtPool
        );
    }

    /**
     * @notice Finalize delusion as failed (doubters win)
     * @param _delusionId The delusion ID
     * @dev Only creator can finalize. In production, this would verify proof.
     */
    function finalizeDelusionFail(uint256 _delusionId)
        external
        delusionExists(_delusionId)
        delusionActive(_delusionId)
        afterDeadline(_delusionId)
    {
        Delusion storage delusion = delusions[_delusionId];
        require(msg.sender == delusion.creator, "Only creator can finalize");

        delusion.status = DelusionStatus.FailedFinalized;

        emit DelusionFinalized(
            _delusionId,
            DelusionStatus.FailedFinalized,
            delusion.believePool,
            delusion.doubtPool
        );
    }

    /**
     * @notice Claim rewards after delusion is finalized
     * @param _delusionId The delusion ID
     */
    function claim(uint256 _delusionId)
        external
        nonReentrant
        delusionExists(_delusionId)
    {
        Delusion storage delusion = delusions[_delusionId];
        require(
            delusion.status == DelusionStatus.SuccessFinalized ||
            delusion.status == DelusionStatus.FailedFinalized,
            "Delusion not finalized"
        );

        UserStake storage userStake = userStakes[_delusionId][msg.sender];
        require(userStake.amount > 0, "No stake to claim");
        require(!userStake.hasClaimed, "Already claimed");

        uint256 reward = _calculateReward(_delusionId, msg.sender);
        require(reward > 0, "No reward to claim");

        userStake.hasClaimed = true;

        require(
            IERC20(cUSD).transfer(msg.sender, reward),
            "Transfer failed"
        );

        emit RewardClaimed(_delusionId, msg.sender, reward);
    }

    // ============ Owner Functions ============

    /**
     * @notice Claim accumulated platform fees (owner only)
     */
    
    function claimPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = platformVault;
        require(amount > 0, "No platform fees to claim");

        platformVault = 0;

        require(
            IERC20(cUSD).transfer(msg.sender, amount),
            "Transfer failed"
        );

        emit PlatformFeesCollected(msg.sender, amount);
    }

    /**
     * @notice Claim accumulated climate fees (owner only)
     */
    function claimClimateFees() external onlyOwner nonReentrant {
        uint256 amount = climateVault;
        require(amount > 0, "No climate fees to claim");

        climateVault = 0;

        require(
            IERC20(cUSD).transfer(msg.sender, amount),
            "Transfer failed"
        );

        emit ClimateFeesCollected(msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get delusion details
     * @param _delusionId The delusion ID
     */
    function getDelusion(uint256 _delusionId)
        external
        view
        delusionExists(_delusionId)
        returns (Delusion memory)
    {
        return delusions[_delusionId];
    }

    /**
     * @notice Get user stake details
     * @param _delusionId The delusion ID
     * @param _user User address
     */
    function getUserStake(uint256 _delusionId, address _user)
        external
        view
        delusionExists(_delusionId)
        returns (UserStake memory)
    {
        return userStakes[_delusionId][_user];
    }

    /**
     * @notice Get pool amounts for a delusion
     * @param _delusionId The delusion ID
     */
    function getPools(uint256 _delusionId)
        external
        view
        delusionExists(_delusionId)
        returns (uint256 believePool, uint256 doubtPool)
    {
        Delusion memory delusion = delusions[_delusionId];
        return (delusion.believePool, delusion.doubtPool);
    }

    /**
     * @notice Get believer count for a delusion
     * @param _delusionId The delusion ID
     */
    function getBelieverCount(uint256 _delusionId)
        external
        view
        delusionExists(_delusionId)
        returns (uint256)
    {
        return delusions[_delusionId].believerCount;
    }

    /**
     * @notice Get doubter count for a delusion
     * @param _delusionId The delusion ID
     */
    function getDoubterCount(uint256 _delusionId)
        external
        view
        delusionExists(_delusionId)
        returns (uint256)
    {
        return delusions[_delusionId].doubterCount;
    }

    /**
     * @notice Get delusion outcome/status
     * @param _delusionId The delusion ID
     */
    function getOutcome(uint256 _delusionId)
        external
        view
        delusionExists(_delusionId)
        returns (DelusionStatus)
    {
        return delusions[_delusionId].status;
    }

    // ============ Internal Helper Functions ============

    /**
     * @notice Calculate dynamic switch cost based on time to deadline
     * @dev Uses quadratic formula: penalty increases exponentially as deadline approaches
     * @param _delusionId The delusion ID
     * @param _amount The stake amount
     * @return penalty The calculated penalty amount
     */
    function _calculateSwitchCost(uint256 _delusionId, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        Delusion memory delusion = delusions[_delusionId];

        uint256 timeElapsed = block.timestamp - delusion.createdAt;
        uint256 totalDuration = delusion.deadline - delusion.createdAt;

        // Quadratic progression: penalty = min + (progress^2) * (max - min)
        // Using 10000 as scaling factor for precision
        uint256 progressSquared = (timeElapsed * timeElapsed * BPS_DENOMINATOR) /
            (totalDuration * totalDuration);

        uint256 penaltyBps = MIN_SWITCH_PENALTY_BPS +
            (progressSquared * (MAX_SWITCH_PENALTY_BPS - MIN_SWITCH_PENALTY_BPS)) /
            BPS_DENOMINATOR;

        return (_amount * penaltyBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Calculate reward for a user after delusion finalization
     * @param _delusionId The delusion ID
     * @param _user User address
     * @return reward The calculated reward amount
     */
    function _calculateReward(uint256 _delusionId, address _user)
        internal
        view
        returns (uint256)
    {
        Delusion memory delusion = delusions[_delusionId];
        UserStake memory userStake = userStakes[_delusionId][_user];

        // Check if user is on winning side
        bool isWinner = (delusion.status == DelusionStatus.SuccessFinalized &&
            userStake.position == StakePosition.Believe) ||
            (delusion.status == DelusionStatus.FailedFinalized &&
            userStake.position == StakePosition.Doubt);

        if (!isWinner) {
            return 0;
        }

        // Get winning and losing pools
        uint256 winningPool = delusion.status == DelusionStatus.SuccessFinalized
            ? delusion.believePool
            : delusion.doubtPool;

        uint256 losingPool = delusion.status == DelusionStatus.SuccessFinalized
            ? delusion.doubtPool
            : delusion.believePool;

        // Handle edge case: no losing pool
        if (losingPool == 0) {
            return userStake.amount;
        }

        // Proportional distribution: userReward = userStake + (userStake / winningPool) * losingPool
        uint256 shareOfWinnings = (userStake.amount * losingPool) / winningPool;
        return userStake.amount + shareOfWinnings;
    }
}

