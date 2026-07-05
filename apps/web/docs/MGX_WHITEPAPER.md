# MetaGuildX MGX Token Whitepaper

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or project scripts. |
| ASSUMED | Reasonable interpretation from current design, not a finalized public commitment. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Planned or expected later-phase work, not active today. |

## Vision
MetaGuildX aims to bridge community and blockchain through a self-sustaining token economy.

The platform combines a transparent community building model with MGX token distribution, staking, and future DeFi, NFT, gaming, helping concept, and metaverse integrations.

## Problem
Traditional MLM and referral systems often suffer from:

- Limited transparency in payout logic.
- Centralized accounting that users cannot independently verify.
- Weak long-term utility beyond recruitment.
- Poor visibility into tree placement, income routing, and recovery workflows.
- Limited integration with tokenized economies.

## Solution
MetaGuildX uses smart contracts on opBNB Mainnet to create an auditable community building platform. The system connects:

- Community Building (C&B): registration, binary placement, referral income, upgrade, rebirth, and cashback.
- MGX token rewards: fixed-supply token allocations distributed through a box release system.
- Staking: deployed MGXStaking contract with reward pool and lock-period multipliers.
- Future utility: NFT creation, NFT marketplace, MGX DEX, gaming platform, helping concept, and metaverse.

## Deployment Snapshot
| Item | Status |
| --- | --- |
| Chain | VERIFIED: opBNB Mainnet |
| MGXToken | VERIFIED: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| Core | VERIFIED: `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` |
| MGXStaking | VERIFIED: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |
| TokenEngine | VERIFIED: `0xD3f119B64B72303F3fd3749a314E902D92fc75cd` |
| Contract owner | VERIFIED: Gnosis Safe `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` |
| Active users | VERIFIED: 144+ |
| Total MGX distributed | VERIFIED: 9,780 MGX across 144 users |

## Ecosystem Overview
MetaGuildX is designed as an eight-phase ecosystem:

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

## Community Building Model
The Community Building platform includes five income types:

| Income Type | Description |
| --- | --- |
| Direct income | Income from direct referrals. |
| Level income | Income across 10 levels. |
| Staking income | MGX rewards through MGXStaking. |
| Spillover income | Income related to placement spillover mechanics. |
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

## Binary System
VERIFIED: MetaGuildX uses a binary placement model with left and right branches.

The binary tree supports:

- User placement under sponsors.
- Branch tracking for left and right team growth.
- Spillover mechanics.
- Surrender handling and tree recovery logic.

UNKNOWN: Public documentation for every placement edge case is not finalized.

## Cashback System
VERIFIED: Cashback is connected to surrender behavior and funded by 4% of new joins when surrendered users exist.

Key design points:

- Surrender window: 3 to 6 months.
- Cashback share: 4% of new joins.
- Cashback accrual is intended for surrendered users.
- When no surrendered users exist, the system uses creator fallback logic.

UNKNOWN: Public-facing examples for all cashback scenarios are not finalized.

## Upgrade and Rebirth
The platform supports package upgrades and rebirth mechanics.

Upgrade design:

- Users progress through the package ladder.
- Escrow and upgrade engine logic support automated upgrade flows.
- Upgrade income is routed through deployed contracts.

Rebirth design:

- Users may enter a rebirth flow according to contract rules.
- Rebirth users are represented as new user IDs while preserving operational links.
- Rebirth income distribution recovery has dedicated admin tooling.

UNKNOWN: Final user-facing rebirth education material is not complete.

## MGX Token Utility
MGX utility is expected across current and future phases:

| Utility | Status |
| --- | --- |
| Distribution reward | VERIFIED: 9,780 MGX distributed across 144 users |
| Staking | VERIFIED: MGXStaking deployed and reward pool funded |
| DEX | FUTURE WORK: Phase 5 |
| NFT creation | FUTURE WORK: Phase 3 |
| NFT marketplace | FUTURE WORK: Phase 4 |
| Gaming platform | FUTURE WORK: Phase 6 |

## Token Supply
VERIFIED: Total MGX supply is fixed at 511,750,000 MGX. `launchMinted=true`; no mint after launch.

| Allocation | Amount | Percent | Status |
| --- | ---: | ---: | --- |
| Community | 307,050,000 MGX | 60% | Core staged funding active |
| Liquidity | 102,350,000 MGX | 20% | Held in deployer wallet for Phase 5 DEX |
| Reserve | 102,350,000 MGX | 20% | Held in deployer wallet for future use |

## Security
VERIFIED security posture:

- opBNB Mainnet deployment.
- UUPS upgradeable architecture.
- All contracts owned by Gnosis Safe `0x6D01d1E9771193467B5fae47Ce8463d7060098eA`.
- Staged Core funding to reduce operational exposure.

UNKNOWN:

- Future DAO governance contract design.
- Final public incident response documentation.

## Governance
Current governance:

- VERIFIED: Gnosis Safe owns all contracts.
- VERIFIED: Deployer wallet is used as operational staging wallet.

Future governance:

- FUTURE WORK: Token voting may be introduced later.
- UNKNOWN: Snapshot, on-chain governance, quorum, proposal thresholds, and voting timelines are not finalized.

## Bridge Status
VERIFIED bridge decisions:

- LI.FI retained for non-opBNB chains.
- Owlto removed because SDK v0.2.5 has no opBNB pairs.
- Thirdweb rejected due to vendor lock-in and security concerns.
- opBNB route displays Coming Soon until a production-ready provider confirms USDT support.

## Unknowns and Non-Commitments
The following are intentionally not invented in this document:

- Exchange listing dates.
- DEX launch date.
- Reserve release schedule.
- Liquidity deployment schedule.
- Future governance voting parameters.
- NFT and gaming launch dates.

