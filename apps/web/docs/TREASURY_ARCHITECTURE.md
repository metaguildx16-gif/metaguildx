# MGX Treasury Architecture

## Documentation Version: v1.0 — Architecture Freeze
This document separates verified treasury facts from Foundation operating policy.

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or scripts. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Planned or expected later-phase work. |

## Protocol Specification (Immutable)

### Treasury Overview
VERIFIED:

- Total supply: 511,750,000 MGX.
- `mintLaunchAllocations` was called with `deployer.address` x 3.
- This was intentional according to deployment script verification.
- Deployer wallet is an operational staging wallet, not documented as permanent treasury.
- Core is funded in stages for community distribution.

### Wallets and Contracts
| Entity | Address | Role |
| --- | --- | --- |
| Deployer staging wallet | `0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe` | Operational staging wallet |
| Gnosis Safe | `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` | Owns all contracts |
| Core | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` | Holds staged MGX for community distribution |
| MGXToken | `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` | Fixed-supply MGX token |
| MGXStaking | `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` | Staking reward pool contract |
| TokenEngine | `0xD3f119B64B72303F3fd3749a314E902D92fc75cd` | MGX allocation engine |

### Verified Balances and Allocations
| Bucket / Holder | Amount | Notes |
| --- | ---: | --- |
| Total supply | 511,750,000 MGX | Fixed; no mint after launch |
| Community allocation | 307,050,000 MGX | 60% |
| Liquidity allocation | 102,350,000 MGX | 20%; includes staking pool and future DEX policy split |
| Reserve allocation | 102,350,000 MGX | 20%; held in deployer staging wallet for future use |
| Deployer staging wallet | 481,515,310 MGX | Operational staging balance |
| Core | 19,990,220 MGX | Staged community distribution balance |
| Staking rewardPool | 10,235,000 MGX | Funded |
| Distributed to users | 9,780 MGX | Across 144 users |

### Why Deployer Holds 481M MGX
VERIFIED: Launch allocations were minted to the deployer address intentionally as an operational staging model.

This staging model currently holds:

- Community allocation not yet staged into Core.
- Liquidity allocation pending future DEX operations.
- Reserve allocation pending future reserve policy.

This does not make the deployer wallet the permanent treasury structure.

## Foundation Policy (Evolving)

### Core Staged Funding Policy
The Foundation monitors Core MGX balance and maintains operational reserves. Refill thresholds are operational decisions that may evolve with growth.

Current verified state:

- Core currently holds 19,990,220 MGX.
- Core distributes MGX through platform activity.
- Only part of the community allocation is staged in Core.

### Liquidity Policy
VERIFIED:

- Liquidity allocation is 102,350,000 MGX.
- It is currently held in the deployer staging wallet.

Foundation policy:

- A portion of the liquidity allocation is already represented by the funded staking rewardPool.
- A future DEX liquidity component is reserved for Phase 5 DEX.
- Liquidity wallet separation is future work.

UNKNOWN:

- DEX launch date.
- Pair ratio.
- Liquidity lock design.

### Reserve Utilization Policy
VERIFIED:

- Reserve allocation is 102,350,000 MGX.
- It is currently held in the deployer staging wallet.

Foundation policy:

- Reserve utilization is not a hard allocation schedule.
- Reserve use should be governed by ecosystem needs, treasury sustainability, and future governance decisions.
- Reserve wallet separation is future work.

UNKNOWN:

- Reserve release schedule.
- Reserve usage categories.

### Future Migration Model
When DEX and reserve operations mature, the Foundation may:

1. Keep Gnosis Safe ownership for contracts.
2. Separate liquidity funds into a dedicated liquidity wallet.
3. Separate reserve funds into a dedicated reserve wallet.
4. Document wallet purposes publicly.
5. Publish operational procedures for each transfer.

No timeline is committed here.

### Risk Notes
- Deployer staging wallet concentration should reduce over time through documented wallet separation.
- Core refill operations should be monitored.
- Liquidity and reserve movements should be recorded with transaction hashes.
- Owner-only contract operations should go through Gnosis Safe.

