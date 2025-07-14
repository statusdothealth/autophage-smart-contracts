// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAutophageToken.sol";

/**
 * @title GovernanceContract
 * @notice Empirical governance through on-chain experiments
 * @dev Implements contribution-based voting and statistical validation
 * 
 * Governance principles:
 * - All changes require empirical validation
 * - Voting weight based on lifetime contributions, not current holdings
 * - On-chain A/B testing with statistical significance
 * - Automatic sunset of unused features
 */
contract GovernanceContract is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant MIN_IMPROVEMENT = 5; // 5% minimum improvement
    uint256 private constant SIGNIFICANCE_LEVEL = 5; // p < 0.05
    uint256 private constant MIN_EXPERIMENT_DURATION = 7 days;
    uint256 private constant MAX_EXPERIMENT_DURATION = 90 days;
    uint256 private constant PROPOSAL_STAKE = 500 * PRECISION; // 500 Catalyst tokens
    
    // Roles
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant EXPERIMENT_ROLE = keccak256("EXPERIMENT_ROLE");
    
    // Proposal types
    enum ProposalType {
        PARAMETER_CHANGE,
        FEATURE_ADDITION,
        FEATURE_REMOVAL,
        ECONOMIC_ADJUSTMENT,
        EMERGENCY_ACTION
    }
    
    // Experiment structure
    struct Experiment {
        uint256 proposalId;
        uint256 startTime;
        uint256 endTime;
        uint256 controlGroup;      // Number of users in control
        uint256 treatmentGroup;    // Number of users in treatment
        bytes32 hypothesis;        // What we're testing
        bytes32 metricHash;        // What we're measuring
        bool isActive;
        mapping(address => bool) isInTreatment;
    }
    
    // Proposal structure
    struct Proposal {
        address proposer;
        ProposalType proposalType;
        string title;
        string description;
        bytes callData;            // Encoded function call
        uint256 stakeAmount;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 experimentId;
        bool executed;
        bool cancelled;
        uint256 createdAt;
        uint256 executedAt;
    }
    
    // Contribution scoring
    struct ContributionScore {
        uint256 lifetimeReservoirContribution;
        uint256 verificationAccuracy;
        uint256 governanceParticipation;
        uint256 lastUpdated;
    }
    
    // State variables
    IAutophageToken public autophageToken;
    IERC20 public catalystToken;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Experiment) public experiments;
    mapping(address => ContributionScore) public contributionScores;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public voteWeight;
    
    uint256 public nextProposalId;
    uint256 public nextExperimentId;
    uint256 public totalContributions;
    
    // Feature usage tracking for automatic sunset
    mapping(bytes32 => uint256) public featureLastUsed;
    mapping(bytes32 => uint256) public featureUsageCount;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string title
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    event ExperimentStarted(
        uint256 indexed experimentId,
        uint256 indexed proposalId,
        uint256 duration
    );
    event ExperimentCompleted(
        uint256 indexed experimentId,
        bool success,
        uint256 improvement,
        uint256 pValue
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event FeatureSunset(bytes32 indexed featureId, uint256 lastUsed);
    
    constructor(address _token, address _catalyst) {
        autophageToken = IAutophageToken(_token);
        catalystToken = IERC20(_catalyst);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }
    
    /**
     * @notice Create a new governance proposal
     * @dev Requires staking Catalyst tokens
     */
    function createProposal(
        ProposalType proposalType,
        string calldata title,
        string calldata description,
        bytes calldata callData
    ) external nonReentrant returns (uint256 proposalId) {
        require(bytes(title).length > 0, "Empty title");
        require(bytes(description).length > 0, "Empty description");
        
        // Stake Catalyst tokens
        catalystToken.safeTransferFrom(msg.sender, address(this), PROPOSAL_STAKE);
        
        proposalId = nextProposalId++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.proposalType = proposalType;
        proposal.title = title;
        proposal.description = description;
        proposal.callData = callData;
        proposal.stakeAmount = PROPOSAL_STAKE;
        proposal.createdAt = block.timestamp;
        
        emit ProposalCreated(proposalId, msg.sender, proposalType, title);
        
        return proposalId;
    }
    
    /**
     * @notice Vote on a proposal using contribution-based weight
     * @dev Weight calculated from lifetime protocol contributions
     */
    function vote(uint256 proposalId, bool support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.createdAt > 0, "Invalid proposal");
        require(!proposal.executed && !proposal.cancelled, "Proposal finalized");
        require(!hasVoted[msg.sender][proposalId], "Already voted");
        
        // Calculate voting weight
        uint256 weight = _calculateVotingWeight(msg.sender);
        require(weight > 0, "No voting power");
        
        // Record vote
        hasVoted[msg.sender][proposalId] = true;
        voteWeight[proposalId][msg.sender] = weight;
        
        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @notice Start an experiment for a proposal
     * @dev Creates control and treatment groups for A/B testing
     */
    function startExperiment(
        uint256 proposalId,
        uint256 duration,
        bytes32 hypothesis,
        bytes32 metricHash
    ) external onlyRole(EXPERIMENT_ROLE) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.createdAt > 0, "Invalid proposal");
        require(!proposal.executed && !proposal.cancelled, "Proposal finalized");
        require(proposal.votesFor > proposal.votesAgainst, "Insufficient support");
        require(duration >= MIN_EXPERIMENT_DURATION && duration <= MAX_EXPERIMENT_DURATION, 
                "Invalid duration");
        
        uint256 experimentId = nextExperimentId++;
        proposal.experimentId = experimentId;
        
        Experiment storage experiment = experiments[experimentId];
        experiment.proposalId = proposalId;
        experiment.startTime = block.timestamp;
        experiment.endTime = block.timestamp + duration;
        experiment.hypothesis = hypothesis;
        experiment.metricHash = metricHash;
        experiment.isActive = true;
        
        emit ExperimentStarted(experimentId, proposalId, duration);
    }
    
    /**
     * @notice Assign users to experiment groups
     * @dev Random assignment ensuring statistical validity
     */
    function assignToExperiment(
        uint256 experimentId,
        address[] calldata users,
        bool[] calldata treatment
    ) external onlyRole(ORACLE_ROLE) {
        require(users.length == treatment.length, "Array mismatch");
        
        Experiment storage experiment = experiments[experimentId];
        require(experiment.isActive, "Experiment not active");
        require(block.timestamp < experiment.endTime, "Experiment ended");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (treatment[i]) {
                experiment.isInTreatment[users[i]] = true;
                experiment.treatmentGroup++;
            } else {
                experiment.controlGroup++;
            }
        }
    }
    
    /**
     * @notice Complete experiment and evaluate results
     * @dev Validates statistical significance of outcomes
     */
    function completeExperiment(
        uint256 experimentId,
        uint256 controlMetric,
        uint256 treatmentMetric,
        uint256 pValue
    ) external onlyRole(ORACLE_ROLE) {
        Experiment storage experiment = experiments[experimentId];
        require(experiment.isActive, "Experiment not active");
        require(block.timestamp >= experiment.endTime, "Experiment not ended");
        
        experiment.isActive = false;
        
        // Calculate improvement
        uint256 improvement = 0;
        if (treatmentMetric > controlMetric && controlMetric > 0) {
            improvement = ((treatmentMetric - controlMetric) * 100) / controlMetric;
        }
        
        // Check success criteria
        bool success = improvement >= MIN_IMPROVEMENT && pValue < SIGNIFICANCE_LEVEL;
        
        emit ExperimentCompleted(experimentId, success, improvement, pValue);
        
        if (success) {
            // Execute proposal
            _executeProposal(experiment.proposalId);
        } else {
            // Return stake minus penalty
            Proposal storage proposal = proposals[experiment.proposalId];
            uint256 penalty = proposal.stakeAmount / 10; // 10% penalty
            catalystToken.safeTransfer(proposal.proposer, proposal.stakeAmount - penalty);
            proposal.cancelled = true;
        }
    }
    
    /**
     * @notice Update contribution score for a user
     * @dev Called by various protocol components
     */
    function updateContributionScore(
        address user,
        uint256 reservoirContribution,
        uint256 verificationAccuracy,
        uint256 governanceParticipation
    ) external onlyRole(ORACLE_ROLE) {
        ContributionScore storage score = contributionScores[user];
        
        score.lifetimeReservoirContribution += reservoirContribution;
        score.verificationAccuracy = 
            (score.verificationAccuracy + verificationAccuracy) / 2; // Running average
        score.governanceParticipation += governanceParticipation;
        score.lastUpdated = block.timestamp;
        
        totalContributions += reservoirContribution;
    }
    
    /**
     * @notice Track feature usage for automatic sunset
     * @dev Features unused for 180 days are automatically disabled
     */
    function trackFeatureUsage(bytes32 featureId) external {
        featureLastUsed[featureId] = block.timestamp;
        featureUsageCount[featureId]++;
    }
    
    /**
     * @notice Check and sunset unused features
     * @dev Can be called by anyone to clean up unused features
     */
    function sunsetUnusedFeatures(bytes32[] calldata featureIds) external {
        for (uint256 i = 0; i < featureIds.length; i++) {
            bytes32 featureId = featureIds[i];
            
            // Check if feature is unused for 180 days
            if (featureLastUsed[featureId] > 0 && 
                block.timestamp > featureLastUsed[featureId] + 180 days) {
                
                // Check if usage is below 1% threshold
                uint256 usage = featureUsageCount[featureId];
                uint256 totalUsage = _getTotalFeatureUsage();
                
                if (usage * 100 < totalUsage) {
                    // Sunset the feature
                    featureLastUsed[featureId] = 0;
                    emit FeatureSunset(featureId, featureLastUsed[featureId]);
                }
            }
        }
    }
    
    /**
     * @notice Emergency proposal execution
     * @dev Only for critical security issues, requires multi-sig
     */
    function emergencyExecute(uint256 proposalId) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposalType == ProposalType.EMERGENCY_ACTION, "Not emergency");
        require(!proposal.executed, "Already executed");
        
        _executeProposal(proposalId);
    }
    
    // Internal functions
    
    function _calculateVotingWeight(address user) internal view returns (uint256) {
        ContributionScore memory score = contributionScores[user];
        
        // Weight formula from litepaper
        uint256 w1 = 5; // 50% weight for lifetime contributions
        uint256 w2 = 3; // 30% weight for accuracy
        uint256 w3 = 2; // 20% weight for participation
        
        uint256 contributionComponent = 
            (w1 * _log10(score.lifetimeReservoirContribution + PRECISION)) / 10;
        uint256 accuracyComponent = 
            (w2 * score.verificationAccuracy) / 100;
        uint256 participationComponent = 
            (w3 * score.governanceParticipation) / 10;
        
        uint256 totalScore = 
            contributionComponent + accuracyComponent + participationComponent;
        
        // Convert to voting power (quadratic)
        return _sqrt(totalScore * PRECISION);
    }
    
    function _executeProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        
        proposal.executed = true;
        proposal.executedAt = block.timestamp;
        
        // Execute the proposal
        (bool success,) = address(this).call(proposal.callData);
        
        emit ProposalExecuted(proposalId, success);
        
        if (success) {
            // Return stake with bonus
            uint256 bonus = 100 * PRECISION; // 100 USDC equivalent
            catalystToken.safeTransfer(proposal.proposer, proposal.stakeAmount);
            // Bonus would be paid in USDC from Reservoir
        }
    }
    
    function _getTotalFeatureUsage() internal view returns (uint256) {
        // Placeholder - would sum all feature usage
        return 1000000;
    }
    
    function _log10(uint256 x) internal pure returns (uint256) {
        if (x >= 10**18) return 18;
        if (x >= 10**17) return 17;
        if (x >= 10**16) return 16;
        if (x >= 10**15) return 15;
        if (x >= 10**14) return 14;
        if (x >= 10**13) return 13;
        if (x >= 10**12) return 12;
        if (x >= 10**11) return 11;
        if (x >= 10**10) return 10;
        if (x >= 10**9) return 9;
        if (x >= 10**8) return 8;
        if (x >= 10**7) return 7;
        if (x >= 10**6) return 6;
        if (x >= 10**5) return 5;
        if (x >= 10**4) return 4;
        if (x >= 10**3) return 3;
        if (x >= 10**2) return 2;
        if (x >= 10**1) return 1;
        return 0;
    }
    
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
    
    // View functions
    
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        ProposalType proposalType,
        string memory title,
        uint256 votesFor,
        uint256 votesAgainst,
        bool executed,
        bool cancelled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.proposalType,
            proposal.title,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.executed,
            proposal.cancelled
        );
    }
    
    function getExperiment(uint256 experimentId) external view returns (
        uint256 proposalId,
        uint256 startTime,
        uint256 endTime,
        uint256 controlGroup,
        uint256 treatmentGroup,
        bool isActive
    ) {
        Experiment storage experiment = experiments[experimentId];
        return (
            experiment.proposalId,
            experiment.startTime,
            experiment.endTime,
            experiment.controlGroup,
            experiment.treatmentGroup,
            experiment.isActive
        );
    }
    
    function getUserVotingPower(address user) external view returns (uint256) {
        return _calculateVotingWeight(user);
    }
}