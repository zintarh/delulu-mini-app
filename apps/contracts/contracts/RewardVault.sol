// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev The ForfeitMarket entry the vault uses to stake on a player's behalf (enums as uint8).
interface IForfeitMarketStaking {
    function createCommitmentFor(
        address creator,
        address token,
        uint256 stakeAmount,
        uint8 destinationType,
        address destinationAddr,
        uint8 cadence,
        uint32 totalPeriods,
        uint64 periodSeconds,
        uint64 firstDeadline,
        address verifier
    ) external returns (uint256 commitmentId);
}

/**
 * @title RewardVault
 * @notice Admin-granted, user-claimed token rewards, kept fully separate from
 *         Delulu's stakes/tips/treasury. Grants are either self-funded at
 *         deposit time (`depositReward`, pulled from the rewarder wallet) or
 *         credited from the vault's own pre-funded reward pool (`creditReward`).
 *         Either way the vault can never owe more than it actually holds.
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
    error DailyCreditLimitExceeded();
    error NotForfeitSource();
    error ForfeitMarketNotSet();
    error InsufficientStakeFunds();

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
    /// @dev Per-token cap on total `creditReward` volume per UTC day (base units); 0 = uncapped.
    ///      Bounds how fast the pool can drain if the rewarder key or the backend misbehaves.
    mapping(address => uint256) public maxDailyCreditPerToken;
    /// @dev token => day index (block.timestamp / 1 days) => amount credited from the pool that day.
    mapping(address => mapping(uint256 => uint256)) public creditedOnDay;

    // --- v3: sustainability ledger (appended; never reorder the slots above) ---
    /// @dev Where pool money came from. Readable on-chain so anyone can see how much of
    ///      the rewards players fund themselves versus the team.
    uint8 public constant SOURCE_TEAM = 0;
    uint8 public constant SOURCE_PLAYER_FORFEITS = 1;
    uint8 public constant SOURCE_PLAYER_PURCHASES = 2;
    uint8 public constant SOURCE_SPONSOR = 3;
    uint16 public constant MAX_DELULU_SHARE_BPS = 3000; // Delulu never keeps more than 30% of forfeits
    uint16 public constant MAX_CHEER_FEE_BPS = 1000; // 10%

    /// @dev token => source => total pool funding since v3.
    mapping(address => mapping(uint8 => uint256)) public fundedBySource;
    /// @dev token => total rewards granted out of the pool since v3 (credits + stake credits).
    mapping(address => uint256) public totalGrantedByToken;
    /// @dev Contracts whose missed-stake pools may fund the vault as player money (ForfeitMarket, CommunityMarket).
    mapping(address => bool) public isForfeitSource;
    /// @dev Share of player forfeits Delulu keeps as revenue (to `treasury`); the rest stays in the pot.
    uint16 public deluluShareBps;
    address public treasury;
    /// @dev token => Delulu revenue taken from player forfeits since v3.
    mapping(address => uint256) public deluluRevenueByToken;
    /// @dev Share of a cheer that goes to the pot; the rest goes to the cheered player.
    uint16 public cheerFeeBps;
    /// @dev ForfeitMarket the vault stakes into on a player's behalf (rollover, stake credit).
    address public forfeitMarket;
    /// @dev Stake-only credit: can only be used to stake, never claimed as cash.
    mapping(address => mapping(address => uint256)) public stakeCreditByToken; // user => token => amount
    mapping(address => uint256) public totalStakeCreditByToken;
    /// @dev token => G$ players restaked straight from their rewards (rollover) since v3.
    mapping(address => uint256) public rolledOverByToken;

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
    event PoolFunded(address indexed token, address indexed from, uint256 amount);
    event MaxDailyCreditPerTokenUpdated(address indexed token, uint256 newMax);
    event PoolFundedBySource(address indexed token, address indexed from, uint8 indexed source, uint256 amount);
    event ForfeitsSplit(address indexed token, address indexed from, uint256 toPot, uint256 toDelulu);
    event Purchased(address indexed user, address indexed token, uint256 amount, bytes32 indexed kind, bytes32 ref);
    event Cheered(address indexed from, address indexed to, address indexed token, uint256 toPlayer, uint256 toPot, bytes32 ref);
    event StakeCreditGranted(address indexed user, address indexed token, uint256 amount, bytes32 indexed rewardId);
    event StakedFromVault(address indexed user, address indexed token, uint256 fromCredit, uint256 fromRewards, uint256 fromWallet, uint256 indexed commitmentId);
    event ForfeitSourceUpdated(address indexed source, bool allowed);
    event SustainabilityConfigUpdated(address treasury, uint16 deluluShareBps, uint16 cheerFeeBps, address forfeitMarket);

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

    /// @notice One-time setup for the sustainability ledger, run with the v3 upgrade.
    function initializeV3(address _treasury, address _forfeitMarket, uint16 _deluluShareBps, uint16 _cheerFeeBps)
        external
        reinitializer(3)
        onlyOwner
    {
        _setSustainabilityConfig(_treasury, _deluluShareBps, _cheerFeeBps, _forfeitMarket);
        if (_forfeitMarket != address(0)) {
            isForfeitSource[_forfeitMarket] = true;
            emit ForfeitSourceUpdated(_forfeitMarket, true);
        }
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

    /// @param _maxDailyCredit In `token`'s own base units; 0 = uncapped.
    function setMaxDailyCreditPerToken(address token, uint256 _maxDailyCredit) external onlyOwner {
        if (token == address(0)) revert InvalidInput();
        maxDailyCreditPerToken[token] = _maxDailyCredit;
        emit MaxDailyCreditPerTokenUpdated(token, _maxDailyCredit);
    }

    function setForfeitSource(address source, bool allowed) external onlyOwner {
        if (source == address(0)) revert InvalidInput();
        isForfeitSource[source] = allowed;
        emit ForfeitSourceUpdated(source, allowed);
    }

    function setSustainabilityConfig(address _treasury, uint16 _deluluShareBps, uint16 _cheerFeeBps, address _forfeitMarket)
        external
        onlyOwner
    {
        _setSustainabilityConfig(_treasury, _deluluShareBps, _cheerFeeBps, _forfeitMarket);
    }

    function _setSustainabilityConfig(address _treasury, uint16 _deluluShareBps, uint16 _cheerFeeBps, address _forfeitMarket) internal {
        if (_treasury == address(0)) revert InvalidInput();
        if (_deluluShareBps > MAX_DELULU_SHARE_BPS || _cheerFeeBps > MAX_CHEER_FEE_BPS) revert InvalidInput();
        treasury = _treasury;
        deluluShareBps = _deluluShareBps;
        cheerFeeBps = _cheerFeeBps;
        forfeitMarket = _forfeitMarket;
        emit SustainabilityConfigUpdated(_treasury, _deluluShareBps, _cheerFeeBps, _forfeitMarket);
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
     * @notice Top up the reward pool `creditReward` pays from. Anyone can fund it;
     *         a plain token transfer to the vault works too, this just emits an event.
     */
    function fundPool(address token, uint256 amount) external nonReentrant {
        if (token == address(0) || amount == 0) revert InvalidInput();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        fundedBySource[token][SOURCE_TEAM] += amount;
        emit PoolFunded(token, msg.sender, amount);
        emit PoolFundedBySource(token, msg.sender, SOURCE_TEAM, amount);
    }

    /**
     * @notice Fund the pool and say where the money came from: SOURCE_TEAM or SOURCE_SPONSOR
     *         from anyone; SOURCE_PLAYER_FORFEITS only from an approved forfeit contract
     *         (players' missed stakes), of which `deluluShareBps` goes to Delulu's treasury
     *         and the rest stays in the pot. Player purchases come in through `purchase`.
     */
    function fundPoolFrom(address token, uint256 amount, uint8 source) external nonReentrant {
        if (token == address(0) || amount == 0) revert InvalidInput();
        if (source != SOURCE_TEAM && source != SOURCE_SPONSOR && source != SOURCE_PLAYER_FORFEITS) revert InvalidInput();
        if (source == SOURCE_PLAYER_FORFEITS && !isForfeitSource[msg.sender]) revert NotForfeitSource();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 toPot = amount;
        if (source == SOURCE_PLAYER_FORFEITS && deluluShareBps > 0 && treasury != address(0)) {
            uint256 toDelulu = (amount * deluluShareBps) / 10000;
            toPot = amount - toDelulu;
            deluluRevenueByToken[token] += toDelulu;
            IERC20(token).safeTransfer(treasury, toDelulu);
            emit ForfeitsSplit(token, msg.sender, toPot, toDelulu);
        }
        fundedBySource[token][source] += toPot;
        emit PoolFundedBySource(token, msg.sender, source, toPot);
    }

    /**
     * @notice Grant `amount` of `token` to `user` out of the vault's own pool — the
     *         unallocated balance (`availableBalance`) — instead of the caller's wallet.
     *         The rewarder only needs gas; no tokens leave its wallet.
     * @param rewardId Same one-time id semantics as `depositReward` (shared namespace).
     */
    function creditReward(
        address user,
        address token,
        uint256 amount,
        bytes32 rewardId
    ) external nonReentrant onlyRewarder whenNotPaused {
        if (user == address(0) || token == address(0) || amount == 0) revert InvalidInput();
        uint256 cap = maxDepositPerToken[token];
        if (cap != 0 && amount > cap) revert AmountExceedsMax();
        if (usedRewardId[rewardId]) revert RewardIdAlreadyUsed();
        if (amount > availableBalance(token)) revert InsufficientFreeBalance();

        uint256 dailyCap = maxDailyCreditPerToken[token];
        uint256 day = block.timestamp / 1 days;
        uint256 creditedToday = creditedOnDay[token][day] + amount;
        if (dailyCap != 0 && creditedToday > dailyCap) revert DailyCreditLimitExceeded();

        usedRewardId[rewardId] = true;
        creditedOnDay[token][day] = creditedToday;
        pendingRewardByToken[user][token] += amount;
        totalPendingByToken[token] += amount;
        totalGrantedByToken[token] += amount;

        // Same event as depositReward so claim UIs/indexers treat both alike;
        // depositedBy = the vault itself marks a pool-funded grant.
        emit RewardDeposited(user, token, amount, rewardId, address(this));
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
        if (amount > availableBalance(token)) revert InsufficientFreeBalance();

        IERC20(token).safeTransfer(to, amount);
        emit TokenRescued(token, to, amount);
    }

    /// @notice Pool balance not yet owed to anyone — what `creditReward` can still hand out.
    function availableBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this)) - totalPendingByToken[token] - totalStakeCreditByToken[token];
    }

    // --- v3: players spend and reuse G$ ---

    /**
     * @notice A player pays G$ into the pot for something in the app (e.g. kind =
     *         keccak256("STREAK_FREEZE") or keccak256("FRESH_CARD")). All of it funds rewards.
     */
    function purchase(address token, uint256 amount, bytes32 kind, bytes32 ref) external nonReentrant whenNotPaused {
        if (token == address(0) || amount == 0 || kind == bytes32(0)) revert InvalidInput();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        fundedBySource[token][SOURCE_PLAYER_PURCHASES] += amount;
        emit Purchased(msg.sender, token, amount, kind, ref);
        emit PoolFundedBySource(token, msg.sender, SOURCE_PLAYER_PURCHASES, amount);
    }

    /**
     * @notice Cheer another player with G$: `cheerFeeBps` goes to the pot, the rest is
     *         credited to them (they claim it like any reward).
     */
    function cheer(address to, address token, uint256 amount, bytes32 ref) external nonReentrant whenNotPaused {
        if (to == address(0) || to == msg.sender || token == address(0) || amount == 0) revert InvalidInput();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 toPot = (amount * cheerFeeBps) / 10000;
        uint256 toPlayer = amount - toPot;
        pendingRewardByToken[to][token] += toPlayer;
        totalPendingByToken[token] += toPlayer;
        if (toPot > 0) {
            fundedBySource[token][SOURCE_PLAYER_PURCHASES] += toPot;
            emit PoolFundedBySource(token, msg.sender, SOURCE_PLAYER_PURCHASES, toPot);
        }
        emit Cheered(msg.sender, to, token, toPlayer, toPot, ref);
    }

    /**
     * @notice Grant stake-only credit out of the pool (welcome gift, referral): the player
     *         can only use it to stake on a goal through `stakeFromVault`, never withdraw it.
     */
    function grantStakeCredit(address user, address token, uint256 amount, bytes32 rewardId)
        external
        nonReentrant
        onlyRewarder
        whenNotPaused
    {
        if (user == address(0) || token == address(0) || amount == 0) revert InvalidInput();
        uint256 cap = maxDepositPerToken[token];
        if (cap != 0 && amount > cap) revert AmountExceedsMax();
        if (usedRewardId[rewardId]) revert RewardIdAlreadyUsed();
        if (amount > availableBalance(token)) revert InsufficientFreeBalance();

        uint256 dailyCap = maxDailyCreditPerToken[token];
        uint256 day = block.timestamp / 1 days;
        uint256 creditedToday = creditedOnDay[token][day] + amount;
        if (dailyCap != 0 && creditedToday > dailyCap) revert DailyCreditLimitExceeded();

        usedRewardId[rewardId] = true;
        creditedOnDay[token][day] = creditedToday;
        stakeCreditByToken[user][token] += amount;
        totalStakeCreditByToken[token] += amount;
        totalGrantedByToken[token] += amount;
        emit StakeCreditGranted(user, token, amount, rewardId);
    }

    /**
     * @notice Stake on a goal straight from the vault: stake credit first, then (if
     *         `useRewards`) the player's unclaimed rewards — a rollover — and any rest from
     *         their wallet (needs a G$ approval to the vault). The goal is created
     *         in ForfeitMarket with the player as its creator, exactly as if they staked
     *         from their own wallet. Parameters are ForfeitMarket.createCommitment's.
     */
    function stakeFromVault(
        address token,
        uint256 stakeAmount,
        bool useRewards,
        uint8 destinationType,
        address destinationAddr,
        uint8 cadence,
        uint32 totalPeriods,
        uint64 periodSeconds,
        uint64 firstDeadline,
        address verifier
    ) external nonReentrant whenNotPaused returns (uint256 commitmentId) {
        if (forfeitMarket == address(0)) revert ForfeitMarketNotSet();
        if (token == address(0) || stakeAmount == 0) revert InvalidInput();

        uint256 credit = stakeCreditByToken[msg.sender][token];
        uint256 fromCredit = credit >= stakeAmount ? stakeAmount : credit;
        uint256 rest = stakeAmount - fromCredit;
        uint256 fromRewards;
        if (useRewards && rest > 0) {
            uint256 pending = pendingRewardByToken[msg.sender][token];
            fromRewards = pending >= rest ? rest : pending;
        }
        // Whatever credit and rewards don't cover comes from the player's wallet (approve the vault).
        uint256 fromWallet = rest - fromRewards;
        if (fromCredit == 0 && fromRewards == 0) revert InsufficientStakeFunds(); // nothing from the vault: stake directly instead

        if (fromRewards > 0) {
            pendingRewardByToken[msg.sender][token] -= fromRewards;
            totalPendingByToken[token] -= fromRewards;
            rolledOverByToken[token] += fromRewards;
        }
        if (fromCredit > 0) {
            stakeCreditByToken[msg.sender][token] = credit - fromCredit;
            totalStakeCreditByToken[token] -= fromCredit;
        }
        if (fromWallet > 0) IERC20(token).safeTransferFrom(msg.sender, address(this), fromWallet);

        IERC20(token).forceApprove(forfeitMarket, stakeAmount);
        commitmentId = IForfeitMarketStaking(forfeitMarket).createCommitmentFor(
            msg.sender, token, stakeAmount, destinationType, destinationAddr, cadence, totalPeriods, periodSeconds, firstDeadline, verifier
        );
        emit StakedFromVault(msg.sender, token, fromCredit, fromRewards, fromWallet, commitmentId);
    }

    /**
     * @notice How the reward pool is funded since v3, for anyone to read:
     *         player money (missed stakes + purchases) versus team and sponsors, and
     *         what share of all funding came from players (basis points, 10000 = 100%).
     */
    function sustainability(address token)
        external
        view
        returns (
            uint256 playerForfeits,
            uint256 playerPurchases,
            uint256 team,
            uint256 sponsor,
            uint256 granted,
            uint256 rolledOver,
            uint256 deluluRevenue,
            uint256 playerFundedBps
        )
    {
        playerForfeits = fundedBySource[token][SOURCE_PLAYER_FORFEITS];
        playerPurchases = fundedBySource[token][SOURCE_PLAYER_PURCHASES];
        team = fundedBySource[token][SOURCE_TEAM];
        sponsor = fundedBySource[token][SOURCE_SPONSOR];
        granted = totalGrantedByToken[token];
        rolledOver = rolledOverByToken[token];
        deluluRevenue = deluluRevenueByToken[token];
        uint256 total = playerForfeits + playerPurchases + team + sponsor;
        playerFundedBps = total == 0 ? 0 : ((playerForfeits + playerPurchases) * 10000) / total;
    }

    function stakeCredit(address user, address token) external view returns (uint256) {
        return stakeCreditByToken[user][token];
    }

    function pendingReward(address user, address token) external view returns (uint256) {
        return pendingRewardByToken[user][token];
    }
}
