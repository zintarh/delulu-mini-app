// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract DeluluOracle {
    enum Position { NONE, BELIEVE, DOUBT }
    enum DelusionStatus { ACTIVE, VERIFIED }
    
    struct Delusion {
        uint256 id;
        address creator;
        string description;
        uint256 deadline;
        uint256 believePool;
        uint256 doubtPool;
        DelusionStatus status;
        bool result; // true = BELIEVE wins, false = DOUBT wins
    }
    
    struct UserStake {
        Position position;
        uint256 amount;
        bool claimed;
    }
    
    IERC20 public cUSD;
    mapping(uint256 => Delusion) public delusions;
    mapping(uint256 => mapping(address => UserStake)) public stakes;
    uint256 public delusionCounter;
    
    event DelusionCreated(uint256 indexed delusionId, address indexed creator, uint256 stake, uint256 deadline);
    event StakePlaced(uint256 indexed delusionId, address indexed staker, Position position, uint256 amount);
    event PositionSwitched(uint256 indexed delusionId, address indexed staker, Position newPosition);
    event DelusionVerified(uint256 indexed delusionId, bool result);
    event WinningsClaimed(uint256 indexed delusionId, address indexed claimer, uint256 amount);
    
    // cUSD address on Celo Mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
    // cUSD address on Celo Alfajores Testnet: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
    constructor(address _cUSDAddress) {
        require(_cUSDAddress != address(0), "Invalid cUSD address");
        cUSD = IERC20(_cUSDAddress);
    }
    
    modifier delusionExists(uint256 _delusionId) {
        require(_delusionId > 0 && _delusionId <= delusionCounter, "Delusion does not exist");
        _;
    }
    
    modifier onlyCreator(uint256 _delusionId) {
        require(msg.sender == delusions[_delusionId].creator, "Only creator can call this");
        _;
    }
    
    modifier isActive(uint256 _delusionId) {
        require(delusions[_delusionId].status == DelusionStatus.ACTIVE, "Delusion is not active");
        _;
    }
    
    modifier afterDeadline(uint256 _delusionId) {
        require(block.timestamp >= delusions[_delusionId].deadline, "Deadline not reached");
        _;
    }
    
    modifier beforeDeadline(uint256 _delusionId) {
        require(block.timestamp < delusions[_delusionId].deadline, "Deadline passed");
        _;
    }
    
    function createDelusion(string memory _description, uint256 _durationInSeconds, uint256 _stakeAmount) external returns (uint256) {
        require(_stakeAmount > 0, "Must stake cUSD to create delusion");
        require(_durationInSeconds > 0, "Duration must be positive");
        
        // Transfer cUSD from creator to contract
        require(cUSD.transferFrom(msg.sender, address(this), _stakeAmount), "cUSD transfer failed");
        
        delusionCounter++;
        uint256 delusionId = delusionCounter;
        uint256 deadline = block.timestamp + _durationInSeconds;
        
        delusions[delusionId] = Delusion({
            id: delusionId,
            creator: msg.sender,
            description: _description,
            deadline: deadline,
            believePool: _stakeAmount,
            doubtPool: 0,
            status: DelusionStatus.ACTIVE,
            result: false
        });
        
        stakes[delusionId][msg.sender] = UserStake({
            position: Position.BELIEVE,
            amount: _stakeAmount,
            claimed: false
        });
        
        emit DelusionCreated(delusionId, msg.sender, _stakeAmount, deadline);
        emit StakePlaced(delusionId, msg.sender, Position.BELIEVE, _stakeAmount);
        
        return delusionId;
    }
    
    function stakeBelieve(uint256 _delusionId, uint256 _amount) external 
        delusionExists(_delusionId) 
        isActive(_delusionId) 
        beforeDeadline(_delusionId) 
    {
        require(_amount > 0, "Must stake cUSD");
        require(stakes[_delusionId][msg.sender].position == Position.NONE, "Already staked");
        
        // Transfer cUSD from user to contract
        require(cUSD.transferFrom(msg.sender, address(this), _amount), "cUSD transfer failed");
        
        delusions[_delusionId].believePool += _amount;
        
        stakes[_delusionId][msg.sender] = UserStake({
            position: Position.BELIEVE,
            amount: _amount,
            claimed: false
        });
        
        emit StakePlaced(_delusionId, msg.sender, Position.BELIEVE, _amount);
    }
    
    function stakeDoubt(uint256 _delusionId, uint256 _amount) external 
        delusionExists(_delusionId) 
        isActive(_delusionId) 
        beforeDeadline(_delusionId) 
    {
        require(_amount > 0, "Must stake cUSD");
        require(stakes[_delusionId][msg.sender].position == Position.NONE, "Already staked");
        
        // Transfer cUSD from user to contract
        require(cUSD.transferFrom(msg.sender, address(this), _amount), "cUSD transfer failed");
        
        delusions[_delusionId].doubtPool += _amount;
        
        stakes[_delusionId][msg.sender] = UserStake({
            position: Position.DOUBT,
            amount: _amount,
            claimed: false
        });
        
        emit StakePlaced(_delusionId, msg.sender, Position.DOUBT, _amount);
    }
    
    function switchToDoubt(uint256 _delusionId) external 
        delusionExists(_delusionId) 
        onlyCreator(_delusionId) 
        isActive(_delusionId) 
        beforeDeadline(_delusionId) 
    {
        UserStake storage userStake = stakes[_delusionId][msg.sender];
        require(userStake.position == Position.BELIEVE, "Not currently on BELIEVE");
        require(userStake.amount > 0, "No stake to switch");
        
        uint256 amount = userStake.amount;
        
        // Move stake from BELIEVE to DOUBT
        delusions[_delusionId].believePool -= amount;
        delusions[_delusionId].doubtPool += amount;
        
        userStake.position = Position.DOUBT;
        
        emit PositionSwitched(_delusionId, msg.sender, Position.DOUBT);
    }
    
    function verifyDelusion(uint256 _delusionId, bool _result) external 
        delusionExists(_delusionId) 
        onlyCreator(_delusionId) 
        isActive(_delusionId) 
        afterDeadline(_delusionId) 
    {
        delusions[_delusionId].status = DelusionStatus.VERIFIED;
        delusions[_delusionId].result = _result;
        
        emit DelusionVerified(_delusionId, _result);
    }
    
    function claimWinnings(uint256 _delusionId) external delusionExists(_delusionId) {
        require(delusions[_delusionId].status == DelusionStatus.VERIFIED, "Delusion not verified");
        
        UserStake storage userStake = stakes[_delusionId][msg.sender];
        require(userStake.amount > 0, "No stake found");
        require(!userStake.claimed, "Already claimed");
        
        Delusion storage delusion = delusions[_delusionId];
        uint256 payout = 0;
        
        // Check if user is on winning side
        bool isWinner = (delusion.result && userStake.position == Position.BELIEVE) || 
                        (!delusion.result && userStake.position == Position.DOUBT);
        
        if (isWinner) {
            uint256 winningPool = delusion.result ? delusion.believePool : delusion.doubtPool;
            uint256 losingPool = delusion.result ? delusion.doubtPool : delusion.believePool;
            uint256 totalPool = winningPool + losingPool;
            
            if (winningPool > 0) {
                // Calculate proportional payout: (user's stake / winning pool) * total pool
                payout = (userStake.amount * totalPool) / winningPool;
            }
        }
        
        userStake.claimed = true;
        
        if (payout > 0) {
            require(cUSD.transfer(msg.sender, payout), "cUSD transfer failed");
        }
        
        emit WinningsClaimed(_delusionId, msg.sender, payout);
    }
    
    // View functions
    function getDelusion(uint256 _delusionId) external view delusionExists(_delusionId) returns (
        address creator,
        string memory description,
        uint256 deadline,
        uint256 believePool,
        uint256 doubtPool,
        DelusionStatus status,
        bool result
    ) {
        Delusion storage d = delusions[_delusionId];
        return (d.creator, d.description, d.deadline, d.believePool, d.doubtPool, d.status, d.result);
    }
    
    function getUserStake(uint256 _delusionId, address _user) external view delusionExists(_delusionId) returns (
        Position position,
        uint256 amount,
        bool claimed
    ) {
        UserStake storage s = stakes[_delusionId][_user];
        return (s.position, s.amount, s.claimed);
    }
    
    function calculatePotentialWinnings(uint256 _delusionId, address _user) external view delusionExists(_delusionId) returns (uint256) {
        UserStake storage userStake = stakes[_delusionId][_user];
        if (userStake.amount == 0 || delusions[_delusionId].status != DelusionStatus.VERIFIED) {
            return 0;
        }
        
        Delusion storage delusion = delusions[_delusionId];
        bool isWinner = (delusion.result && userStake.position == Position.BELIEVE) || 
                        (!delusion.result && userStake.position == Position.DOUBT);
        
        if (!isWinner) {
            return 0;
        }
        
        uint256 winningPool = delusion.result ? delusion.believePool : delusion.doubtPool;
        uint256 losingPool = delusion.result ? delusion.doubtPool : delusion.believePool;
        uint256 totalPool = winningPool + losingPool;
        
        if (winningPool == 0) {
            return 0;
        }
        
        return (userStake.amount * totalPool) / winningPool;
    }
    
    // Emergency function to recover accidentally sent tokens (not stakes)
    function getCUSDAddress() external view returns (address) {
        return address(cUSD);
    }
}