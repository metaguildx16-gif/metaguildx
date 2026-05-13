# Contract Architecture

## Goal

Mirror the provided blueprint in modular Solidity contracts so the business rules stay isolated and easier to audit.

## Planned Contracts

### `MGXToken`

- Fixed total supply
- Launch allocation handling
- Box tracking metadata
- No mint after launch

### `MetaGuildCore`

- Registration
- Package purchases
- User profile state
- Package ladder enforcement

### `BinaryTree`

- Auto-placement logic
- Left/right tree tracking
- Spillover support
- Weak-leg insertion for re-entry IDs

### `IncomeRouter`

- Direct income
- Level income
- Spillover income
- Cross-line income

### `UpgradeManager`

- Auto-upgrade via `2X + 3X`
- Auto-reactivation via `5X`
- Re-entry ID lifecycle

### `CashbackPool`

- Surrender registration
- Eligibility window handling
- Pool accounting
- Daily distribution ledger

### `MGXStaking`

- Launch reward pool staking
- Daily release tracking
- Duration-based reward modifiers
- Claim / compound / withdraw flows

## Integration Direction

- Contracts are written as separate modules with a thin orchestration layer
- Shared data structs and constants live in `libraries`
- OPBNB deployment scripts will be added after the core logic is implemented
