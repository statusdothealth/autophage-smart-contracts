# Autophage Protocol - Quick Start Guide 🚀

## 1-Minute Demo

```bash
# Install and run demo
npm install
npm run demo
```

Watch tokens decay in real-time and see the metabolic economy in action!

## Interactive Testing (5 minutes)

```bash
# Terminal 1: Start local blockchain
npm run node

# Terminal 2: Deploy and interact
npm run deploy:localhost
npm run interact
```

Try these in the interactive console:
1. **Mint tokens** → Option 1 → 1 → Choose "me" → Select RHYTHM (0) → Enter 1000
2. **Check decay** → Option 1 → 3 → Enter "me" (see your balance)
3. **Submit workout** → Option 2 → 1 → Duration: 30, Intensity: 75
4. **View stats** → Option 5 (see all balances and exchange rates)

## Understanding the Protocol

### Token Species & Decay Rates
- **RHYTHM** 🏃: 5% daily decay (exercise rewards)
- **HEALING** 🧘: 0.75% daily decay (therapy rewards)
- **FOUNDATION** 🏥: 0.1% daily decay (preventive care)
- **CATALYST** ⚡: 2-10% dynamic (marketplace balance)

### Key Concepts
1. **Metabolic Economy**: Tokens decay exponentially, requiring activity to maintain value
2. **Wellness Vault**: Lock tokens to reduce decay rate (0.5% reduction per 30 days)
3. **Activity Rewards**: Complete health activities to earn tokens
4. **Healthcare Claims**: Submit medical expenses for USDC reimbursement

## Example Workflow

```javascript
// 1. Alice completes a workout
Duration: 45 minutes
Intensity: 80/100
Reward: ~60 RHYTHM tokens

// 2. Time passes (1 day)
Initial: 60 tokens
After decay: 57 tokens (-5%)

// 3. Alice locks tokens in vault
Lock amount: 30 tokens
Lock duration: 30 days
New decay rate: 4.25% (instead of 5%)

// 4. Bob needs medical care
Claim amount: $1000
Urgency: 85/100
Status: Queued for processing
```

## Contract Addresses (Local)

After running `npm run deploy:localhost`, find addresses in:
```
deployments/localhost.json
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run demo` | See all features in action |
| `npm run interact` | Interactive testing console |
| `npm test` | Run test suite |
| `npx hardhat console` | Direct contract interaction |

## Next Steps

1. Read the full [README.md](README.md) for detailed documentation
2. Check [TEST_GUIDE.md](TEST_GUIDE.md) for advanced testing
3. Explore the contracts in the `contracts/` directory
4. Join the discussion at [autophage.xyz](https://autophage.xyz)

---

**Remember**: Value must flow to exist! 🌊