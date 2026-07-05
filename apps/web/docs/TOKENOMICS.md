# MGX Tokenomics

## Documentation Version: v1.0 — Architecture Freeze
This document separates immutable deployed tokenomics from Foundation policy. No verified deployed numbers are changed.

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or project scripts. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Planned or expected later-phase work, not active today. |

## Protocol Specification (Immutable)

### Token Identity
| Field | Value |
| --- | --- |
| Token | MGX |
| MGXToken address | VERIFIED: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| Chain | VERIFIED: opBNB Mainnet |
| Launch mint status | VERIFIED: `launchMinted=true` |
| Mint policy | VERIFIED: fixed supply; no mint after launch |

### Total Supply
VERIFIED total supply: 511,750,000 MGX.

| Allocation | Amount | Percent | Current Location / Purpose |
| --- | ---: | ---: | --- |
| Community | 307,050,000 MGX | 60% | Core staged funding; Core currently holds 19,990,220 MGX |
| Liquidity | 102,350,000 MGX | 20% | Subdivided into staking reward pool and future DEX liquidity |
| Reserve | 102,350,000 MGX | 20% | Deployer staging wallet; future use |

### Liquidity Allocation
The 20% liquidity allocation (102,350,000 MGX) is subdivided:

- 50% (51,175,000 MGX): Staking reward pool (initial tranche: 10,235,000 MGX funded).
- 50% (51,175,000 MGX): Future DEX liquidity (Phase 5).

| Sub-Bucket | Amount | Status |
| --- | ---: | --- |
| Staking reward pool | 51,175,000 MGX | Initial tranche of 10,235,000 MGX funded; 40,940,000 MGX remaining staged |
| Future DEX liquidity | 51,175,000 MGX | Held in deployer staging wallet pending future DEX work |

VERIFIED: MGXStaking rewardPool is currently funded with 10,235,000 MGX.

UNKNOWN: The full future release mechanics for the remaining staking bucket and future DEX bucket are not finalized.

### Current Holder Snapshot
| Holder | Address | Amount / Role |
| --- | --- | --- |
| Deployer | `0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe` | VERIFIED: 481,515,310 MGX |
| Core | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` | VERIFIED: 19,990,220 MGX |
| Gnosis Safe | `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` | VERIFIED: owns all contracts |

### Current Distribution Status
VERIFIED:

- Total distributed: 9,850 MGX.
- Users receiving distribution: 144 users.
- Community allocation: 307,050,000 MGX.

| Metric | Value |
| --- | ---: |
| Distributed MGX | 9,850 |
| Community allocation | 307,050,000 |
| Percent distributed | 0.003208% |

Calculation: 9,850 / 307,050,000 = approximately 0.003208%.

### Box Release System
VERIFIED box release system:

| Box | Price | Release Percent | MGX Amount |
| --- | ---: | ---: | ---: |
| 1 | $1.00 | 20% | 61,410,000 MGX |
| 2 | $1.25 | 15% | 46,057,500 MGX |
| 3 | $1.50 | 12% | 36,846,000 MGX |
| 4 | $1.75 | 10% | 30,705,000 MGX |
| 5 | $2.00 | 8% | 24,564,000 MGX |
| 6 | $2.25 | 8% | 24,564,000 MGX |
| 7 | $2.50 | 7% | 21,493,500 MGX |
| 8 | $2.75 | 7% | 21,493,500 MGX |
| 9 | $3.00 | 7% | 21,493,500 MGX |
| 10 | $3.25 | 6% | 18,423,000 MGX |

Current box:

- VERIFIED: Current Box is Box 1.
- VERIFIED: Box 1 price is $1.00/MGX.
- VERIFIED: Total USD to exhaust all boxes is $569,577,750.

### Package Ladder
| Package | Amount |
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

### Distribution Algorithm
VERIFIED high-level behavior:

- Users receive MGX allocations through TokenEngine.
- TokenEngine address: `0xD3f119B64B72303F3fd3749a314E902D92fc75cd`.
- Core contract is funded in stages and holds community MGX for active distribution.
- MGX allocation depends on package activity and the current box price.

### Income Model
| Income Type | Notes |
| --- | --- |
| Direct income | Direct income to upline |
| Level income | 10 levels x 4% |
| Staking income | MGX staking rewards |
| Spillover income | Placement-related spillover |
| Cross-line income | 5th X event income |

### Cashback Model
VERIFIED:

- Cashback is tied to surrender mechanics.
- Surrender window: 3 to 6 months.
- Cashback share: 4% of new joins.

### Staking Reward Model
VERIFIED:

- MGXStaking address: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3`.
- Staking rewardPool initial tranche: 10,235,000 MGX funded.
- Full staking pool allocation: 51,175,000 MGX.
- Remaining staking pool to fund: 40,940,000 MGX staged.
- totalStaked: 40 MGX, test only.
- rewardRate: 3 bps, equal to 0.03% per day.
- Lock periods: 30, 90, 180, 365, and 730 days.
- Multipliers: 100% to 115%.
- Action fee: 20% for withdraw/add-to-stake actions.

## Foundation Policy (Evolving)

### Staking Rate Policy
The staking reward rate is currently set at 0.03% per day. The Foundation may adjust this rate through future governance decisions as ecosystem revenue and treasury sustainability evolve.

### Staking Activation Policy
MGXStaking contract is deployed and operational. The Foundation monitors adoption metrics to determine optimal timing for broader community staking activation.

### Future Tokenomics Evolution
Upon full community distribution, the protocol transitions from token distribution incentives to token utility. The Foundation may establish buyback or redistribution mechanisms through governance at that stage.

Upon exhaustion of Box 10, the Foundation may establish buyback or redistribution mechanisms through governance. NoTokensAvailable() is a platform maturity milestone, not a failure.

### Treasury Policy
The Foundation monitors Core MGX balance and maintains operational reserves. Refill thresholds are operational decisions that may evolve with growth.

### Unknowns
- Public staking activation timing.
- Future DEX launch timing.
- Reserve release schedule.
- Final governance parameters.
