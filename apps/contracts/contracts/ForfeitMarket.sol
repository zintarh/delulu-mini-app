// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ForfeitMarket
 * @notice UUPS-upgradeable personal stake-or-lose commitment contract. A creator escrows
 *         a stake and picks how success is verified (self, a named friend, or an
 *         AI-gated self-submission handled entirely off-chain) and where a missed
 *         commitment's stake goes (back to self on success only; on forfeiture, to an
 *         approved charity, a friend, or the shared community pool).
 *         Deploy behind an ERC1967 proxy; upgrade via owner-only upgradeToAndCall.
 */
contract ForfeitMarket is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // --- ERRORS ---
    error InvalidInput();
    error CommitmentNotFound();
    error Unauthorized();
    error NotActive();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error PeriodAlreadyResolved();
    error VerifierAlreadySet();
    error InvalidInviteCode();
    error CharityNotApproved();
    error StakeBelowMinimum();

    // --- CONSTANTS ---
    uint256 public constant BPS_DENOMINATOR = 10000;
    /// @dev Paid to whoever permissionlessly resolves an overdue commitment as forfeited.
    uint256 public constant KEEPER_BOUNTY_BPS = 100; // 1%
    /// @dev Taken only on forfeiture, never on success — the platform earns when the
    ///      accountability mechanism does its job, not from someone losing money per se.
    uint256 public constant PROTOCOL_FEE_BPS = 500; // 5%

    // --- ENUMS ---
    enum DestinationType {
        SelfReturn,
        Charity,
        Friend,
        CommunityPool
    }

    enum Cadence {
        Once,
        Daily,
        Weekday,
        Weekly,
        Monthly
    }

    enum PeriodOutcome {
        Pending,
        Success,
        Forfeited
    }

    // --- STATE ---
    struct Commitment {
        address creator;
        address token;
        uint256 stakeAmount;
        DestinationType destinationType;
        address destinationAddr;
        Cadence cadence;
        uint64 periodSeconds;
        uint64 currentPeriodDeadline;
        uint32 currentPeriodIndex;
        uint32 totalPeriods;
        address verifier; // address(0) = self/AI-gated-self verification
        bool active;
        bool cancelled;
    }

    uint256 public nextCommitmentId;
    mapping(uint256 => Commitment) public commitments;

    /// @dev Per-period outcome log. Rich proof history (links, AI verdicts) lives
    ///      off-chain in the subgraph/DB, reconstructed from events — the contract
    ///      only needs to know whether the current period has already been resolved.
    mapping(uint256 => mapping(uint32 => PeriodOutcome)) public periodOutcome;

    /// @dev Set only when the named friend-verifier isn't an existing wallet yet at
    ///      creation time (only a username/email was available off-chain). Cleared once
    ///      the invited friend claims the role via acceptVerifierInvite.
    mapping(uint256 => bytes32) public pendingVerifierCodeHash;

    /// @dev Owner-curated allowlist for Charity destinations — prevents a typo'd or
    ///      bad-faith address from silently swallowing someone's stake.
    mapping(address => bool) public approvedCharities;

    /// @dev Per-token minimum stake, sized so the keeper bounty clears a sane gas-cost
    ///      floor on Celo and the permissionless resolution path stays economically viable.
    mapping(address => uint256) public minStakeForToken;

    /// @dev Forfeited stake routed to the shared community pool, per token.
    mapping(address => uint256) public communityPoolBalance;

    address public platformFeeAddress;

    // --- EVENTS ---
    event CommitmentCreated(
        uint256 indexed commitmentId,
        address indexed creator,
        address token,
        uint256 stakeAmount,
        DestinationType destinationType,
        address destinationAddr,
        Cadence cadence,
        uint64 periodSeconds,
        uint32 totalPeriods,
        uint64 firstDeadline,
        address verifier
    );
    event VerifierInviteAccepted(uint256 indexed commitmentId, address indexed verifier);
    event ProofSubmitted(
        uint256 indexed commitmentId,
        uint32 indexed periodIndex,
        address indexed creator,
        string proofLink
    );
    event PeriodResolvedSuccess(
        uint256 indexed commitmentId,
        uint32 indexed periodIndex,
        address indexed resolver,
        bool commitmentEnded
    );
    event PeriodResolvedForfeited(
        uint256 indexed commitmentId,
        uint32 indexed periodIndex,
        address indexed keeper,
        uint256 bountyPaid,
        uint256 platformFee,
        DestinationType destinationType,
        address destinationAddr,
        uint256 amountToDestination
    );
    event CommitmentCancelled(uint256 indexed commitmentId, uint256 refundAmount);
    event ApprovedCharityUpdated(address indexed charity, bool approved);
    event MinStakeUpdated(address indexed token, uint256 minStake);
    event PlatformFeeAddressUpdated(address indexed newPlatformFeeAddress);
    event CommunityPoolWithdrawn(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _platformFeeAddress) public initializer {
        if (initialOwner == address(0) || _platformFeeAddress == address(0)) revert InvalidInput();
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        platformFeeAddress = _platformFeeAddress;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- ADMIN ---

    function setApprovedCharity(address charity, bool approved) external onlyOwner {
        if (charity == address(0)) revert InvalidInput();
        approvedCharities[charity] = approved;
        emit ApprovedCharityUpdated(charity, approved);
    }

    function setMinStake(address token, uint256 minStake) external onlyOwner {
        minStakeForToken[token] = minStake;
        emit MinStakeUpdated(token, minStake);
    }

    function setPlatformFeeAddress(address _platform) external onlyOwner {
        if (_platform == address(0)) revert InvalidInput();
        platformFeeAddress = _platform;
        emit PlatformFeeAddressUpdated(_platform);
    }

    /// @notice Owner withdraws accrued community-pool forfeitures for redistribution.
    function withdrawCommunityPool(address token, address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) revert InvalidInput();
        if (amount == 0 || amount > communityPoolBalance[token]) revert InvalidInput();
        communityPoolBalance[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit CommunityPoolWithdrawn(token, to, amount);
    }

    // --- COMMITMENT LIFECYCLE ---

    /**
     * @param verifier Resolved wallet of an existing-user friend-verifier, or address(0)
     *        for self/AI-gated-self verification, or address(0) with a nonzero
     *        `verifierInviteCodeHash` when the named friend isn't an app user yet.
     * @param verifierInviteCodeHash keccak256 of a server-generated one-time code, set only
     *        for the "friend not yet a user" case — see acceptVerifierInvite.
     */
    function createCommitment(
        address token,
        uint256 stakeAmount,
        DestinationType destinationType,
        address destinationAddr,
        Cadence cadence,
        uint32 totalPeriods,
        uint64 periodSeconds,
        uint64 firstDeadline,
        address verifier,
        bytes32 verifierInviteCodeHash
    ) external nonReentrant returns (uint256 commitmentId) {
        if (token == address(0) || stakeAmount == 0 || totalPeriods == 0) revert InvalidInput();
        if (stakeAmount < minStakeForToken[token]) revert StakeBelowMinimum();
        if (firstDeadline <= block.timestamp) revert InvalidInput();
        if (cadence == Cadence.Once) {
            if (totalPeriods != 1) revert InvalidInput();
        } else if (periodSeconds == 0) {
            revert InvalidInput();
        }
        if (verifier != address(0) && verifierInviteCodeHash != bytes32(0)) revert InvalidInput();

        if (destinationType == DestinationType.Charity) {
            if (!approvedCharities[destinationAddr]) revert CharityNotApproved();
        } else if (destinationType == DestinationType.Friend) {
            if (destinationAddr == address(0)) revert InvalidInput();
        } else {
            // SelfReturn / CommunityPool never move funds to a user-supplied address.
            if (destinationAddr != address(0)) revert InvalidInput();
        }

        commitmentId = nextCommitmentId++;
        commitments[commitmentId] = Commitment({
            creator: msg.sender,
            token: token,
            stakeAmount: stakeAmount,
            destinationType: destinationType,
            destinationAddr: destinationAddr,
            cadence: cadence,
            periodSeconds: periodSeconds,
            currentPeriodDeadline: firstDeadline,
            currentPeriodIndex: 0,
            totalPeriods: totalPeriods,
            verifier: verifier,
            active: true,
            cancelled: false
        });

        if (verifierInviteCodeHash != bytes32(0)) {
            pendingVerifierCodeHash[commitmentId] = verifierInviteCodeHash;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), stakeAmount);

        emit CommitmentCreated(
            commitmentId,
            msg.sender,
            token,
            stakeAmount,
            destinationType,
            destinationAddr,
            cadence,
            periodSeconds,
            totalPeriods,
            firstDeadline,
            verifier
        );
    }

    /// @notice Self-service binding: the invited friend claims the verifier role for a
    ///         commitment once they have a wallet, gated by a server-issued one-time code
    ///         so only the intended invitee can claim it. No relayer/backend signer needed.
    function acceptVerifierInvite(uint256 commitmentId, bytes32 inviteCode) external {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (c.verifier != address(0)) revert VerifierAlreadySet();
        bytes32 codeHash = pendingVerifierCodeHash[commitmentId];
        if (codeHash == bytes32(0) || keccak256(abi.encodePacked(inviteCode)) != codeHash) {
            revert InvalidInviteCode();
        }
        c.verifier = msg.sender;
        delete pendingVerifierCodeHash[commitmentId];
        emit VerifierInviteAccepted(commitmentId, msg.sender);
    }

    /// @notice Records evidence for the current period. Deliberately evidence-agnostic —
    ///         the contract never interprets what kind of proof this is, so new evidence
    ///         types (GPS, Strava, ...) never require a contract change.
    function submitProof(uint256 commitmentId, string calldata proofLink) external {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (msg.sender != c.creator) revert Unauthorized();
        if (!c.active || c.cancelled) revert NotActive();
        if (periodOutcome[commitmentId][c.currentPeriodIndex] != PeriodOutcome.Pending) {
            revert PeriodAlreadyResolved();
        }
        emit ProofSubmitted(commitmentId, c.currentPeriodIndex, msg.sender, proofLink);
    }

    /// @notice Marks the current period successful. Callable by the creator for
    ///         self-verify and AI-gated-self paths (the AI check happens off-chain and
    ///         only gates whether the client is allowed to fire this call — the contract
    ///         can't and doesn't need to distinguish the two), or by the designated
    ///         `verifier` for the friend-verify path. On the final period the full stake
    ///         returns to the creator; otherwise it stays escrowed, backing the next
    ///         period, so only one period's stake is ever at risk at a time.
    function resolveCommitmentSuccess(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (!c.active || c.cancelled) revert NotActive();
        if (block.timestamp > c.currentPeriodDeadline) revert DeadlinePassed();
        if (periodOutcome[commitmentId][c.currentPeriodIndex] != PeriodOutcome.Pending) {
            revert PeriodAlreadyResolved();
        }

        bool authorized = c.verifier == address(0)
            ? msg.sender == c.creator
            : msg.sender == c.verifier;
        if (!authorized) revert Unauthorized();

        periodOutcome[commitmentId][c.currentPeriodIndex] = PeriodOutcome.Success;

        bool isFinalPeriod = c.currentPeriodIndex + 1 >= c.totalPeriods;
        if (isFinalPeriod) {
            c.active = false;
            IERC20(c.token).safeTransfer(c.creator, c.stakeAmount);
        } else {
            c.currentPeriodIndex += 1;
            c.currentPeriodDeadline += c.periodSeconds;
        }

        emit PeriodResolvedSuccess(commitmentId, c.currentPeriodIndex, msg.sender, isFinalPeriod);
    }

    /// @notice Permissionless: callable by anyone once the current period's deadline has
    ///         passed with no success recorded. Pays the caller a keeper bounty, takes the
    ///         platform fee (waived for CommunityPool-destined stake, since that money is
    ///         already meant to flow back to the community rather than to Delulu), and
    ///         routes the remainder to the commitment's configured destination. Ends the
    ///         commitment outright — missing one period of a repeating commitment forfeits
    ///         the whole thing, it doesn't just cost that one period.
    function resolveCommitmentForfeited(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (!c.active || c.cancelled) revert NotActive();
        if (block.timestamp <= c.currentPeriodDeadline) revert DeadlineNotPassed();
        if (periodOutcome[commitmentId][c.currentPeriodIndex] != PeriodOutcome.Pending) {
            revert PeriodAlreadyResolved();
        }

        periodOutcome[commitmentId][c.currentPeriodIndex] = PeriodOutcome.Forfeited;
        c.active = false;

        uint256 stakeAmount = c.stakeAmount;
        uint256 bounty = (stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
        uint256 fee = c.destinationType == DestinationType.CommunityPool
            ? 0
            : (stakeAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 remainder = stakeAmount - bounty - fee;

        IERC20 stakeToken = IERC20(c.token);
        if (bounty > 0) stakeToken.safeTransfer(msg.sender, bounty);
        if (fee > 0) stakeToken.safeTransfer(platformFeeAddress, fee);

        if (c.destinationType == DestinationType.CommunityPool) {
            communityPoolBalance[c.token] += remainder;
        } else {
            // SelfReturn never reaches forfeiture with a nonzero remainder recipient other
            // than the creator; Charity/Friend transfer directly to the validated address.
            address to = c.destinationType == DestinationType.SelfReturn
                ? c.creator
                : c.destinationAddr;
            stakeToken.safeTransfer(to, remainder);
        }

        emit PeriodResolvedForfeited(
            commitmentId,
            c.currentPeriodIndex,
            msg.sender,
            bounty,
            fee,
            c.destinationType,
            c.destinationAddr,
            remainder
        );
    }

    /// @notice Creator-only. Blocked once the current period's deadline has passed, so a
    ///         creator can't front-run their own forfeiture with a cancel — at that point
    ///         resolveCommitmentForfeited is the only path. Refunds the full escrowed stake.
    function cancelCommitment(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (msg.sender != c.creator) revert Unauthorized();
        if (!c.active || c.cancelled) revert NotActive();
        if (block.timestamp > c.currentPeriodDeadline) revert DeadlinePassed();

        c.active = false;
        c.cancelled = true;
        uint256 refund = c.stakeAmount;
        IERC20(c.token).safeTransfer(c.creator, refund);

        emit CommitmentCancelled(commitmentId, refund);
    }

    // --- VIEW HELPERS ---

    function isPeriodOverdue(uint256 commitmentId) external view returns (bool) {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0) || !c.active || c.cancelled) return false;
        if (periodOutcome[commitmentId][c.currentPeriodIndex] != PeriodOutcome.Pending) return false;
        return block.timestamp > c.currentPeriodDeadline;
    }

    function getCommitmentState(uint256 commitmentId) external view returns (string memory) {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (c.cancelled) return "CANCELLED";
        if (!c.active) return "ENDED";
        if (
            periodOutcome[commitmentId][c.currentPeriodIndex] == PeriodOutcome.Pending &&
            block.timestamp > c.currentPeriodDeadline
        ) {
            return "OVERDUE";
        }
        return "ACTIVE";
    }

    /// @dev Reserved for future storage without breaking upgrades.
    uint256[45] private __gap;
}
