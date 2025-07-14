// Configuration for Autophage Protocol Web Interface

const CONFIG = {
    // Network configurations
    networks: {
        localhost: {
            chainId: '0x7a69', // 31337
            chainName: 'Localhost',
            rpcUrl: 'http://localhost:8545'
        },
        hardhat: {
            chainId: '0x7a69', // 31337
            chainName: 'Hardhat',
            rpcUrl: 'http://localhost:8545'
        },
        sepolia: {
            chainId: '0xaa36a7', // 11155111
            chainName: 'Sepolia',
            rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY'
        }
    },
    
    // Contract ABIs (simplified for key functions)
    abis: {
        AutophageToken: [
            "function mint(address to, uint8 species, uint256 amount) external",
            "function transfer(address to, uint8 species, uint256 amount) external returns (bool)",
            "function balanceOf(address account, uint8 species) external view returns (uint256)",
            "function lockInVault(uint8 species, uint256 amount, uint256 lockDays) external",
            "function unlockFromVault(uint8 species) external",
            "function MINTER_ROLE() external view returns (bytes32)",
            "function RESERVOIR_ROLE() external view returns (bytes32)",
            "function grantRole(bytes32 role, address account) external",
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function pause() external",
            "function unpause() external",
            "function setApprovalForAll(address operator, bool approved) external",
            "event Transfer(address indexed from, address indexed to, uint8 indexed species, uint256 amount)",
            "event VaultLocked(address indexed user, uint8 indexed species, uint256 amount, uint256 lockDays)"
        ],
        
        MockERC20: [
            "function mint(address to, uint256 amount) external",
            "function transfer(address to, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)",
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function name() external view returns (string)",
            "function symbol() external view returns (string)"
        ],
        
        ReservoirContract: [
            "function buyAutophageTokens(uint8 species, uint256 usdcAmount) external",
            "function sellAutophageTokens(uint8 species, uint256 tokenAmount) external",
            "function getExchangeRate(uint8 species) external view returns (uint256)",
            "function submitHealthcareClaim(address patient, uint256 amount, uint8 urgency, string memory reason) external",
            "function getActiveClaims() external view returns (tuple(address patient, uint256 amount, uint8 urgency, string reason, uint256 timestamp, bool processed)[])"
        ],
        
        VerificationEngine: [
            "function updateBaseReward(uint8 activityType, uint256 newReward) external",
            "function baseRewards(uint8 activityType) external view returns (uint256)",
            "function VERIFIER_ROLE() external view returns (bytes32)"
        ],
        
        GovernanceContract: [
            "function createProposal(bytes32 proposalId, uint8 proposalType) external",
            "function vote(bytes32 proposalId, bool support) external",
            "function executeProposal(bytes32 proposalId) external",
            "function getProposal(bytes32 proposalId) external view returns (tuple(bytes32 id, address proposer, uint8 proposalType, uint256 forVotes, uint256 againstVotes, uint256 startTime, uint256 endTime, uint8 status))"
        ]
    },
    
    // Token species configuration
    species: {
        0: { name: 'Rhythm', symbol: 'RHY', color: '#ef4444', decay: 0.05 },
        1: { name: 'Healing', symbol: 'HLN', color: '#10b981', decay: 0.0075 },
        2: { name: 'Foundation', symbol: 'FDN', color: '#3b82f6', decay: 0.001 },
        3: { name: 'Catalyst', symbol: 'CTL', color: '#f59e0b', decay: 0.05 } // Average decay
    },
    
    // Activity types
    activities: {
        0: { name: 'Exercise', icon: '🏃', baseReward: 50 },
        1: { name: 'Therapy', icon: '🧘', baseReward: 30 },
        2: { name: 'Nutrition', icon: '🥗', baseReward: 20 },
        3: { name: 'Checkup', icon: '🏥', baseReward: 40 }
    },
    
    // Demo mode configuration
    demoMode: {
        enabled: false,
        mockBalances: {
            0: '1000', // 1000 RHY
            1: '500',  // 500 HLN
            2: '2000', // 2000 FDN
            3: '100',  // 100 CTL
            usdc: '88.88' // 88.88 USDC initial balance
        }
    }
};

// Contract addresses (will be loaded from deployment or set manually)
let CONTRACT_ADDRESSES = {
    AutophageToken: '',
    MockUSDC: '',
    ReservoirContract: '',
    VerificationEngine: '',
    GovernanceContract: ''
};

// Load contract addresses from localStorage if available
function loadContractAddresses() {
    const saved = localStorage.getItem('autophage_contracts');
    if (saved) {
        CONTRACT_ADDRESSES = JSON.parse(saved);
    }
}

// Save contract addresses to localStorage
function saveContractAddresses(addresses) {
    CONTRACT_ADDRESSES = addresses;
    localStorage.setItem('autophage_contracts', JSON.stringify(addresses));
}

// Export for use in other modules
window.CONFIG = CONFIG;
window.CONTRACT_ADDRESSES = CONTRACT_ADDRESSES;
window.loadContractAddresses = loadContractAddresses;
window.saveContractAddresses = saveContractAddresses;