# MetaGuildX MGX Token Whitepaper

## Documentation Version: v1.0 — Architecture Freeze
This document separates deployed protocol facts from Foundation policy. Protocol facts describe the current on-chain architecture. Foundation policy describes operational decisions, future plans, and governance direction that may evolve.

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or project scripts. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Planned or expected later-phase work, not active today. |

## Protocol Specification (Immutable)

### Vision
MetaGuildX bridges community and blockchain through a self-sustaining token economy.

### Problem
Traditional MLM and referral systems often lack:

- Transparent payout logic.
- Independently verifiable accounting.
- Durable utility beyond recruitment.
- Clear visibility into tree placement, income routing, and recovery workflows.
- Native integration with tokenized economies.

### Deployed Solution
MetaGuildX uses smart contracts on opBNB Mainnet to operate a transparent Community Building platform connected to the fixed-supply MGX token.

The deployed architecture includes:

- Community Building registration and binary placement.
- Direct, level, spillover, cross-line, cashback, upgrade, and rebirth logic.
- MGX token allocation through TokenEngine.
- MGXStaking deployed with funded reward pool.
- Gnosis Safe ownership of all contracts.
- UUPS upgradeable contract architecture.

### Deployment Snapshot
| Item | Value |
| --- | --- |
| Chain | VERIFIED: opBNB Mainnet |
| MGXToken | VERIFIED: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| Core | VERIFIED: `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` |
| MGXStaking | VERIFIED: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |
| TokenEngine | VERIFIED: `0xD3f119B64B72303F3fd3749a314E902D92fc75cd` |
| Contract owner | VERIFIED: Gnosis Safe `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` |
| Active users | VERIFIED: 144+ |
| Total MGX distributed | VERIFIED: 9,780 MGX across 144 users |

### MGX Supply
VERIFIED: Total MGX supply is fixed at 511,750,000 MGX. `launchMinted=true`; no mint after launch.

| Allocation | Amount | Percent | Status |
| --- | ---: | ---: | --- |
| Community | 307,050,000 MGX | 60% | Core staged funding active |
| Liquidity | 102,350,000 MGX | 20% | Split policy documented in TOKENOMICS.md |
| Reserve | 102,350,000 MGX | 20% | Held in deployer staging wallet for future use |

### Community Building Model
The platform includes five income types:

| Income Type | Description |
| --- | --- |
| Direct income | Direct income from referred activity. |
| Level income | Income across 10 levels. |
| Staking income | MGX staking rewards. |
| Spillover income | Placement-related spillover income. |
| Cross-line income | Income from every 5th X event. |

### Package Ladder
| Level | Package Amount |
| --- | ---: |
| L1 | $10 |
| L2 | $20 |
| L3 | $40 |
| L4 | $80 |
| L5 | $160 |
| L6 | $320 |
| L7 | $640 |
| L8 | $1,280 |
| L9 | $2,560 |
| L10 | $5,120 |

### Binary System
VERIFIED: MetaGuildX uses a binary placement model with left and right branches.

The binary tree supports:

- User placement under sponsors.
- Left and right branch tracking.
- Spillover mechanics.
- Surrender handling and tree recovery logic.

### Cashback System
VERIFIED:

- Cashback is connected to surrender behavior.
- Surrender window is 3 to 6 months.
- Cashback share is 4% of new joins when surrendered users exist.
- When no surrendered users exist, creator fallback logic applies.

### Upgrade and Rebirth
VERIFIED:

- Users progress through package upgrades.
- Rebirth logic exists in deployed contracts.
- Rebirth users are represented through new user IDs according to contract rules.
- Recovery tooling exists for failed or pending distribution states.

### MGX Staking
VERIFIED:

- MGXStaking is deployed and operational.
- Reward pool is funded with 10,235,000 MGX.
- totalStaked is 40 MGX, test only.
- rewardRate is 3 bps, equal to 0.03% per day.
- Lock periods are 30, 90, 180, 365, and 730 days.
- Multipliers range from 100% to 115%.
- Action fee is 20% for withdraw/add-to-stake actions.

## Foundation Policy (Evolving)

### Ecosystem Roadmap
The roadmap is directional and may evolve through Foundation and future governance decisions.

| Phase | Description | Current Status |
| --- | --- | --- |
| 1 | Community Building Platform | LIVE |
| 2 | MGX Token Launch | CURRENT PHASE |
| 3 | NFT Creation | FUTURE WORK |
| 4 | NFT Marketplace | FUTURE WORK |
| 5 | MGX DEX | FUTURE WORK |
| 6 | Gaming Platform | FUTURE WORK |
| 7 | Helping Concept | FUTURE WORK |
| 8 | Metaverse | FUTURE WORK |

### Staking Rate Policy
The staking reward rate is currently set at 0.03% per day. The Foundation may adjust this rate through future governance decisions as ecosystem revenue and treasury sustainability evolve.

### Staking Activation Policy
MGXStaking contract is deployed and operational. The Foundation monitors adoption metrics to determine optimal timing for broader community staking activation.

### Distribution Lifecycle Policy
Upon full community distribution, the protocol transitions from token distribution incentives to token utility. The Foundation may establish buyback or redistribution mechanisms through governance at that stage.

### Treasury Refill Policy
The Foundation monitors Core MGX balance and maintains operational reserves. Refill thresholds are operational decisions that may evolve with growth.

### Governance Transition Policy
Governance will progressively decentralize as the platform matures. Advisory participation begins in early phases; on-chain governance is planned for introduction alongside future DEX development.

### Bridge Policy
VERIFIED bridge decisions:

- LI.FI retained for non-opBNB chains.
- Owlto removed because SDK v0.2.5 has no opBNB pairs.
- Thirdweb rejected due to vendor lock-in and security concerns.
- opBNB route displays Coming Soon until a production-ready provider confirms USDT support.

### Security and Governance Policy
Current governance:

- VERIFIED: Gnosis Safe owns all contracts.
- VERIFIED: Deployer wallet is used as operational staging wallet.

Future governance:

- FUTURE WORK: progressive decentralization.
- UNKNOWN: Snapshot, on-chain governance, quorum, proposal thresholds, and voting timelines are not finalized.

### Unknowns and Non-Commitments
The following are intentionally not promised in this document:

- Exchange listing dates.
- DEX launch date.
- Reserve release schedule.
- Liquidity deployment schedule.
- Future governance voting parameters.
- NFT and gaming launch dates.

