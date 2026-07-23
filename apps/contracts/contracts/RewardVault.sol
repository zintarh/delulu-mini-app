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
 * @title RewardVault
 * @notice Admin-granted, user-claimed token rewards, kept fully separate from
 *         Delulu's stakes/tips/treasury. Each grant self-funds at deposit time
 *         (pulled from the rewarder wallet in the same transaction it is
 *         credited), so the vault can never owe more than it actually holds.
 *         Deploy behind an ERC1967 proxy; upgrade via owner-only upgradeToAndCall.
 */
contract RewardVault is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // --- ERRORS ---
    error InvalidInput();
    error Unauthorized();
    error RewardIdAlreadyUsed();
    error NothingToClaim();
    error AmountExceedsMax();
    error InsufficientFreeBalance();
    error AmountExceedsPending();

    // --- STATE ---
    address public rewarder;
    /// @dev Per-token sanity cap on a single deposit (in that token's own base units); 0 = uncapped. Owner-adjustable.
    mapping(address => uint256) public maxDepositPerToken;

    mapping(address => mapping(address => uint256)) public pendingRewardByToken; // user => token => amount
    /// @dev Sum of all outstanding pendingRewardByToken for a token — the portion of the
    ///      contract's balance that is actually owed to users and must never be swept.
    mapping(address => uint256) public totalPendingByToken;
    /// @dev Off-chain reward id (e.g. hash of the admin dashboard's DB row) — blocks double-credit on retry.
    mapping(bytes32 => bool) public usedRewardId;

    // --- EVENTS ---
    event RewarderUpdated(address indexed newRewarder);
    event MaxDepositPerTokenUpdated(address indexed token, uint256 newMax);
    event RewardDeposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        bytes32 indexed rewardId,
        address depositedBy
    );
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event RewardRevoked(
        address indexed user,
        address indexed token,
        uint256 amount,
        address indexed revokedBy
    );
    event TokenRescued(address indexed token, address indexed to, uint256 amount);

    modifier onlyRewarder() {
        if (msg.sender != rewarder && msg.sender != owner()) revert Unauthorized();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _rewarder) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_rewarder == address(0)) revert InvalidInput();
        rewarder = _rewarder;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- ADMIN ---

    function setRewarder(address _rewarder) external onlyOwner {
        if (_rewarder == address(0)) revert InvalidInput();
        rewarder = _rewarder;
        emit RewarderUpdated(_rewarder);
    }

    /// @param _maxDepositPerToken In `token`'s own base units (respecting its decimals); 0 = uncapped.
    function setMaxDepositPerToken(address token, uint256 _maxDepositPerToken) external onlyOwner {
        if (token == address(0)) revert InvalidInput();
        maxDepositPerToken[token] = _maxDepositPerToken;
        emit MaxDepositPerTokenUpdated(token, _maxDepositPerToken);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- REWARDS ---

    /**
     * @notice Grant `amount` of `token` to `user`, pulling it from the caller's wallet now.
     * @param rewardId Caller-supplied id (e.g. keccak256 of the dashboard's reward-record UUID)
     *                 used once — a retried/duplicated admin action cannot double-credit.
     */
    function depositReward(
        address user,
        address token,
        uint256 amount,
        bytes32 rewardId
    ) external nonReentrant onlyRewarder whenNotPaused {
        if (user == address(0) || token == address(0) || amount == 0) revert InvalidInput();
        uint256 cap = maxDepositPerToken[token];
        if (cap != 0 && amount > cap) revert AmountExceedsMax();
        if (usedRewardId[rewardId]) revert RewardIdAlreadyUsed();

        // Effects before the external transferFrom (CEI) — state reflects the
        // grant before control ever leaves this contract.
        usedRewardId[rewardId] = true;
        pendingRewardByToken[user][token] += amount;
        totalPendingByToken[token] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit RewardDeposited(user, token, amount, rewardId, msg.sender);
    }

    /**
     * @notice Claim the caller's full pending reward balance for `token`.
     * @dev Not gated by `whenNotPaused` — pausing freezes new grants, it must
     *      never trap funds a user has already been credited.
     */
    function claimReward(address token) external nonReentrant {
        uint256 amount = pendingRewardByToken[msg.sender][token];
        if (amount == 0) revert NothingToClaim();

        pendingRewardByToken[msg.sender][token] = 0;
        totalPendingByToken[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit RewardClaimed(msg.sender, token, amount);
    }

    /**
     * @notice Undo a mistaken grant (e.g. a fat-fingered amount) before the user claims it.
     *         Returns the tokens to the caller (owner).
     */
    function revokeReward(address user, address token, uint256 amount) external nonReentrant onlyOwner {
        if (amount == 0) revert InvalidInput();
        if (amount > pendingRewardByToken[user][token]) revert AmountExceedsPending();

        pendingRewardByToken[user][token] -= amount;
        totalPendingByToken[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit RewardRevoked(user, token, amount, msg.sender);
    }

    /**
     * @notice Recover tokens sent to this contract outside of `depositReward` (e.g. a direct
     *         transfer by mistake). Can never touch the portion of the balance owed to users.
     */
    function rescueToken(address token, address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0) || amount == 0) revert InvalidInput();
        uint256 free = IERC20(token).balanceOf(address(this)) - totalPendingByToken[token];
        if (amount > free) revert InsufficientFreeBalance();

        IERC20(token).safeTransfer(to, amount);
        emit TokenRescued(token, to, amount);
    }

    function pendingReward(address user, address token) external view returns (uint256) {
        return pendingRewardByToken[user][token];
    }
}
