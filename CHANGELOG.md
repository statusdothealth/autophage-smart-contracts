# Changelog

## [POTP Update] - 2025-07-14

### Added
- **POTP Specification Document**: Comprehensive token specification for Proof of Temporal Persistence
- **Species Token Symbols**: RHY, HLN, FDN, CTL for Rhythm, Healing, Foundation, and Catalyst
- **Meta-Token Architecture**: POTP as cross-species settlement and governance token
- **QUICKSTART.md**: 1-minute demo guide for new users
- **POTP_SPECIFICATION.md**: Technical specification for implementation

### Changed
- **Token Naming**: Updated from generic "PHAGE" to species-specific names
  - RHYTHM → Rhythm (RHY)
  - HEALING → Healing (HLN)
  - FOUNDATION → Foundation (FDN)
  - CATALYST → Catalyst (CTL)
- **Scripts**: Updated demo.js and interact.js to use new token names
- **Documentation**: Updated README with POTP meta-token information

### Fixed
- Removed non-existent `CLAIM_SUBMITTER_ROLE` from deploy and interact scripts
- Fixed `lockInWellnessVault` → `lockInVault` function name
- Removed attempts to access private vault information
- Auto-deployment in interact.js when no deployment file exists

### Protocol Specification

#### POTP Meta-Token
- **Symbol**: POTP (Proof of Temporal Persistence)
- **Purpose**: Cross-species accounting, not directly earned by users
- **Decimals**: 18
- **Supply**: Dynamic, no hard cap

#### Species Tokens
| Species | Symbol | Daily Decay | Half-Life |
|---------|--------|-------------|-----------|
| Rhythm | RHY | 5% | ~13.5 days |
| Healing | HLN | 0.75% | ~92.4 days |
| Foundation | FDN | 0.1% | ~693 days |
| Catalyst | CTL | 2-10% | Variable |

### Technical Details
- Decay function: `V_i^(u)(t+1) = V_i^(u)(t) × (1 - δ_i) + G_i^(u)(t)`
- Lazy evaluation for gas optimization
- zkSNARK/zkVM ready for privacy preservation
- Dual-chamber reservoir for rewards and settlements

### Migration Notes
- Existing contracts maintain species ID system (0-3)
- Backward compatible with current implementation
- Future: Add POTP settlement layer contract
- Future: Implement cross-species conversion rates

---

## [Initial Release] - 2025-07-14

### Added
- Core smart contracts for Autophage Protocol
- AutophageToken with multi-species support
- ReservoirContract for treasury management
- VerificationEngine for activity validation
- GovernanceContract for empirical governance
- Comprehensive test suites
- Interactive demo and console scripts