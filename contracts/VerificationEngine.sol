// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IAutophageToken.sol";
import "./interfaces/IReservoir.sol";

/**
 * @title VerificationEngine
 * @notice Zero-knowledge proof verification and reward calculation engine
 * @dev Processes health activity proofs and mints appropriate tokens
 * 
 * Features:
 * - zkSNARK proof verification
 * - Multi-factor reward calculation
 * - Batch proof processing
 * - Privacy-preserving activity validation
 */
contract VerificationEngine is AccessControl, ReentrancyGuard, Pausable {
    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant MAX_BATCH_SIZE = 100;
    uint256 private constant MAX_MULTIPLIER = 20 * PRECISION;
    uint256 private constant MIN_MULTIPLIER = 3 * PRECISION / 10;
    
    // Roles
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant APP_ROLE = keccak256("APP_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Activity types
    enum ActivityType {
        EXERCISE,
        THERAPY,
        PREVENTIVE_CARE,
        MEDICATION,
        RECOVERY,
        NUTRITION,
        SOCIAL_WELLNESS
    }
    
    // Proof structure
    struct HealthProof {
        bytes32 activityHash;      // Hash of activity details
        uint8 activityType;        // ActivityType enum
        uint256 energyExpended;    // In kcal or kcal-equivalent
        uint256 timestamp;         // When activity occurred
        bytes32 profileId;         // Privacy-preserving user ID
        bytes proof;               // zkSNARK proof data
        bytes metadata;            // Optional encrypted metadata
    }
    
    // Multiplier components
    struct MultiplierFactors {
        uint256 streak;      // Consecutive days
        uint256 group;       // Group activity bonus
        uint256 time;        // Circadian rhythm
        uint256 genetic;     // User's genetic traits
        uint256 synergy;     // Multiple activity types
        uint256 quality;     // Performance quality
    }
    
    // Genetic traits
    struct GeneticTrait {
        string name;
        uint256 bonus;       // Percentage bonus (scaled by PRECISION)
        uint256 cost;        // Cost in Foundation tokens
        bool active;
    }
    
    // State variables
    IAutophageToken public autophageToken;
    IReservoir public reservoir;
    
    // Activity mappings
    mapping(ActivityType => uint8) public activityToSpecies;
    mapping(ActivityType => uint256) public baseRewards;
    mapping(bytes32 => uint256) public lastActivityTimestamp;
    mapping(bytes32 => uint256) public streakCount;
    mapping(bytes32 => mapping(uint8 => bool)) public dailyActivities;
    
    // Genetic system
    mapping(bytes32 => uint256) public geneticTraitCount;
    mapping(bytes32 => mapping(uint8 => GeneticTrait)) public userTraits;
    mapping(string => uint8) public traitNameToId;
    uint8 public nextTraitId;
    
    // Verification apps
    mapping(address => bool) public registeredApps;
    mapping(address => uint256) public appStakes;
    mapping(address => uint256) public appViolations;
    
    // Events
    event ProofVerified(
        bytes32 indexed profileId,
        uint8 indexed activityType,
        uint256 reward,
        uint256 multiplier
    );
    event BatchProofVerified(uint256 count, uint256 totalRewards);
    event GeneticTraitEvolved(bytes32 indexed profileId, string traitName, uint256 cost);
    event AppRegistered(address indexed app, uint256 stake);
    event AppSlashed(address indexed app, uint256 amount, string reason);
    
    constructor(address _token, address _reservoir) {
        autophageToken = IAutophageToken(_token);
        reservoir = IReservoir(_reservoir);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        // Initialize activity to species mapping
        activityToSpecies[ActivityType.EXERCISE] = 0; // Rhythm
        activityToSpecies[ActivityType.MEDICATION] = 0; // Rhythm
        activityToSpecies[ActivityType.THERAPY] = 1; // Healing
        activityToSpecies[ActivityType.RECOVERY] = 1; // Healing
        activityToSpecies[ActivityType.PREVENTIVE_CARE] = 2; // Foundation
        activityToSpecies[ActivityType.NUTRITION] = 2; // Foundation
        activityToSpecies[ActivityType.SOCIAL_WELLNESS] = 3; // Catalyst
        
        // Initialize base rewards
        baseRewards[ActivityType.EXERCISE] = 50 * PRECISION;
        baseRewards[ActivityType.THERAPY] = 80 * PRECISION;
        baseRewards[ActivityType.PREVENTIVE_CARE] = 100 * PRECISION;
        baseRewards[ActivityType.MEDICATION] = 30 * PRECISION;
        baseRewards[ActivityType.RECOVERY] = 40 * PRECISION;
        baseRewards[ActivityType.NUTRITION] = 20 * PRECISION;
        baseRewards[ActivityType.SOCIAL_WELLNESS] = 35 * PRECISION;
        
        // Initialize genetic traits
        _initializeGeneticTraits();
    }
    
    /**
     * @notice Verify health activity proof and mint rewards
     * @dev Main entry point for activity verification
     */
    function verifyAndMint(HealthProof calldata healthProof) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyRole(APP_ROLE)
        returns (uint256 reward)
    {
        // Verify the zkSNARK proof
        require(_verifyProof(healthProof), "Invalid proof");
        
        // Check for duplicate submission
        require(
            block.timestamp > lastActivityTimestamp[healthProof.profileId] + 3600,
            "Too soon since last activity"
        );
        
        // Calculate base reward
        uint256 baseReward = _calculateBaseReward(healthProof);
        
        // Calculate multipliers
        MultiplierFactors memory multipliers = _calculateMultipliers(healthProof);
        uint256 totalMultiplier = _getTotalMultiplier(multipliers);
        
        // Apply multiplier constraints
        totalMultiplier = _constrainMultiplier(totalMultiplier);
        
        // Calculate final reward
        reward = (baseReward * totalMultiplier) / PRECISION;
        
        // Update tracking
        _updateActivityTracking(healthProof);
        
        // Mint tokens
        uint8 species = activityToSpecies[ActivityType(healthProof.activityType)];
        autophageToken.mint(_getProfileAddress(healthProof.profileId), species, reward);
        
        emit ProofVerified(
            healthProof.profileId,
            healthProof.activityType,
            reward,
            totalMultiplier
        );
        
        return reward;
    }
    
    /**
     * @notice Batch verify multiple proofs for gas efficiency
     * @dev Processes up to MAX_BATCH_SIZE proofs in one transaction
     */
    function batchVerifyAndMint(HealthProof[] calldata proofs)
        external
        nonReentrant
        whenNotPaused
        onlyRole(APP_ROLE)
        returns (uint256 totalRewards)
    {
        require(proofs.length <= MAX_BATCH_SIZE, "Batch too large");
        require(proofs.length > 0, "Empty batch");
        
        for (uint256 i = 0; i < proofs.length; i++) {
            // Skip if proof invalid or duplicate
            if (!_verifyProof(proofs[i]) || 
                block.timestamp <= lastActivityTimestamp[proofs[i].profileId] + 3600) {
                continue;
            }
            
            uint256 reward = _processProof(proofs[i]);
            totalRewards += reward;
        }
        
        emit BatchProofVerified(proofs.length, totalRewards);
        return totalRewards;
    }
    
    /**
     * @notice Evolve genetic trait by burning Foundation tokens
     * @dev Users can acquire permanent multiplier bonuses
     */
    function evolveGeneticTrait(bytes32 profileId, string calldata traitName)
        external
        nonReentrant
        whenNotPaused
    {
        require(msg.sender == _getProfileAddress(profileId), "Not profile owner");
        
        uint8 traitId = traitNameToId[traitName];
        require(traitId > 0, "Invalid trait");
        
        GeneticTrait storage trait = userTraits[profileId][traitId];
        require(!trait.active, "Trait already active");
        require(geneticTraitCount[profileId] < 10, "Max traits reached");
        
        // Calculate cost with exponential scaling
        uint256 baseCost = 1000 * PRECISION;
        uint256 cost = baseCost * (25 ** geneticTraitCount[profileId]) / (10 ** geneticTraitCount[profileId]);
        
        // Burn Foundation tokens
        autophageToken.burn(msg.sender, 2, cost); // 2 = Foundation species
        
        // Activate trait
        trait.active = true;
        trait.cost = cost;
        geneticTraitCount[profileId]++;
        
        emit GeneticTraitEvolved(profileId, traitName, cost);
    }
    
    /**
     * @notice Register verification app with stake
     * @dev Apps must stake USDC to participate
     */
    function registerApp(uint256 stakeAmount) external nonReentrant {
        require(stakeAmount >= 10000 * PRECISION, "Insufficient stake");
        require(!registeredApps[msg.sender], "Already registered");
        
        // Transfer stake
        reservoir.receiveStake(msg.sender, stakeAmount);
        
        registeredApps[msg.sender] = true;
        appStakes[msg.sender] = stakeAmount;
        
        _grantRole(APP_ROLE, msg.sender);
        
        emit AppRegistered(msg.sender, stakeAmount);
    }
    
    /**
     * @notice Slash app stake for violations
     * @dev Progressive slashing for false attestations
     */
    function slashApp(address app, string calldata reason)
        external
        onlyRole(ORACLE_ROLE)
    {
        require(registeredApps[app], "App not registered");
        
        appViolations[app]++;
        uint256 slashAmount = _calculateSlashAmount(app);
        
        if (slashAmount >= appStakes[app]) {
            // Fully slash and remove app
            reservoir.slashStake(app, appStakes[app]);
            registeredApps[app] = false;
            appStakes[app] = 0;
            _revokeRole(APP_ROLE, app);
        } else {
            // Partial slash
            reservoir.slashStake(app, slashAmount);
            appStakes[app] -= slashAmount;
        }
        
        emit AppSlashed(app, slashAmount, reason);
    }
    
    // Internal functions
    
    function _verifyProof(HealthProof calldata healthProof) internal view returns (bool) {
        // In production, this would call a zkSNARK verifier contract
        // For now, basic validation
        return healthProof.proof.length > 0 && 
               healthProof.activityHash != bytes32(0) &&
               healthProof.timestamp < block.timestamp &&
               healthProof.timestamp > block.timestamp - 86400; // Within 24 hours
    }
    
    function _calculateBaseReward(HealthProof calldata healthProof) 
        internal 
        view 
        returns (uint256) 
    {
        uint256 activityReward = baseRewards[ActivityType(healthProof.activityType)];
        
        // Adjust for energy expended
        if (healthProof.energyExpended > 0) {
            uint256 energyMultiplier = (healthProof.energyExpended * PRECISION) / 100; // Per 100 kcal
            activityReward = (activityReward * energyMultiplier) / PRECISION;
        }
        
        return activityReward;
    }
    
    function _calculateMultipliers(HealthProof calldata healthProof) 
        internal 
        view 
        returns (MultiplierFactors memory) 
    {
        MultiplierFactors memory factors;
        
        // Streak multiplier (logarithmic)
        uint256 streak = streakCount[healthProof.profileId];
        if (streak > 0) {
            factors.streak = PRECISION + (PRECISION * _log10(streak + 1)) / 10;
        } else {
            factors.streak = PRECISION;
        }
        
        // Time multiplier (circadian rhythm)
        uint256 hour = (healthProof.timestamp % 86400) / 3600;
        factors.time = _getCircadianMultiplier(hour);
        
        // Genetic multiplier
        factors.genetic = _getGeneticMultiplier(healthProof.profileId);
        
        // Group activity (from metadata)
        if (healthProof.metadata.length > 0) {
            // Parse metadata for group size
            factors.group = PRECISION + (PRECISION * 5) / 10; // 1.5x for group
        } else {
            factors.group = PRECISION;
        }
        
        // Synergy bonus for multiple daily activities
        uint256 activityCount = _getDailyActivityCount(healthProof.profileId);
        if (activityCount > 1) {
            factors.synergy = PRECISION + (PRECISION * activityCount) / 10;
        } else {
            factors.synergy = PRECISION;
        }
        
        // Quality based on energy/duration ratio
        factors.quality = PRECISION; // Simplified for now
        
        return factors;
    }
    
    function _getTotalMultiplier(MultiplierFactors memory factors) 
        internal 
        pure 
        returns (uint256) 
    {
        uint256 multiplier = PRECISION;
        
        multiplier = (multiplier * factors.streak) / PRECISION;
        multiplier = (multiplier * factors.group) / PRECISION;
        multiplier = (multiplier * factors.time) / PRECISION;
        multiplier = (multiplier * factors.genetic) / PRECISION;
        multiplier = (multiplier * factors.synergy) / PRECISION;
        multiplier = (multiplier * factors.quality) / PRECISION;
        
        return multiplier;
    }
    
    function _constrainMultiplier(uint256 multiplier) internal pure returns (uint256) {
        if (multiplier > MAX_MULTIPLIER) return MAX_MULTIPLIER;
        if (multiplier < MIN_MULTIPLIER) return MIN_MULTIPLIER;
        return multiplier;
    }
    
    function _getCircadianMultiplier(uint256 hour) internal pure returns (uint256) {
        // Peak at 6 AM, trough at 6 PM
        // Using approximation: 1 + 0.3 * sin((hour - 6) * pi / 12)
        
        if (hour >= 4 && hour <= 8) {
            return 13 * PRECISION / 10; // 1.3x morning peak
        } else if (hour >= 16 && hour <= 20) {
            return 7 * PRECISION / 10; // 0.7x evening trough
        } else {
            return PRECISION; // 1x baseline
        }
    }
    
    function _getGeneticMultiplier(bytes32 profileId) internal view returns (uint256) {
        uint256 multiplier = PRECISION;
        uint256 traitCount = geneticTraitCount[profileId];
        
        if (traitCount == 0) return multiplier;
        
        // Apply traits with diminishing returns
        for (uint8 i = 1; i <= nextTraitId; i++) {
            if (userTraits[profileId][i].active) {
                uint256 bonus = userTraits[profileId][i].bonus;
                uint256 diminishing = (PRECISION - (PRECISION * (i - 1)) / 10);
                multiplier += (bonus * diminishing) / PRECISION;
            }
        }
        
        // Cap at 1.5x
        if (multiplier > 15 * PRECISION / 10) {
            multiplier = 15 * PRECISION / 10;
        }
        
        return multiplier;
    }
    
    function _updateActivityTracking(HealthProof calldata healthProof) internal {
        bytes32 profileId = healthProof.profileId;
        uint256 today = block.timestamp / 86400;
        uint256 lastDay = lastActivityTimestamp[profileId] / 86400;
        
        // Update streak
        if (today == lastDay + 1) {
            streakCount[profileId]++;
        } else if (today != lastDay) {
            streakCount[profileId] = 1;
        }
        
        // Track daily activities
        dailyActivities[profileId][healthProof.activityType] = true;
        lastActivityTimestamp[profileId] = block.timestamp;
    }
    
    function _getDailyActivityCount(bytes32 profileId) internal view returns (uint256) {
        uint256 count = 0;
        for (uint8 i = 0; i < 7; i++) {
            if (dailyActivities[profileId][i]) count++;
        }
        return count;
    }
    
    function _processProof(HealthProof calldata proof) internal returns (uint256) {
        uint256 baseReward = _calculateBaseReward(proof);
        MultiplierFactors memory multipliers = _calculateMultipliers(proof);
        uint256 totalMultiplier = _constrainMultiplier(_getTotalMultiplier(multipliers));
        uint256 reward = (baseReward * totalMultiplier) / PRECISION;
        
        _updateActivityTracking(proof);
        
        uint8 species = activityToSpecies[ActivityType(proof.activityType)];
        autophageToken.mint(_getProfileAddress(proof.profileId), species, reward);
        
        emit ProofVerified(proof.profileId, proof.activityType, reward, totalMultiplier);
        
        return reward;
    }
    
    function _getProfileAddress(bytes32 profileId) internal pure returns (address) {
        // In production, would map profileId to address through privacy layer
        return address(uint160(uint256(profileId)));
    }
    
    function _calculateSlashAmount(address app) internal view returns (uint256) {
        uint256 violations = appViolations[app];
        uint256 baseSlash = appStakes[app] / 10; // 10% base
        
        // Progressive slashing: 10%, 25%, 50%, 100%
        if (violations >= 4) return appStakes[app];
        if (violations == 3) return appStakes[app] / 2;
        if (violations == 2) return appStakes[app] / 4;
        return baseSlash;
    }
    
    function _log10(uint256 x) internal pure returns (uint256) {
        // Simple log10 approximation
        if (x >= 1000000) return 6;
        if (x >= 100000) return 5;
        if (x >= 10000) return 4;
        if (x >= 1000) return 3;
        if (x >= 100) return 2;
        if (x >= 10) return 1;
        return 0;
    }
    
    function _initializeGeneticTraits() internal {
        _addTrait("Early Bird", 12); // 12% bonus
        _addTrait("Night Owl", 12);
        _addTrait("Streak Master", 10);
        _addTrait("Group Fitness", 8);
        _addTrait("Endurance Elite", 15);
        _addTrait("Recovery Expert", 10);
        _addTrait("Mental Resilience", 12);
        _addTrait("Nutrition Optimizer", 8);
        _addTrait("Social Butterfly", 10);
        _addTrait("Consistency King", 15);
    }
    
    function _addTrait(string memory name, uint256 bonusPercent) internal {
        nextTraitId++;
        traitNameToId[name] = nextTraitId;
        // Store template, users will get copies
    }
    
    // Admin functions
    
    function updateBaseReward(ActivityType activityType, uint256 newReward) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        baseRewards[activityType] = newReward;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}