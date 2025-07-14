// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAutophageToken.sol";

/**
 * @title ReservoirContract
 * @notice Dual-chamber treasury managing token decay and healthcare settlements
 * @dev Implements the metabolic center of the Autophage Protocol
 * 
 * Architecture:
 * - Token Chamber: Collects decayed tokens for redistribution
 * - USDC Chamber: Maintains liquidity for healthcare settlements
 * - Priority queue for healthcare claims
 * - Triple-coverage solvency requirements
 */
contract ReservoirContract is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant MAX_PRIORITY_SCORE = 10;
    uint256 private constant HEALTHCARE_RESERVE_RATIO = 40; // 40% of deposits
    uint256 private constant MONTHLY_COVERAGE_MONTHS = 3;
    uint256 private constant ANNUAL_REVENUE_RATIO = 22; // 22% of annual revenue
    
    // Roles
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    // Token species tracking
    struct TokenBalance {
        uint256 collected;    // Total collected from decay
        uint256 distributed;  // Total distributed as rewards
        uint256 current;      // Current balance
    }
    
    // Healthcare claim structure
    struct HealthcareClaim {
        address claimant;
        uint256 amount;
        uint8 urgencyScore;      // 1-10 scale
        uint256 timestamp;
        string claimType;        // prescription, procedure, preventive, emergency
        bytes32 verificationHash;
        bool processed;
    }
    
    // State variables
    IAutophageToken public autophageToken;
    IERC20 public usdc;
    
    // Token chamber
    mapping(uint8 => TokenBalance) public tokenChamber;
    
    // USDC chamber
    uint256 public usdcBalance;
    uint256 public totalDeposits;
    uint256 public monthlyHealthcareSpending;
    uint256 public annualRevenue;
    
    // Healthcare claims
    mapping(uint256 => HealthcareClaim) public claims;
    uint256 public nextClaimId;
    uint256[] public pendingClaimIds;
    
    // Solvency tracking
    uint256 public lastSolvencyCheck;
    uint256[30] public dailyHealthcareSpending; // Rolling 30-day window
    uint8 public currentDayIndex;
    
    // Events
    event TokensCollected(uint8 indexed species, uint256 amount);
    event TokensDistributed(uint8 indexed species, address indexed recipient, uint256 amount);
    event HealthcareClaimSubmitted(uint256 indexed claimId, address indexed claimant, uint256 amount);
    event HealthcareClaimProcessed(uint256 indexed claimId, uint256 amount);
    event USDCDeposited(address indexed depositor, uint256 amount);
    event SolvencyWarning(uint256 required, uint256 available);
    event MetabolicPriceUpdate(uint256 newPrice);
    
    constructor(address _token, address _usdc) {
        autophageToken = IAutophageToken(_token);
        usdc = IERC20(_usdc);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
    }
    
    /**
     * @notice Collect decayed tokens from users
     * @dev Called periodically to sweep decayed value into the Reservoir
     */
    function collectDecayedTokens(
        address[] calldata users,
        uint8[] calldata species
    ) external onlyRole(ORACLE_ROLE) {
        require(users.length == species.length, "Array mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            uint256 decayAmount = autophageToken.calculateDecayAmount(users[i], species[i]);
            
            if (decayAmount > 0) {
                // Update user balance to apply decay
                autophageToken.applyDecay(users[i], species[i]);
                
                // Track collected tokens
                tokenChamber[species[i]].collected += decayAmount;
                tokenChamber[species[i]].current += decayAmount;
                
                emit TokensCollected(species[i], decayAmount);
            }
        }
    }
    
    /**
     * @notice Submit healthcare claim for settlement
     * @dev Claims are processed based on priority score
     */
    function submitHealthcareClaim(
        uint256 amount,
        uint8 urgencyScore,
        string calldata claimType,
        bytes32 verificationHash
    ) external nonReentrant returns (uint256 claimId) {
        require(amount > 0, "Invalid amount");
        require(urgencyScore >= 1 && urgencyScore <= 10, "Invalid urgency");
        require(bytes(claimType).length > 0, "Invalid claim type");
        
        claimId = nextClaimId++;
        
        claims[claimId] = HealthcareClaim({
            claimant: msg.sender,
            amount: amount,
            urgencyScore: urgencyScore,
            timestamp: block.timestamp,
            claimType: claimType,
            verificationHash: verificationHash,
            processed: false
        });
        
        // Add to priority queue
        _insertIntoPriorityQueue(claimId);
        
        emit HealthcareClaimSubmitted(claimId, msg.sender, amount);
        
        // Process claims if funds available
        _processClaimsQueue();
        
        return claimId;
    }
    
    /**
     * @notice Process pending healthcare claims
     * @dev Processes claims in priority order until funds exhausted
     */
    function processHealthcareClaims(uint256 maxClaims) 
        external 
        onlyRole(SETTLEMENT_ROLE) 
    {
        uint256 processed = 0;
        
        while (processed < maxClaims && pendingClaimIds.length > 0 && _hasSufficientReserves()) {
            uint256 claimId = _getHighestPriorityClaim();
            HealthcareClaim storage claim = claims[claimId];
            
            if (!claim.processed && usdcBalance >= claim.amount) {
                // Process the claim
                claim.processed = true;
                usdcBalance -= claim.amount;
                
                // Track spending
                _updateHealthcareSpending(claim.amount);
                
                // Transfer USDC to claimant
                usdc.safeTransfer(claim.claimant, claim.amount);
                
                emit HealthcareClaimProcessed(claimId, claim.amount);
                processed++;
            }
            
            // Remove from queue
            _removeFromPriorityQueue(claimId);
        }
        
        // Check solvency after processing
        _checkSolvency();
    }
    
    /**
     * @notice Distribute tokens as activity rewards
     * @dev Called by verification engine after activity validation
     */
    function distributeReward(
        address recipient,
        uint8 species,
        uint256 amount
    ) external onlyRole(ORACLE_ROLE) {
        require(tokenChamber[species].current >= amount, "Insufficient tokens");
        
        tokenChamber[species].current -= amount;
        tokenChamber[species].distributed += amount;
        
        // Mint tokens to recipient (Reservoir has minting privileges)
        autophageToken.mint(recipient, species, amount);
        
        emit TokensDistributed(species, recipient, amount);
    }
    
    /**
     * @notice Deposit USDC for healthcare settlements
     * @dev Marketplace fees and other revenue streams deposit here
     */
    function depositUSDC(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdcBalance += amount;
        totalDeposits += amount;
        
        emit USDCDeposited(msg.sender, amount);
        
        // Process any pending claims
        _processClaimsQueue();
    }
    
    /**
     * @notice Calculate metabolic price based on system activity
     * @dev Implements endogenous pricing from litepaper Section 5
     */
    function calculateMetabolicPrice() external view returns (uint256) {
        uint256 totalEnergy = _calculateTotalHealthEnergy();
        uint256 marketVolume = _get30DayMarketVolume();
        uint256 activeSupply = _getActiveTokenSupply();
        uint256 velocity = _calculateTokenVelocity();
        uint256 catalystRatio = _getCatalystRatio();
        
        // Price formula from litepaper
        uint256 energyComponent = (totalEnergy * (PRECISION + 2 * catalystRatio)) / PRECISION;
        uint256 marketComponent = (marketVolume * (PRECISION - catalystRatio)) / PRECISION;
        
        uint256 numerator = energyComponent + marketComponent;
        uint256 denominator = activeSupply * velocity * (PRECISION + _getActivityMultiplier()) / PRECISION;
        
        uint256 price = (numerator * PRECISION) / denominator;
        
        return price;
    }
    
    /**
     * @notice Get reservoir statistics
     * @dev Returns comprehensive state for monitoring
     */
    function getReservoirStats() external view returns (
        uint256[4] memory tokenBalances,
        uint256 usdcReserve,
        uint256 pendingClaims,
        uint256 monthlySpending,
        bool isSolvent
    ) {
        tokenBalances = [
            tokenChamber[0].current, // Rhythm
            tokenChamber[1].current, // Healing
            tokenChamber[2].current, // Foundation
            tokenChamber[3].current  // Catalyst
        ];
        
        usdcReserve = usdcBalance;
        pendingClaims = pendingClaimIds.length;
        monthlySpending = monthlyHealthcareSpending;
        isSolvent = _checkSolvencyStatus();
        
        return (tokenBalances, usdcReserve, pendingClaims, monthlySpending, isSolvent);
    }
    
    // Internal functions
    
    function _insertIntoPriorityQueue(uint256 claimId) internal {
        pendingClaimIds.push(claimId);
        
        // Bubble up based on priority
        uint256 index = pendingClaimIds.length - 1;
        while (index > 0) {
            uint256 parentIndex = (index - 1) / 2;
            if (_getClaimPriority(pendingClaimIds[index]) > _getClaimPriority(pendingClaimIds[parentIndex])) {
                (pendingClaimIds[index], pendingClaimIds[parentIndex]) = 
                    (pendingClaimIds[parentIndex], pendingClaimIds[index]);
                index = parentIndex;
            } else {
                break;
            }
        }
    }
    
    function _getHighestPriorityClaim() internal view returns (uint256) {
        require(pendingClaimIds.length > 0, "No pending claims");
        return pendingClaimIds[0];
    }
    
    function _removeFromPriorityQueue(uint256 claimId) internal {
        // Find and remove the claim
        for (uint256 i = 0; i < pendingClaimIds.length; i++) {
            if (pendingClaimIds[i] == claimId) {
                pendingClaimIds[i] = pendingClaimIds[pendingClaimIds.length - 1];
                pendingClaimIds.pop();
                
                // Re-heapify if needed
                if (i < pendingClaimIds.length) {
                    _heapifyDown(i);
                }
                break;
            }
        }
    }
    
    function _heapifyDown(uint256 index) internal {
        uint256 length = pendingClaimIds.length;
        while (true) {
            uint256 leftChild = 2 * index + 1;
            uint256 rightChild = 2 * index + 2;
            uint256 largest = index;
            
            if (leftChild < length && 
                _getClaimPriority(pendingClaimIds[leftChild]) > _getClaimPriority(pendingClaimIds[largest])) {
                largest = leftChild;
            }
            
            if (rightChild < length && 
                _getClaimPriority(pendingClaimIds[rightChild]) > _getClaimPriority(pendingClaimIds[largest])) {
                largest = rightChild;
            }
            
            if (largest != index) {
                (pendingClaimIds[index], pendingClaimIds[largest]) = 
                    (pendingClaimIds[largest], pendingClaimIds[index]);
                index = largest;
            } else {
                break;
            }
        }
    }
    
    function _getClaimPriority(uint256 claimId) internal view returns (uint256) {
        HealthcareClaim memory claim = claims[claimId];
        
        // Priority formula: urgency * 0.7 + duration * 0.2 + verification * 0.1
        uint256 urgencyComponent = claim.urgencyScore * 70;
        uint256 durationComponent = ((block.timestamp - claim.timestamp) / 3600) * 2; // Hours waiting
        uint256 verificationComponent = claim.verificationHash != bytes32(0) ? 10 : 0;
        
        return urgencyComponent + durationComponent + verificationComponent;
    }
    
    function _updateHealthcareSpending(uint256 amount) internal {
        // Update rolling 30-day window
        uint256 todayIndex = (block.timestamp / 86400) % 30;
        
        if (todayIndex != currentDayIndex) {
            // New day, reset today's spending
            dailyHealthcareSpending[todayIndex] = 0;
            currentDayIndex = uint8(todayIndex);
        }
        
        dailyHealthcareSpending[todayIndex] += amount;
        
        // Recalculate monthly spending
        monthlyHealthcareSpending = 0;
        for (uint256 i = 0; i < 30; i++) {
            monthlyHealthcareSpending += dailyHealthcareSpending[i];
        }
    }
    
    function _checkSolvency() internal {
        if (!_checkSolvencyStatus()) {
            emit SolvencyWarning(_getRequiredReserves(), usdcBalance);
        }
    }
    
    function _checkSolvencyStatus() internal view returns (bool) {
        return usdcBalance >= _getRequiredReserves();
    }
    
    function _getRequiredReserves() internal view returns (uint256) {
        // Triple-coverage requirement from litepaper
        uint256 depositCoverage = (totalDeposits * HEALTHCARE_RESERVE_RATIO) / 100;
        uint256 monthlyCoverage = monthlyHealthcareSpending * MONTHLY_COVERAGE_MONTHS;
        uint256 annualCoverage = (annualRevenue * ANNUAL_REVENUE_RATIO) / 100;
        
        // Return maximum of three requirements
        uint256 required = depositCoverage;
        if (monthlyCoverage > required) required = monthlyCoverage;
        if (annualCoverage > required) required = annualCoverage;
        
        return required;
    }
    
    function _hasSufficientReserves() internal view returns (bool) {
        // Must maintain minimum reserves after processing claims
        return usdcBalance > _getRequiredReserves();
    }
    
    function _processClaimsQueue() internal {
        // Process up to 10 claims automatically
        uint256 processed = 0;
        while (processed < 10 && pendingClaimIds.length > 0 && _hasSufficientReserves()) {
            uint256 claimId = _getHighestPriorityClaim();
            HealthcareClaim storage claim = claims[claimId];
            
            if (!claim.processed && usdcBalance >= claim.amount + _getRequiredReserves()) {
                claim.processed = true;
                usdcBalance -= claim.amount;
                _updateHealthcareSpending(claim.amount);
                usdc.safeTransfer(claim.claimant, claim.amount);
                emit HealthcareClaimProcessed(claimId, claim.amount);
                processed++;
            }
            
            _removeFromPriorityQueue(claimId);
        }
    }
    
    // Placeholder functions for price calculation (would connect to oracles)
    
    function _calculateTotalHealthEnergy() internal view returns (uint256) {
        // Placeholder: would aggregate from activity oracles
        return 500000 * 2; // 500k kcal * $0.002
    }
    
    function _get30DayMarketVolume() internal view returns (uint256) {
        // Placeholder: would track actual marketplace volume
        return 150000 * PRECISION;
    }
    
    function _getActiveTokenSupply() internal view returns (uint256) {
        // Placeholder: would calculate from token contract
        return 10000000 * PRECISION;
    }
    
    function _calculateTokenVelocity() internal view returns (uint256) {
        // Placeholder: would track actual velocity
        return 15 * PRECISION / 30; // 15x monthly
    }
    
    function _getCatalystRatio() internal view returns (uint256) {
        // Placeholder: would calculate actual ratio
        return 230000000000000000; // 0.23
    }
    
    function _getActivityMultiplier() internal view returns (uint256) {
        // Placeholder: would calculate from system activity
        return 400000000000000000; // 0.4
    }
    
    // Admin functions
    
    function updateAnnualRevenue(uint256 _revenue) external onlyRole(TREASURY_ROLE) {
        annualRevenue = _revenue;
    }
    
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(usdc) || usdcBalance - amount >= _getRequiredReserves(), 
                "Would break solvency");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}