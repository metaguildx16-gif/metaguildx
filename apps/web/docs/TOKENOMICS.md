# MGX Tokenomics

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or project scripts. |
| ASSUMED | Reasonable interpretation from current design, not a finalized public commitment. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Planned or expected later-phase work, not active today. |

## Token Identity
| Field | Value |
| --- | --- |
| Token | MGX |
| MGXToken address | VERIFIED: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| Chain | VERIFIED: opBNB Mainnet |
| Launch mint status | VERIFIED: `launchMinted=true` |
| Mint policy | VERIFIED: fixed supply; no mint after launch |

## Total Supply
VERIFIED total supply: 511,750,000 MGX.

| Allocation | Amount | Percent | Current Location / Purpose |
| --- | ---: | ---: | --- |
| Community | 307,050,000 MGX | 60% | Core staged funding; Core currently holds 19,990,220 MGX |
| Liquidity | 102,350,000 MGX | 20% | Deployer wallet; reserved for Phase 5 DEX |
| Reserve | 102,350,000 MGX | 20% | Deployer wallet; future use |

## Current Holder Snapshot
| Holder | Address | Amount / Role |
| --- | --- | --- |
| Deployer | `0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe` | VERIFIED: 481,515,310 MGX |
| Core | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` | VERIFIED: 19,990,220 MGX |
| Gnosis Safe | `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` | VERIFIED: owns all contracts |

## Current Distribution Status
VERIFIED:

- Total distributed: 9,780 MGX.
- Users receiving distribution: 144 users.
- Community allocation: 307,050,000 MGX.

Distribution progress:

| Metric | Value |
| --- | ---: |
| Distributed MGX | 9,780 |
| Community allocation | 307,050,000 |
| Percent distributed | 0.003% |

Calculation: 9,780 / 307,050,000 = approximately 0.003%.

## Box Release System
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

## Distribution Algorithm
VERIFIED high-level behavior:

- Users receive MGX allocations through the TokenEngine.
- TokenEngine address: `0xD3f119B64B72303F3fd3749a314E902D92fc75cd`.
- Core contract is funded in stages and holds community MGX for active distribution.
- MGX allocation depends on package activity and the current box price.

UNKNOWN:

- Public mathematical examples for every package and box edge case are not finalized.
- Final public disclosure format for box transition events is not finalized.

## Package Ladder
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

## Income Model
The platform has five income types:

| Income Type | Notes |
| --- | --- |
| Direct income | Direct income to upline |
| Level income | 10 levels x 4% |
| Staking income | MGX staking rewards |
| Spillover income | Placement-related spillover |
| Cross-line income | 5th X event income |

## Cashback Model
VERIFIED:

- Cashback is tied to surrender mechanics.
- Surrender window: 3 to 6 months.
- Cashback share: 4% of new joins.

ASSUMED:

- Cashback is intended to be sustainable through ongoing new join activity and contract accounting caps.

UNKNOWN:

- Long-term public cashback utilization projections.

## Staking Reward Model
VERIFIED:

- MGXStaking address: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3`.
- Staking rewardPool: 10,235,000 MGX funded.
- totalStaked: 40 MGX, test only.
- rewardRate: 3 bps, equal to 0.03% per day.
- DAILY_RELEASE_BPS: 10, equal to 0.1% per day as per blueprint.
- Lock periods: 30, 90, 180, 365, and 730 days.
- Multipliers: 100% to 115%.
- Action fee: 20% for withdraw/add-to-stake actions.

UNKNOWN:

- Public staking launch date.
- Minimum user adoption threshold for activation.

## Treasury Structure
VERIFIED:

- `mintLaunchAllocations` was called with `deployer.address` x 3 intentionally.
- Deployer is an operational staging wallet, not documented as permanent treasury.
- Core is funded only as needed.
- Liquidity and reserve allocations remain in deployer wallet.

UNKNOWN:

- Final separated reserve wallet.
- Final separated liquidity wallet.
- Public release schedule for liquidity or reserve allocation.

