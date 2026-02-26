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
    error UsernameTooShort();
    error UsernameTooLong();
    error UsernameAlreadyTaken();
    error UsernameInvalid();
    error InvalidPool();
    error ProfileRequired();

    uint256 public constant EMERGENCY_REFUND_DELAY = 7 days;
    uint256 private constant PRECISION = 1e18;
    uint256 public constant MIN_STAKE = 1e18; 
    uint256 public constant MAX_STAKE = 1_000_000_000 * 1e18; 
    uint256 public constant MAX_STAKE_PER_USER = 100_000 * 1e18; 
    uint256 public constant MAX_STAKING_DURATION = 365 days;
    uint256 public constant MAX_RESOLUTION_DURATION = 730 days;
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1% = 100 basis points
    uint256 public constant CREATOR_INCENTIVE_BPS = 500; // 5% = 500 basis points
    uint256 public constant BPS_DENOMINATOR = 10000; // 100% = 10000 basis points
    uint256 public constant MIN_USERNAME_LENGTH = 3;
    uint256 public constant MAX_USERNAME_LENGTH = 16;

    IERC20 public currency; 
    uint256 public nextDeluluId;
    address public goodDollarRegistry; // GoodDollar Registry/Treasury address
    address public senate; // The wallet/multisig that handles market resolutions 

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
        uint256 resolutionTime; // Timestamp when market was resolved
    }

    struct UserPosition {
        uint256 amount;
        bool side;
        bool claimed;
    }

    enum DeluluState { OPEN, LOCKED, REVIEW, RESOLVED, CANCELLED }

    mapping(uint256 => Market) public delulus;
    mapping(uint256 => mapping(address => UserPosition)) public userStakes;
    mapping(uint256 => mapping(address => uint256)) public userTotalStaked;
    mapping(address => bool) public isSupportedToken;
    
    // Username and profile system
    mapping(address => string) public usernames;
    mapping(string => address) public usernameToAddress;
    mapping(address => string) public profileMetadataHashes; // IPFS CIDs for encrypted emails/metadata

    uint256[45] private __gap; // Reduced by 2 for profileMetadataHashes (mapping) and senate (address) 

    event DeluluCreated(uint256 indexed deluluId, address indexed creator, address indexed token, string contentHash, uint256 stakingDeadline, uint256 resolutionDeadline, uint256 creatorStake);
    event StakePlaced(uint256 indexed deluluId, address indexed user, uint256 amount, bool side, uint256 newTotalPoolStake);
    event DeluluResolved(uint256 indexed deluluId, bool outcome, uint256 winningPool, uint256 losingPool, uint256 resolutionTime, uint256 protocolFee, uint256 creatorIncentive);
    event WinningsClaimed(uint256 indexed deluluId, address indexed user, uint256 payout);
    event EmergencyRefund(uint256 indexed deluluId, address indexed user, uint256 amount);
    event DeluluCancelled(uint256 indexed deluluId, address indexed cancelledBy);
    event TokenSupportStatusChanged(address indexed token, bool status);
    event ProfileUpdated(address indexed user, string username, string metadataHash);
    event GoodDollarRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event SenateUpdated(address indexed oldSenate, address indexed newSenate);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _defaultCurrency, address _goodDollarRegistry) public initializer {
        if (_defaultCurrency == address(0)) revert InvalidTokenAddress();
        if (_goodDollarRegistry == address(0)) revert InvalidTokenAddress();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        currency = IERC20(_defaultCurrency);
        isSupportedToken[_defaultCurrency] = true;
        goodDollarRegistry = _goodDollarRegistry;
        nextDeluluId = 1; 
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setTokenSupport(address _token, bool _status) external onlyOwner {
        if (_token == address(0)) revert InvalidTokenAddress();
        isSupportedToken[_token] = _status;
        emit TokenSupportStatusChanged(_token, _status);
    }

    function setGoodDollarRegistry(address _goodDollarRegistry) external onlyOwner {
        if (_goodDollarRegistry == address(0)) revert InvalidTokenAddress();
        address oldRegistry = goodDollarRegistry;
        goodDollarRegistry = _goodDollarRegistry;
        emit GoodDollarRegistryUpdated(oldRegistry, _goodDollarRegistry);
    }

    /**
     * @notice Set the Senate address (wallet/multisig that can resolve markets)
     * @param _senate The address of the Senate (can be a multisig)
     */
    function setSenate(address _senate) external onlyOwner {
        address oldSenate = senate;
        senate = _senate;
        emit SenateUpdated(oldSenate, _senate);
    }

    /**
     * @notice Modifier to allow only Senate or Owner to execute
     */
    modifier onlySenate() {
        if (msg.sender != senate && msg.sender != owner()) revert Unauthorized();
        _;
    }

    /**
     * @notice Set profile with username and metadata hash (IPFS CID for encrypted emails)
     * @param _username The username to set (3-16 characters, alphanumeric + underscore only)
     * @param _metadataHash The IPFS CID hash for encrypted metadata (e.g., email)
     */
    function setProfile(string calldata _username, string calldata _metadataHash) external {
        bytes memory usernameBytes = bytes(_username);
        uint256 length = usernameBytes.length;
        
        if (length < MIN_USERNAME_LENGTH) revert UsernameTooShort();
        if (length > MAX_USERNAME_LENGTH) revert UsernameTooLong();
        
        // Check if username contains only alphanumeric characters and underscores
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = usernameBytes[i];
            if (!(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x5A) && // A-Z
                !(char >= 0x61 && char <= 0x7A) && // a-z
                char != 0x5F) { // underscore
                revert UsernameInvalid();
            }
        }
        
        // Check if username is already taken by a different address
        address existingOwner = usernameToAddress[_username];
        if (existingOwner != address(0) && existingOwner != msg.sender) {
            revert UsernameAlreadyTaken();
        }
        
        // Clear old username mapping if user had one
        string memory oldUsername = usernames[msg.sender];
        if (bytes(oldUsername).length > 0) {
            delete usernameToAddress[oldUsername];
        }
        
        // Set new username, username mapping, and metadata hash
        usernames[msg.sender] = _username;
        usernameToAddress[_username] = msg.sender;
        profileMetadataHashes[msg.sender] = _metadataHash;
        
        emit ProfileUpdated(msg.sender, _username, _metadataHash);
    }

    /**
     * @notice Check if a username is already taken
     * @param _username The username to check
     * @return true if username is taken, false otherwise
     */
    function isUsernameTaken(string calldata _username) external view returns (bool) {
        return usernameToAddress[_username] != address(0);
    }

    function createDelulu(
        address token, 
        string calldata contentHash,
        uint256 stakingDeadline,
        uint256 resolutionDeadline,
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Require user to have a profile (username) before creating a market
        if (bytes(usernames[msg.sender]).length == 0) revert ProfileRequired();
        
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
            isCancelled: false,
            resolutionTime: 0
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
        if (delulu.id == 0) revert DeluluNotFound();
        if (!delulu.isResolved) revert NotResolved();
        if (delulu.isCancelled) revert MarketCancelled();

        UserPosition storage position = userStakes[deluluId][msg.sender];
        if (position.amount == 0) revert NoStakeToRefund();
        if (position.claimed) revert AlreadyClaimed();
        if (position.side != delulu.outcome) revert UserIsNotWinner();

        position.claimed = true;
    
        uint256 winningPool = delulu.outcome ? delulu.totalBelieverStake : delulu.totalDoubterStake;
        if (winningPool == 0) revert InvalidPool(); 
        
        uint256 totalPool = delulu.totalBelieverStake + delulu.totalDoubterStake;
        uint256 netPool = _calculateNetPoolAfterFees(delulu, totalPool);
        
      
        uint256 netPayout = (position.amount * netPool) / winningPool;
        
        IERC20(delulu.token).safeTransfer(msg.sender, netPayout);
        emit WinningsClaimed(deluluId, msg.sender, netPayout);
    }

    function emergencyRefund(uint256 deluluId) external nonReentrant {
        Market storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        
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

    /**
     * @notice Resolve a Delulu market and pay fees immediately (Senate or Owner only)
     * @param deluluId The ID of the market to resolve
     * @param outcome The outcome (true = Believers win, false = Doubters win)
     */
    function resolveDelulu(uint256 deluluId, bool outcome) external nonReentrant onlySenate {
        Market storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (delulu.isCancelled) revert MarketCancelled();
        if (delulu.isResolved) revert AlreadyResolved();
        
        uint256 winningPool = outcome ? delulu.totalBelieverStake : delulu.totalDoubterStake;
        uint256 losingPool = outcome ? delulu.totalDoubterStake : delulu.totalBelieverStake;
        uint256 totalPool = delulu.totalBelieverStake + delulu.totalDoubterStake;
        
        // Validate pool is not zero
        if (totalPool == 0) revert InvalidPool();
        if (winningPool == 0) revert InvalidPool(); // Cannot resolve with no winners
        
        // Calculate fees FIRST (Checks)
        uint256 protocolFee = (totalPool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorIncentive = 0;
        if (outcome && delulu.creator != address(0)) {
            creatorIncentive = (totalPool * CREATOR_INCENTIVE_BPS) / BPS_DENOMINATOR;
        }
        
        // Make external calls BEFORE state updates (Interactions - following Checks-Effects-Interactions pattern)
        if (protocolFee > 0 && goodDollarRegistry != address(0)) {
            IERC20(delulu.token).safeTransfer(goodDollarRegistry, protocolFee);
        }
        if (creatorIncentive > 0) {
            IERC20(delulu.token).safeTransfer(delulu.creator, creatorIncentive);
        }
        
        // Update state AFTER external calls succeed (Effects)
        delulu.outcome = outcome;
        delulu.isResolved = true;
        delulu.resolutionTime = block.timestamp;
        
        emit DeluluResolved(deluluId, outcome, winningPool, losingPool, block.timestamp, protocolFee, creatorIncentive);
    }

    function cancelDelulu(uint256 deluluId) external {
        Market storage delulu = delulus[deluluId];
        if (delulu.id == 0) revert DeluluNotFound();
        if (delulu.isResolved) revert AlreadyResolved();
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

    /**
     * @notice Calculate the net pool after deducting protocol fee and creator incentive
     * @param delulu The market struct
     * @param totalPool The total pool amount
     * @return netPool The pool amount after fees
     */
    function _calculateNetPoolAfterFees(Market storage delulu, uint256 totalPool) internal pure returns (uint256) {
        // Calculate fees using integer division (PRECISION not needed here as we're working with basis points)
        uint256 protocolFee = (totalPool * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorIncentive = 0;
        
        // Creator incentive only applies if Believers win
        if (delulu.outcome) {
            creatorIncentive = (totalPool * CREATOR_INCENTIVE_BPS) / BPS_DENOMINATOR;
        }
        
        return totalPool - protocolFee - creatorIncentive;
    }

    /**
     * @notice Get username for an address
     * @param user The address to get username for
     * @return The username string
     */
    function getUsername(address user) external view returns (string memory) {
        return usernames[user];
    }

    /**
     * @notice Get address for a username
     * @param username The username to get address for
     * @return The address associated with the username
     */
    function getAddressByUsername(string calldata username) external view returns (address) {
        return usernameToAddress[username];
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
        // When resolution deadline passes, market enters review mode
        if (block.timestamp >= delulu.resolutionDeadline) return DeluluState.REVIEW;
        if (block.timestamp >= delulu.stakingDeadline) return DeluluState.LOCKED;
        return DeluluState.OPEN;
    }

    function getDelulu(uint256 deluluId) external view returns (Market memory) {
        return delulus[deluluId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}