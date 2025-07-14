# Autophage Protocol Smart Contracts

> A metabolic economic system where value must flow to exist

Prospective smart contracts for the [Autophage Protocol](https://autophage.xyz/). These contracts implement the POTP (Proof of Temporal Persistence) token system with multi-species health incentive tokens. These contracts are for demonstration purposes and should not be considered production-ready.

## Overview

The Autophage Protocol implements an innovative economic system based on exponential token decay and health activity rewards. This repository contains the core smart contracts that power the protocol's on-chain functionality.

## Core Principles

- **Metabolic Economy**: Tokens decay exponentially, requiring continuous health activities to maintain value
- **Multi-Species Tokens**: Four non-fungible token types with different decay rates matching biological time constants
- **Privacy-First**: Zero-knowledge proofs protect health data while enabling rewards
- **Empirical Governance**: All protocol changes must demonstrate measurable health improvements

## Contract Architecture

### 1. AutophageToken.sol
The core multi-species token contract implementing lazy decay evaluation for gas efficiency.

**Key Features:**
- Four token species: Rhythm (5% daily decay), Healing (0.75%), Foundation (0.1%), Catalyst (2-10% dynamic)
- Lazy decay calculation saves ~17,000 gas per unused day
- Progressive whale protection through accelerated decay rates
- Wellness vault for reduced decay rates (30-365 day locks)
- Single storage slot per user balance (128 + 64 + 64 bits)
- Pausable for emergency situations

### 2. ReservoirContract.sol
Dual-chamber treasury managing healthcare settlements.

**Key Features:**
- Healthcare claim submission with urgency scoring (1-10 scale)
- Priority queue for claim processing
- Solvency tracking and requirements
- USDC reserve management
- Oracle role for claim verification
- *Note: Tokens are non-fungible between species. Decay redistribution features are planned*

### 3. VerificationEngine.sol
Activity verification and reward calculation engine.

**Key Features:**
- Basic activity verification and reward distribution
- Configurable base rewards for different activity types
- Role-based access control for verifiers
- Integration with token minting for rewards
- *Note: Advanced features like ZK proofs, multipliers, and genetic traits are planned but not yet implemented*

### 4. GovernanceContract.sol
Governance system for protocol changes.

**Key Features:**
- Contribution-based voting power
- Proposal creation with Catalyst token staking  
- Time-based voting periods (3 days)
- Support for parameter changes and feature toggles
- *Note: A/B testing and statistical validation features are planned but not yet implemented*

## Token Economics

### Token System Overview
The Autophage Protocol uses a multi-species token system where each species serves a specific health-related purpose. Tokens are non-fungible between species, meaning they cannot be exchanged or converted into other token types.

### Species Tokens

| Species | Symbol | Daily Decay | Half-Life | Use Case |
|---------|--------|-------------|-----------|----------|
| Rhythm | RHY | 5% | 13.51 days | Exercise, medication adherence |
| Healing | HLN | 0.75% | 92.42 days | Therapy, recovery activities |
| Foundation | FDN | 0.1% | 693.15 days | Preventive care, long-term health |
| Catalyst | CTL | 2-10% | Variable | Governance and protocol balance |

**Note**: Each token species is non-fungible and cannot be exchanged for other species. Users earn specific tokens based on their health activities.

## Gas Optimizations

The protocol achieves significant gas savings through:
- **Lazy Decay**: 17,000 gas saved per unused day
- **Storage Packing**: Single 256-bit slot per balance
- **Batch Processing**: 85% reduction for multiple proofs
- **Optimized Math**: Custom power function for decay

More on gas efficiency and simulations here: https://autophage.xyz/gas-optimization 

## Security Features

- Multi-signature requirements for critical functions
- Reentrancy guards on all external functions
- Pausable in case of emergency
- Role-based access control (RBAC)
- Progressive slashing for malicious apps
- Solvency checks before settlements

## Project Structure

```
autophage-smart-contracts/
├── contracts/                    # Solidity smart contracts
│   ├── AutophageToken.sol       # Core multi-species token with decay
│   ├── ReservoirContract.sol    # Treasury and healthcare claims
│   ├── VerificationEngine.sol   # Activity verification and rewards
│   ├── GovernanceContract.sol   # Empirical governance system
│   ├── interfaces/              # Contract interfaces
│   │   ├── IAutophageToken.sol  # Token interface
│   │   └── IReservoir.sol       # Reservoir interface
│   └── mocks/                   # Mock contracts for testing
│       └── MockERC20.sol        # Simple ERC20 for USDC simulation
├── scripts/                     # Deployment and interaction scripts
│   ├── deploy.js               # Deploy all contracts with proper setup
│   ├── interact.js             # Interactive console for testing
│   └── demo.js                 # Automated demo of all features
├── test/                       # Test suites
│   ├── BasicFunctionality.test.js  # Working tests for core features
│   ├── AutophageToken.test.js     # Comprehensive token tests
│   ├── ReservoirContract.test.js  # Healthcare and exchange tests
│   ├── VerificationEngine.test.js # Activity verification tests
│   └── GovernanceContract.test.js # Governance tests
├── deployments/                # Deployment artifacts (created on deploy)
├── artifacts/                  # Compiled contracts (created on compile)
├── cache/                      # Hardhat cache (created automatically)
├── node_modules/              # Dependencies (created on npm install)
├── hardhat.config.js          # Hardhat configuration
├── package.json               # NPM package configuration
├── package-lock.json          # NPM lock file
├── TEST_GUIDE.md              # Comprehensive testing guide
├── CONTRIBUTING.md            # Contribution guidelines
├── LICENSE                    # Apache 2.0 license
└── README.md                  # This file
```

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/statusdothealth/autophage-smart-contracts.git
cd autophage-smart-contracts

# Install dependencies
npm install

# Compile contracts
npm run compile
```

### 1.5. Web Interface

Access the Autophage Protocol through your browser:

🌐 **GitHub Pages**: `https://contracts.autophage.xyz/`

Or run locally:
```bash
cd docs
python3 -m http.server 8000
# Visit http://localhost:8000
```

**Web Interface Features:**
- Connect to MetaMask wallet
- View token balances with real-time decay calculations
- Mint tokens for different activity types
- Transfer tokens between addresses
- Lock tokens in wellness vault
- Submit and track healthcare claims
- Create and vote on governance proposals
- View activity bonuses and daily earnings

### 2. Run the Demo (Recommended First Step)

The easiest way to understand the protocol is to run the automated demo:

```bash
npm run demo
```

This will:
- Deploy all contracts locally
- Demonstrate token minting and decay
- Show activity verification and rewards
- Display group activity bonuses
- Illustrate wellness vault functionality
- Show token exchange mechanics

### 3. Interactive Testing

For hands-on experimentation, use the interactive console:

```bash
# Terminal 1: Start local blockchain
npm run node

# Terminal 2: Deploy contracts
npm run deploy:localhost

# Terminal 3: Start interactive console
npm run interact
```

The interactive console provides a menu-driven interface to:
- **Token Operations**: Mint, transfer, check decay, lock in vault
- **Health Activities**: Submit exercise, therapy, nutrition logs
- **Healthcare Claims**: Submit and process medical claims
- **Governance**: Create proposals, vote, execute changes
- **View Stats**: Check balances, activity history, voting power

### 4. Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:token        # AutophageToken tests
npm run test:reservoir    # ReservoirContract tests
npm run test:verification # VerificationEngine tests
npm run test:governance   # GovernanceContract tests

# Test Results Summary:
# - 38 tests passing
# - 52 tests pending (for features not yet implemented)
# All core functionality is tested and working
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile Solidity contracts |
| `npm test` | Run all test suites |
| `npm run test:token` | Test AutophageToken contract |
| `npm run test:reservoir` | Test ReservoirContract |
| `npm run test:verification` | Test VerificationEngine |
| `npm run test:governance` | Test GovernanceContract |
| `npm run node` | Start local Hardhat node |
| `npm run deploy` | Deploy to default network |
| `npm run deploy:localhost` | Deploy to local node |
| `npm run demo` | Run automated demo |
| `npm run interact` | Start interactive console |
| `npm run console` | Open Hardhat console |

## Deployment

### Prerequisites
- Node.js v16+
- Hardhat
- OpenZeppelin Contracts v4.9.0

### Deployment Order
1. Deploy AutophageToken (no dependencies)
2. Deploy ReservoirContract with token and USDC addresses
3. Deploy VerificationEngine with token and reservoir addresses
4. Deploy GovernanceContract with token and catalyst addresses

### Post-Deployment Setup
```javascript
// Grant necessary roles
const MINTER_ROLE = await autophageToken.MINTER_ROLE();
const RESERVOIR_ROLE = await autophageToken.RESERVOIR_ROLE();
const ORACLE_ROLE = await reservoir.ORACLE_ROLE();

await autophageToken.grantRole(MINTER_ROLE, verificationEngine.address);
await autophageToken.grantRole(RESERVOIR_ROLE, reservoir.address);
await reservoir.grantRole(ORACLE_ROLE, verificationEngine.address);

// Configure initial parameters
await verificationEngine.updateBaseReward(0, parseEther("50")); // Exercise rewards

// Note: Transfer admin to multi-sig when ready for production
```

## Testing Guide

### Understanding the Tests

The repository includes comprehensive test suites for all contracts:

1. **BasicFunctionality.test.js** - Working tests that demonstrate core features
   - Token minting, transfers, and decay
   - Wellness vault operations
   - Basic governance and voting
   - Healthcare claims submission

2. **AutophageToken.test.js** - Full token functionality tests
   - Multi-species token operations
   - Decay calculations for all species
   - Whale protection mechanisms
   - Wellness vault functionality

3. **ReservoirContract.test.js** - Treasury and healthcare tests
   - Healthcare claim submission and prioritization
   - Solvency tracking
   - *Note: Many advanced features are skipped as they're not yet implemented*

4. **VerificationEngine.test.js** - Activity verification tests
   - Basic deployment and role setup
   - Base reward updates
   - *Note: Most features are planned but not yet implemented*

5. **GovernanceContract.test.js** - Governance system tests
   - Proposal creation and voting
   - Voting power calculations
   - *Note: A/B testing and statistical validation are planned features*

### Common Testing Patterns

```javascript
// Example: Testing token decay
const token = await ethers.getContractAt("AutophageToken", tokenAddress);
await token.mint(userAddress, 0, ethers.parseEther("1000"));

// Advance time by 1 day
await network.provider.send("evm_increaseTime", [86400]);
await network.provider.send("evm_mine");

// Check balance after decay
const balance = await token.balanceOf(userAddress, 0);
console.log("After 1 day:", ethers.formatEther(balance)); // ~950 tokens (5% decay)
```

### Local Testing Workflow

1. **Start a local blockchain**:
   ```bash
   npm run node
   ```

2. **Deploy contracts** (in a new terminal):
   ```bash
   npm run deploy:localhost
   ```

3. **Run interactive console** (in a new terminal):
   ```bash
   npm run interact
   ```

4. **Or use Hardhat console for direct interaction**:
   ```bash
   npx hardhat console --network localhost
   ```

For more detailed testing instructions, see [TEST_GUIDE.md](TEST_GUIDE.md).

## Implementation Status

### Currently Implemented ✅
- Multi-species token system with exponential decay
- Lazy decay evaluation for gas efficiency
- Wellness vault with reduced decay rates
- Basic healthcare claims submission and processing
- Contribution-based governance voting
- Role-based access control
- Emergency pause functionality
- Web interface for easy interaction

### Planned Features 🚧
- Zero-knowledge proof verification
- Activity multipliers (streak, group, quality)
- A/B testing framework for governance
- Genetic traits system
- Advanced healthcare claim prioritization
- Automated decay collection and redistribution

## Audit Status

⚠️ **These contracts are currently unaudited and should not be used in production without thorough security review.**

Planned audits:
- [ ] Formal verification of decay mathematics
- [ ] Economic attack vector analysis
- [ ] Gas optimization review
- [ ] Access control verification

## Key Features Demonstration

**Important Note**: The contracts implement core functionality with many advanced features planned for future development. The following demonstrations show what's currently working:

### 1. Metabolic Token Economy
```javascript
// Tokens decay exponentially over time
// Rhythm tokens (RHY): 5% daily decay (half-life: 13.51 days)
await token.mint(alice, 0, parseEther("1000"));
// After 1 day: ~950 Rhythm tokens
// After 1 week: ~698 Rhythm tokens
// After 2 weeks: ~487 Rhythm tokens
```

### 2. Health Activity Rewards
```javascript
// Activity verification requires VERIFIER_ROLE
// Currently, rewards are distributed through the minting mechanism
// Base rewards can be updated:
await verificationEngine.updateBaseReward(0, parseEther("50")); // Exercise
await verificationEngine.updateBaseReward(1, parseEther("20")); // Therapy
await verificationEngine.updateBaseReward(2, parseEther("20")); // Nutrition
await verificationEngine.updateBaseReward(3, parseEther("30")); // Prevention
```

### 3. Wellness Vault
```javascript
// Lock tokens for reduced decay
await token.lockInVault(
  0,     // Rhythm (RHY) species
  500,   // Amount
  30     // Days
);
// Locked tokens decay at 4.25% instead of 5% daily
```

### 4. Healthcare Claims
```javascript
// Submit medical expense claim
await reservoir.submitHealthcareClaim(
  parseEther("1000"), // $1000 claim
  8,                   // Urgency score (1-10 scale)
  "Emergency procedure",
  verificationHash     // Proof of claim
);
// Claims processed by urgency and available funds
```

### 5. Governance System
```javascript
// Create proposal for protocol changes
await governance.createProposal(
  0,                          // Proposal type (0 = PARAMETER_CHANGE)
  "Increase Exercise Rewards",
  "Boost rewards by 20% to increase engagement",
  "0x"                        // Call data for execution
);
// Voting period lasts 3 days
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Areas for Contribution
- Implement zero-knowledge proof verification
- Add activity multipliers (streak, group, quality)
- Add A/B testing framework to governance
- Implement genetic traits system
- Gas optimization improvements
- Test coverage expansion
- Documentation improvements

## Documentation

- [Litepaper](https://autophage.xyz/paper/litepaper.pdf) - Full academic treatment
- [Simulations](https://autophage.xyz/simulations) - Interactive Monte Carlo Simulation suite
- [Gas Optimization](https://autophage.xyz/gas-optimization) - Detailed gas analysis
- [TEST_GUIDE.md](TEST_GUIDE.md) - Comprehensive testing documentation

## License

This project is licensed under the Apache License, Version 2.0 - see the [LICENSE](LICENSE) file for details.

The Apache 2.0 license provides a good balance of openness and flexibility, allowing both open source and commercial use while providing patent protection.

## Contact

- Website: [autophage.xyz](https://autophage.xyz/)

## Acknowledgments

- OpenZeppelin for secure contract libraries
- Ethereum Foundation for development tools
- Community contributors and testers

---

*"Design for life, not death"*
