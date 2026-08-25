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
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
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
    error VerifierInvitePending();
    error TokenNotApproved();
    error NothingToClaim();

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

    /// @dev Owner-curated allowlist for stake tokens. Without this, createCommitment
    ///      would accept any ERC20 — a fee-on-transfer or rebasing token would record a
    ///      nominal stakeAmount that exceeds what the contract actually receives, and
    ///      since all commitments in a token share one undifferentiated balance, that
    ///      shortfall can leave a later, unrelated commitment in the same token unable
    ///      to pay out in full.
    mapping(address => bool) public approvedTokens;

    /// @dev Per-token minimum stake, sized so the keeper bounty clears a sane gas-cost
    ///      floor on Celo and the permissionless resolution path stays economically viable.
    mapping(address => uint256) public minStakeForToken;

    /// @dev Forfeited stake routed to the shared community pool, per token.
    mapping(address => uint256) public communityPoolBalance;

    address public platformFeeAddress;

    /// @dev Friend-destination forfeitures are credited here instead of transferred
    ///      immediately — recipient must call claimFriendReward to withdraw. Charity/
    ///      CommunityPool/SelfReturn are unaffected and still pay out instantly.
    ///      Declared after platformFeeAddress (not before) — inserting a new variable
    ///      ahead of an existing one on a live UUPS proxy would shift platformFeeAddress
    ///      to a storage slot the deployed proxy doesn't have set, reading back as
    ///      address(0) and breaking every fee transfer in _distributeForfeitedStake.
    mapping(address => mapping(address => uint256)) public pendingFriendReward; // recipient => token => amount

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
    event FriendRewardCredited(
        uint256 indexed commitmentId,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );
    event FriendRewardClaimed(address indexed recipient, address indexed token, uint256 amount);
    event ApprovedCharityUpdated(address indexed charity, bool approved);
    event ApprovedTokenUpdated(address indexed token, bool approved);
    event MinStakeUpdated(address indexed token, uint256 minStake);
    event PlatformFeeAddressUpdated(address indexed newPlatformFeeAddress);
    event CommunityPoolWithdrawn(address indexed token, address indexed to, uint256 amount);
    event VerifierInviteRevoked(uint256 indexed commitmentId, address indexed newVerifier);
    /// @dev Emitted when a forfeiture's destination transfer fails (e.g. the token
    ///      blacklisted or paused that address) and the remainder was routed to the
    ///      community pool instead, so it doesn't get permanently stuck.
    event ForfeitedDestinationFallback(
        uint256 indexed commitmentId,
        address indexed destination,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner, address _platformFeeAddress) public initializer {
        if (initialOwner == address(0) || _platformFeeAddress == address(0)) revert InvalidInput();
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
        platformFeeAddress = _platformFeeAddress;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- ADMIN ---

    function setApprovedCharity(address charity, bool approved) external onlyOwner {
        if (charity == address(0)) revert InvalidInput();
        approvedCharities[charity] = approved;
        emit ApprovedCharityUpdated(charity, approved);
    }

    function setApprovedToken(address token, bool approved) external onlyOwner {
        if (token == address(0)) revert InvalidInput();
        approvedTokens[token] = approved;
        emit ApprovedTokenUpdated(token, approved);
    }

    function setMinStake(address token, uint256 minStake) external onlyOwner {
        minStakeForToken[token] = minStake;
        emit MinStakeUpdated(token, minStake);
    }

    /// @notice Blocks new commitments only — existing ones can still be resolved,
    ///         cancelled, or permissionlessly forfeited as normal, so a pause never
    ///         locks anyone out of funds already at stake. Meant as a fast circuit
    ///         breaker if a bug is discovered, buying time to prepare a proper upgrade
    ///         without leaving createCommitment open in the meantime.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
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
    ) external nonReentrant whenNotPaused returns (uint256 commitmentId) {
        if (token == address(0) || stakeAmount == 0 || totalPeriods == 0) revert InvalidInput();
        if (!approvedTokens[token]) revert TokenNotApproved();
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

    /**
     * @notice Creator-only escape hatch for the friend-verify path: rebind to a
     *         different resolved wallet or issue a fresh invite code. Exists mainly
     *         so a hijacked invite (the plaintext code was visible in the mempool
     *         before `acceptVerifierInvite` mined, letting someone else claim the
     *         role first) or a simple mistake isn't a permanent dead end for the
     *         commitment. Deliberately cannot be used to clear verification down to
     *         self-verify — exactly one of `newVerifier` / `newInviteCodeHash` must be
     *         set, same mutual-exclusivity as createCommitment.
     * @param newVerifier Resolved wallet of an existing-user friend-verifier, or
     *        address(0) if issuing an invite code instead.
     * @param newInviteCodeHash keccak256 of a fresh one-time code, or bytes32(0) if
     *        binding directly to `newVerifier` instead.
     */
    function revokeVerifierInvite(
        uint256 commitmentId,
        address newVerifier,
        bytes32 newInviteCodeHash
    ) external {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (msg.sender != c.creator) revert Unauthorized();
        if (!c.active || c.cancelled) revert NotActive();
        if (block.timestamp > c.currentPeriodDeadline) revert DeadlinePassed();
        if (periodOutcome[commitmentId][c.currentPeriodIndex] != PeriodOutcome.Pending) {
            revert PeriodAlreadyResolved();
        }
        if (c.verifier == address(0) && pendingVerifierCodeHash[commitmentId] == bytes32(0)) {
            revert InvalidInput(); // not a friend-verify commitment — nothing to revoke
        }
        if (newVerifier == address(0) && newInviteCodeHash == bytes32(0)) revert InvalidInput();
        if (newVerifier != address(0) && newInviteCodeHash != bytes32(0)) revert InvalidInput();

        c.verifier = newVerifier;
        if (newInviteCodeHash != bytes32(0)) {
            pendingVerifierCodeHash[commitmentId] = newInviteCodeHash;
        } else {
            delete pendingVerifierCodeHash[commitmentId];
        }
        emit VerifierInviteRevoked(commitmentId, newVerifier);
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

        bool authorized;
        if (c.verifier != address(0)) {
            authorized = msg.sender == c.verifier;
        } else if (pendingVerifierCodeHash[commitmentId] != bytes32(0)) {
            // A friend-verifier invite is still pending acceptance. `c.verifier` reads
            // as address(0) here exactly like true self-verify, but the creator must
            // not be able to self-approve while a named friend hasn't claimed the role
            // yet — that would let them silently bypass friend-verification entirely by
            // just never forwarding the invite code. Nobody can resolve success until
            // the friend accepts (or the deadline lapses into permissionless forfeiture).
            revert VerifierInvitePending();
        } else {
            authorized = msg.sender == c.creator;
        }
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
    /// @dev Shared by resolveCommitmentForfeited (bounty > 0, permissionless) and
    ///      cancelCommitment (bounty == 0, creator-initiated) — same fee + destination
    ///      routing either way, since a voluntary cancel is a forfeiture, not a refund.
    function _distributeForfeitedStake(
        uint256 commitmentId,
        Commitment storage c,
        uint256 bounty
    ) internal returns (uint256 remainder, uint256 fee) {
        uint256 stakeAmount = c.stakeAmount;
        fee = c.destinationType == DestinationType.CommunityPool
            ? 0
            : (stakeAmount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        remainder = stakeAmount - bounty - fee;

        IERC20 stakeToken = IERC20(c.token);
        if (bounty > 0) stakeToken.safeTransfer(msg.sender, bounty);
        if (fee > 0) stakeToken.safeTransfer(platformFeeAddress, fee);

        if (c.destinationType == DestinationType.CommunityPool) {
            communityPoolBalance[c.token] += remainder;
        } else if (c.destinationType == DestinationType.Friend) {
            // Credited, not transferred — the recipient claims it themselves via
            // claimFriendReward. Unlike an instant transfer this can never fail
            // (a blacklisted/paused recipient just can't claim yet), so there's no
            // fallback-to-community-pool case to handle here.
            if (remainder > 0) {
                pendingFriendReward[c.destinationAddr][c.token] += remainder;
                emit FriendRewardCredited(commitmentId, c.destinationAddr, c.token, remainder);
            }
        } else if (remainder > 0) {
            // SelfReturn never reaches forfeiture with a nonzero remainder recipient other
            // than the creator; Charity transfers directly to the validated address.
            address to = c.destinationType == DestinationType.SelfReturn
                ? c.creator
                : c.destinationAddr;
            // A plain external call (not SafeERC20's inlined wrapper) so a reverting
            // transfer — e.g. `to` got blacklisted or paused by the token after the
            // commitment was created — is catchable instead of reverting this whole
            // resolution and leaving the stake, bounty, and fee permanently stuck with
            // no other path to unlock them. Falls back to the community pool, where an
            // owner can manually redirect it (see withdrawCommunityPool).
            try IERC20(c.token).transfer(to, remainder) returns (bool ok) {
                if (!ok) {
                    communityPoolBalance[c.token] += remainder;
                    emit ForfeitedDestinationFallback(commitmentId, to, remainder);
                }
            } catch {
                communityPoolBalance[c.token] += remainder;
                emit ForfeitedDestinationFallback(commitmentId, to, remainder);
            }
        }
    }

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

        uint256 bounty = (c.stakeAmount * KEEPER_BOUNTY_BPS) / BPS_DENOMINATOR;
        (uint256 remainder, uint256 fee) = _distributeForfeitedStake(commitmentId, c, bounty);

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

    /// @notice Claim the caller's full pending Friend-forfeiture reward balance for `token`.
    ///         Separate from resolution — the recipient (not the creator/keeper) decides
    ///         when to pull the funds, same pattern as RewardVault.claimReward.
    function claimFriendReward(address token) external nonReentrant {
        uint256 amount = pendingFriendReward[msg.sender][token];
        if (amount == 0) revert NothingToClaim();

        pendingFriendReward[msg.sender][token] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit FriendRewardClaimed(msg.sender, token, amount);
    }

    /// @notice Creator-only. Voluntarily discontinuing is a forfeiture, not a refund —
    ///         same fee + destination routing as a missed deadline, minus the keeper
    ///         bounty (no permissionless caller to pay here). Callable any time the
    ///         commitment is active, deadline passed or not: cancelling never returns
    ///         money to the creator, so there's no reason to race a keeper for it.
    function cancelCommitment(uint256 commitmentId) external nonReentrant {
        Commitment storage c = commitments[commitmentId];
        if (c.creator == address(0)) revert CommitmentNotFound();
        if (msg.sender != c.creator) revert Unauthorized();
        if (!c.active || c.cancelled) revert NotActive();

        periodOutcome[commitmentId][c.currentPeriodIndex] = PeriodOutcome.Forfeited;
        c.active = false;
        c.cancelled = true;

        (uint256 remainder, ) = _distributeForfeitedStake(commitmentId, c, 0);

        emit CommitmentCancelled(commitmentId, remainder);
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
    uint256[44] private __gap;
}
