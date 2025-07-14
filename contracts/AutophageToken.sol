// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title AutophageToken
 * @notice Multi-species token contract implementing lazy decay evaluation
 * @dev Core token contract for the Autophage Protocol with four token species
 * 
 * Token Species:
 * - Rhythm (0): 5% daily decay for exercise/medication
 * - Healing (1): 0.75% daily decay for therapy/recovery
 * - Foundation (2): 0.1% daily decay for preventive care
 * - Catalyst (3): 2-10% dynamic decay for marketplace balance
 */
contract AutophageToken is AccessControl, ReentrancyGuard, Pausable {
    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant SECONDS_PER_DAY = 86400;
    uint256 private constant MAX_SPECIES = 4;
    
    // Token species identifiers
    uint8 public constant RHYTHM = 0;
    uint8 public constant HEALING = 1;
    uint8 public constant FOUNDATION = 2;
    uint8 public constant CATALYST = 3;
    
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant RESERVOIR_ROLE = keccak256("RESERVOIR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Packed struct for efficient storage (uses single storage slot)
    struct Balance {
        uint128 amount;      // Token balance
        uint64 lastUpdate;   // Timestamp of last update
        uint64 lockedUntil;  // For wellness vault functionality
    }
    
    // State variables
    mapping(address => mapping(uint8 => Balance)) private balances;
    mapping(uint8 => uint256) public decayRates; // Daily decay rates (scaled by PRECISION)
    mapping(uint8 => uint256) public totalSupply; // Total supply per species
    
    // Whale protection thresholds
    mapping(uint8 => uint256[]) public whaleThresholds;
    mapping(uint8 => uint256[]) public whaleMultipliers;
    
    // Events
    event Transfer(
        address indexed from,
        address indexed to,
        uint8 indexed species,
        uint256 amount,
        uint256 decayAmount
    );
    event Mint(address indexed to, uint8 indexed species, uint256 amount);
    event DecayApplied(address indexed user, uint8 indexed species, uint256 amount);
    event VaultLocked(address indexed user, uint8 indexed species, uint256 amount, uint256 lockDuration);
    event DecayRateUpdated(uint8 indexed species, uint256 oldRate, uint256 newRate);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        // Initialize decay rates from the litepaper
        decayRates[RHYTHM] = 50000000000000000; // 5% = 0.05 * 1e18
        decayRates[HEALING] = 7500000000000000; // 0.75% = 0.0075 * 1e18
        decayRates[FOUNDATION] = 1000000000000000; // 0.1% = 0.001 * 1e18
        decayRates[CATALYST] = 50000000000000000; // 5% default, dynamic in practice
        
        // Initialize whale protection for Rhythm tokens
        whaleThresholds[RHYTHM] = [10000 * PRECISION, 50000 * PRECISION, 100000 * PRECISION];
        whaleMultipliers[RHYTHM] = [PRECISION, 1500000000000000000, 2000000000000000000, 3000000000000000000]; // 1x, 1.5x, 2x, 3x
    }
    
    /**
     * @notice Get balance with lazy decay calculation
     * @dev Only calculates decay when balance is accessed
     * @param user Address of the user
     * @param species Token species ID (0-3)
     * @return Current balance after decay
     */
    function balanceOf(address user, uint8 species) public view returns (uint256) {
        require(species < MAX_SPECIES, "Invalid species");
        
        Balance memory bal = balances[user][species];
        if (bal.amount == 0) return 0;
        
        // If locked in wellness vault, use reduced decay
        if (bal.lockedUntil > block.timestamp) {
            return _calculateVaultBalance(bal, species);
        }
        
        uint256 timePassed = block.timestamp - bal.lastUpdate;
        uint256 daysPassed = timePassed / SECONDS_PER_DAY;
        
        if (daysPassed == 0) return bal.amount;
        
        // Apply decay with whale protection
        uint256 effectiveDecayRate = _getEffectiveDecayRate(user, species, bal.amount);
        uint256 decayedBalance = _applyDecay(bal.amount, effectiveDecayRate, daysPassed);
        
        return decayedBalance;
    }
    
    /**
     * @notice Transfer tokens with automatic decay application
     * @dev Updates balances lazily to save gas
     */
    function transfer(address to, uint8 species, uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bool) 
    {
        require(to != address(0), "Invalid recipient");
        require(species < MAX_SPECIES, "Invalid species");
        
        // Apply decay and get current balance
        uint256 senderBalance = _updateBalance(msg.sender, species);
        require(senderBalance >= amount, "Insufficient balance");
        
        // Check if tokens are locked
        require(balances[msg.sender][species].lockedUntil <= block.timestamp, "Tokens locked in vault");
        
        // Update sender balance
        balances[msg.sender][species].amount = uint128(senderBalance - amount);
        balances[msg.sender][species].lastUpdate = uint64(block.timestamp);
        
        // Update recipient balance
        uint256 recipientBalance = _updateBalance(to, species);
        balances[to][species].amount = uint128(recipientBalance + amount);
        balances[to][species].lastUpdate = uint64(block.timestamp);
        
        // Calculate decay amount for event
        uint256 decayAmount = _calculateDecayAmount(msg.sender, species);
        
        emit Transfer(msg.sender, to, species, amount, decayAmount);
        return true;
    }
    
    /**
     * @notice Mint new tokens (restricted to authorized minters)
     * @dev Called by verification engine after proof validation
     */
    function mint(address to, uint8 species, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
    {
        require(to != address(0), "Invalid recipient");
        require(species < MAX_SPECIES, "Invalid species");
        require(amount > 0, "Amount must be positive");
        
        uint256 currentBalance = _updateBalance(to, species);
        balances[to][species].amount = uint128(currentBalance + amount);
        balances[to][species].lastUpdate = uint64(block.timestamp);
        
        totalSupply[species] += amount;
        
        emit Mint(to, species, amount);
    }
    
    /**
     * @notice Lock tokens in wellness vault for reduced decay
     * @dev Implements time-locked savings with configurable decay reduction
     */
    function lockInVault(uint8 species, uint256 amount, uint256 lockDays) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(species < MAX_SPECIES, "Invalid species");
        require(lockDays >= 30 && lockDays <= 365, "Lock period must be 30-365 days");
        require(amount > 0, "Amount must be positive");
        
        uint256 currentBalance = _updateBalance(msg.sender, species);
        require(currentBalance >= amount, "Insufficient balance");
        require(balances[msg.sender][species].lockedUntil <= block.timestamp, "Already locked");
        
        uint256 lockDuration = lockDays * SECONDS_PER_DAY;
        balances[msg.sender][species].lockedUntil = uint64(block.timestamp + lockDuration);
        
        emit VaultLocked(msg.sender, species, amount, lockDuration);
    }
    
    /**
     * @notice Collect decayed tokens for the Reservoir
     * @dev Called periodically by Reservoir contract
     */
    function collectDecay(address[] calldata users, uint8[] calldata species) 
        external 
        onlyRole(RESERVOIR_ROLE) 
        returns (uint256 totalDecayed) 
    {
        require(users.length == species.length, "Array length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            uint256 decayAmount = _calculateDecayAmount(users[i], species[i]);
            if (decayAmount > 0) {
                _updateBalance(users[i], species[i]);
                totalDecayed += decayAmount;
            }
        }
        
        return totalDecayed;
    }
    
    /**
     * @notice Update decay rate for dynamic adjustment (Catalyst tokens)
     * @dev Only callable by governance after on-chain experiment validation
     */
    function updateDecayRate(uint8 species, uint256 newRate) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
    {
        require(species < MAX_SPECIES, "Invalid species");
        require(newRate <= 100000000000000000, "Rate too high"); // Max 10%
        
        uint256 oldRate = decayRates[species];
        decayRates[species] = newRate;
        
        emit DecayRateUpdated(species, oldRate, newRate);
    }
    
    /**
     * @notice Get all balances for a user
     * @dev Convenience function for UI
     */
    function getAllBalances(address user) external view returns (uint256[4] memory) {
        return [
            balanceOf(user, RHYTHM),
            balanceOf(user, HEALING),
            balanceOf(user, FOUNDATION),
            balanceOf(user, CATALYST)
        ];
    }
    
    // Internal functions
    
    function _updateBalance(address user, uint8 species) internal returns (uint256) {
        Balance storage bal = balances[user][species];
        
        if (bal.amount == 0) {
            bal.lastUpdate = uint64(block.timestamp);
            return 0;
        }
        
        uint256 currentBalance = balanceOf(user, species);
        uint256 decayAmount = bal.amount - currentBalance;
        
        if (decayAmount > 0) {
            emit DecayApplied(user, species, decayAmount);
            // Decayed tokens would be tracked for Reservoir collection
        }
        
        bal.amount = uint128(currentBalance);
        bal.lastUpdate = uint64(block.timestamp);
        
        return currentBalance;
    }
    
    function _calculateDecayAmount(address user, uint8 species) internal view returns (uint256) {
        Balance memory bal = balances[user][species];
        if (bal.amount == 0) return 0;
        
        uint256 currentBalance = balanceOf(user, species);
        return bal.amount > currentBalance ? bal.amount - currentBalance : 0;
    }
    
    function _applyDecay(uint256 balance, uint256 dailyDecayRate, uint256 daysPassed) 
        internal 
        pure 
        returns (uint256) 
    {
        if (daysPassed == 0 || dailyDecayRate == 0) return balance;
        
        // Calculate (1 - decayRate)^daysPassed
        uint256 retentionRate = PRECISION - dailyDecayRate;
        uint256 decayFactor = _pow(retentionRate, daysPassed, PRECISION);
        
        return (balance * decayFactor) / _pow(PRECISION, daysPassed, PRECISION);
    }
    
    function _getEffectiveDecayRate(address user, uint8 species, uint256 balance) 
        internal 
        view 
        returns (uint256) 
    {
        if (species != RHYTHM || whaleThresholds[species].length == 0) {
            return decayRates[species];
        }
        
        // Apply progressive whale protection
        uint256[] memory thresholds = whaleThresholds[species];
        uint256[] memory multipliers = whaleMultipliers[species];
        
        for (uint256 i = thresholds.length; i > 0; i--) {
            if (balance >= thresholds[i - 1]) {
                return (decayRates[species] * multipliers[i]) / PRECISION;
            }
        }
        
        return decayRates[species];
    }
    
    function _calculateVaultBalance(Balance memory bal, uint8 species) 
        internal 
        view 
        returns (uint256) 
    {
        uint256 lockDuration = bal.lockedUntil - bal.lastUpdate;
        uint256 lockDays = lockDuration / SECONDS_PER_DAY;
        
        // Calculate decay reduction based on lock duration
        uint256 reductionFactor = _getVaultReductionFactor(lockDays);
        uint256 reducedDecayRate = (decayRates[species] * (PRECISION - reductionFactor)) / PRECISION;
        
        uint256 timePassed = block.timestamp - bal.lastUpdate;
        uint256 daysPassed = timePassed / SECONDS_PER_DAY;
        
        return _applyDecay(bal.amount, reducedDecayRate, daysPassed);
    }
    
    function _getVaultReductionFactor(uint256 lockDays) internal pure returns (uint256) {
        if (lockDays >= 365) return 900000000000000000; // 90% reduction
        if (lockDays >= 180) return 450000000000000000; // 45% reduction
        if (lockDays >= 90) return 270000000000000000;  // 27% reduction
        return 90000000000000000; // 9% reduction for 30 days
    }
    
    /**
     * @dev Efficient power function for decay calculations
     */
    function _pow(uint256 base, uint256 exponent, uint256 precision) 
        internal 
        pure 
        returns (uint256) 
    {
        if (exponent == 0) return precision;
        if (exponent == 1) return base;
        
        uint256 result = precision;
        uint256 currentBase = base;
        
        while (exponent > 0) {
            if (exponent & 1 == 1) {
                result = (result * currentBase) / precision;
            }
            currentBase = (currentBase * currentBase) / precision;
            exponent >>= 1;
        }
        
        return result;
    }
    
    // Emergency functions
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}