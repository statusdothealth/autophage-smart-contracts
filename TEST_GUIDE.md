# Autophage Smart Contracts - Testing Guide

This guide explains how to test and interact with the Autophage Protocol contracts locally.

## Quick Start

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run all tests
npm test

# Run specific test suites
npm run test:token        # AutophageToken tests
npm run test:reservoir    # ReservoirContract tests
npm run test:verification # VerificationEngine tests
npm run test:governance   # GovernanceContract tests
```

## Interactive Testing

### Option 1: Demo Script (Recommended for First-Time Users)

Run an automated demo that showcases all major features:

```bash
npm run demo
```

This demonstrates:
- Token minting and decay
- Activity verification and rewards
- Wellness vault functionality
- Group activity bonuses
- Token exchange mechanics

### Option 2: Interactive Console

For hands-on testing:

```bash
# Terminal 1: Start local blockchain
npm run node

# Terminal 2: Deploy contracts
npm run deploy:localhost

# Terminal 3: Start interactive console
npm run interact
```

The interactive console provides a menu-driven interface to:
- Mint and transfer tokens
- Submit health activities
- Create and vote on proposals
- View balances and statistics

### Option 3: Hardhat Console

For direct contract interaction:

```bash
# Start local node
npm run node

# Deploy contracts
npm run deploy:localhost

# Open console
npm run console
```

Example console commands:
```javascript
// Get deployed contracts
const AutophageToken = await ethers.getContractFactory("AutophageToken");
const deployment = require("./deployments/localhost.json");
const token = await AutophageToken.attach(deployment.contracts.AutophageToken);

// Check balance
const [signer] = await ethers.getSigners();
const balance = await token.balanceOf(signer.address, 0); // Species 0 = RHYTHM
console.log("Balance:", ethers.formatEther(balance));

// Mint tokens
await token.mint(signer.address, 0, ethers.parseEther("100"));
```

## Test Coverage

The test suite covers:

### AutophageToken Tests
- Token minting and transfers
- Decay calculations (5%, 0.75%, 0.1% daily)
- Wellness vault locking/unlocking
- Batch operations
- Whale protection mechanisms

### ReservoirContract Tests
- Decay collection and tracking
- Healthcare claim submission and processing
- Token exchange (buy/sell)
- Redistribution mechanisms
- Emergency functions

### VerificationEngine Tests
- Activity proof verification
- Streak and multiplier calculations
- Group activity bonuses
- App registration and reputation
- Genetic trait bonuses

### GovernanceContract Tests
- Proposal creation and voting
- A/B testing framework
- Statistical significance validation
- Feature sunset after 180 days
- Emergency governance functions

## Common Testing Scenarios

### 1. Simulate Daily User Activity
```bash
npm run demo
# Watch how tokens are earned through activities and decay over time
```

### 2. Test Token Decay
```javascript
// In Hardhat console
const token = await ethers.getContractAt("AutophageToken", tokenAddress);
await token.mint(userAddress, 0, ethers.parseEther("1000"));

// Advance time by 1 day
await network.provider.send("evm_increaseTime", [86400]);
await network.provider.send("evm_mine");

// Check balance after decay
const balance = await token.balanceOf(userAddress, 0);
console.log("After 1 day:", ethers.formatEther(balance)); // ~950 tokens (5% decay)
```

### 3. Test Healthcare Claims
```javascript
// Submit a claim through VerificationEngine
const reservoir = await ethers.getContractAt("ReservoirContract", reservoirAddress);
await reservoir.submitHealthcareClaim(
  patientAddress,
  ethers.parseEther("1000"), // $1000 claim
  80, // urgency score
  "Medical procedure"
);

// Process claims
await reservoir.processClaims(1);
```

### 4. Test Governance
```javascript
const governance = await ethers.getContractAt("GovernanceContract", govAddress);

// Create proposal
await governance.createProposal(
  "Increase Exercise Rewards",
  "Boost rewards by 20%",
  "Will increase daily active users by 10%",
  0 // Parameter change
);

// Vote
await governance.vote(0, true);

// Execute after voting period
await network.provider.send("evm_increaseTime", [259200]); // 3 days
await governance.executeProposal(0);
```

## Troubleshooting

### "No deployment found"
Run `npm run deploy:localhost` after starting the local node.

### "Must have minter role"
The deploy script sets up basic roles. For additional permissions:
```javascript
const MINTER_ROLE = await token.MINTER_ROLE();
await token.grantRole(MINTER_ROLE, yourAddress);
```

### Time-dependent tests
Use Hardhat's time manipulation:
```javascript
await network.provider.send("evm_increaseTime", [seconds]);
await network.provider.send("evm_mine");
```

## Gas Usage

Monitor gas consumption during tests:
```javascript
const tx = await contract.someMethod();
const receipt = await tx.wait();
console.log("Gas used:", receipt.gasUsed.toString());
```

## Next Steps

1. Run the demo to understand the protocol
2. Use the interactive console to experiment
3. Write custom tests for your use cases
4. Check gas optimization opportunities
5. Review security considerations

For more details, see the main README.md and contract documentation.