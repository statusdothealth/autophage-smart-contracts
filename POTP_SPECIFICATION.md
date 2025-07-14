# Autophage Protocol: POTP Token Specification

## Protocol Overview

**Protocol Name:** Autophage Protocol  
**Meta-Token:** POTP (Proof of Temporal Persistence)  
**Architecture:** Privacy-first, zkSNARK-enabled health incentive system with economic expiration

## Token Taxonomy

### 1. Meta-Layer Token (POTP)

- **Symbol:** POTP
- **Decimals:** 18
- **Supply:** Dynamic (no hard cap)
- **Purpose:** Cross-species settlement, governance, and protocol accounting
- **User Interaction:** Indirect only (via species token conversions)

### 2. Species Tokens

| Species    | Symbol | Decay Rate/Day | Half-Life    | Health Domain              |
|------------|--------|----------------|--------------|----------------------------|
| Rhythm     | RHY    | 5%             | ~13.5 days   | Exercise, Medication       |
| Healing    | HLN    | 0.75%          | ~92.4 days   | Therapy, Recovery          |
| Foundation | FDN    | 0.1%           | ~693 days    | Preventive Care            |
| Catalyst   | CTL    | 2-10%          | Variable     | Marketplace, Social        |

## Core Mechanics

### Decay Function

For species token `i` and user `u`, balance updates as:

```
V_i^(u)(t+1) = V_i^(u)(t) × (1 - δ_i) + G_i^(u)(t)
```

Where:
- `δ_i`: Decay rate for species i
- `G_i^(u)(t)`: New tokens earned via verified actions
- Enforced lazily on transfer/mint/burn to minimize gas

### Reservoir System

**Dual-chamber architecture:**
1. **Rewards Reservoir:** Collects decayed tokens for redistribution
2. **Settlement Reservoir:** Handles stablecoin conversions for healthcare claims

### Privacy Architecture

- All proofs via zkSNARKs/zkVM
- No global balance ledger
- State-minimized, ephemeral proofs only
- User activity data never exposed on-chain

### Trait System (Genetic Adaptations)

**Burn-to-unlock mechanism:**
```
Cost_trait_n = 1000 × 2.5^(n-1) Foundation tokens
```

Each trait provides multiplicative earning bonuses with diminishing returns.

## Implementation Requirements

### Contract Constants

```solidity
// Species identifiers
uint8 constant RHYTHM = 0;     // RHY
uint8 constant HEALING = 1;    // HLN
uint8 constant FOUNDATION = 2; // FDN
uint8 constant CATALYST = 3;   // CTL

// Decay rates (per day, 18 decimals)
uint256 constant RHYTHM_DECAY = 50000000000000000;     // 5%
uint256 constant HEALING_DECAY = 7500000000000000;     // 0.75%
uint256 constant FOUNDATION_DECAY = 1000000000000000;  // 0.1%
uint256 constant CATALYST_MIN_DECAY = 20000000000000000; // 2%
uint256 constant CATALYST_MAX_DECAY = 100000000000000000; // 10%
```

### Naming Conventions

- **Contract References:** Use uppercase symbols (RHY, HLN, FDN, CTL)
- **User-Facing:** Always "Rhythm tokens", "Healing tokens", etc.
- **Never:** "RHY coin", "POTP coin", or any speculative framing

### Key Interfaces

```solidity
interface IAutophageToken {
    // Core species token functions
    function mint(address to, uint8 species, uint256 amount) external;
    function burn(address from, uint8 species, uint256 amount) external;
    function transfer(address to, uint8 species, uint256 amount) external;
    function balanceOf(address account, uint8 species) external view returns (uint256);
    
    // Decay management
    function applyDecay(address account, uint8 species) external;
    function getDecayRate(uint8 species) external view returns (uint256);
    
    // Vault functions
    function lockInVault(uint8 species, uint256 amount, uint256 lockDays) external;
    function unlockFromVault(uint8 species) external;
}

interface IPOTPSettlement {
    // Cross-species conversion
    function convertToPOTP(uint8 fromSpecies, uint256 amount) external returns (uint256);
    function getConversionRate(uint8 species) external view returns (uint256);
    
    // Governance integration
    function getPOTPBalance(address account) external view returns (uint256);
}
```

## Migration from Current Implementation

### Required Updates:

1. **Token Name:** "Autophage Token" → Species-specific names
2. **Symbol:** "PHAGE" → RHY/HLN/FDN/CTL per species
3. **Add POTP Settlement Layer:** New contract for meta-token accounting
4. **Update Events:** Include species symbol in all emissions

### Backward Compatibility:

- Maintain species ID system (0-3)
- Keep existing decay calculations
- Preserve vault mechanism

## Security Considerations

1. **Lazy Decay:** Continue gas-optimized approach
2. **Reentrancy Guards:** All state-changing functions
3. **Access Control:** Role-based for minting/burning
4. **Overflow Protection:** Use OpenZeppelin SafeMath equivalents

## Future Extensions

1. **Cross-Chain Bridge:** POTP as universal settlement token
2. **zkVM Migration:** Full privacy-preserving implementation
3. **Trait Marketplace:** NFT-based genetic adaptations
4. **DAO Governance:** POTP-weighted voting

## References

- Protocol Site: https://autophage.xyz
- Litepaper: https://autophage.xyz/paper/litepaper.pdf
- Original Implementation: This repository

---

**Note:** This specification supersedes the original "PHAGE" token design. All new implementations should follow the POTP/species token architecture outlined above.