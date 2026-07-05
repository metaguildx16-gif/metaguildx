# MGX Treasury Architecture

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from on-chain checks, deployed contracts, or scripts. |
| DESIGN NOTE | Current operational design rationale. |
| FUTURE WORK | Planned or expected later-phase work. |
| UNKNOWN | Not yet documented or not yet verified. |

## Treasury Overview
MetaGuildX uses staged token custody for MGX launch allocations.

VERIFIED:

- Total supply: 511,750,000 MGX.
- `mintLaunchAllocations` was called with `deployer.address` x 3.
- This was intentional according to deployment script verification.
- Deployer wallet is an operational staging wallet, not documented as permanent treasury.
- Core is funded only as needed for community distribution.

## Wallets and Contracts
| Entity | Address | Role |
| --- | --- | --- |
| Deployer staging wallet | `0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe` | Operational staging wallet |
| Gnosis Safe | `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` | Owns all contracts |
| Core | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` | Holds staged MGX for community distribution |
| MGXToken | `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` | Fixed-supply MGX token |
| MGXStaking | `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` | Staking reward pool contract |
| TokenEngine | `0xD3f119B64B72303F3fd3749a314E902D92fc75cd` | MGX allocation engine |

## Verified Balances and Allocations
| Bucket / Holder | Amount | Notes |
| --- | ---: | --- |
| Total supply | 511,750,000 MGX | Fixed; no mint after launch |
| Community allocation | 307,050,000 MGX | 60% |
| Liquidity allocation | 102,350,000 MGX | 20%; held in deployer wallet for Phase 5 DEX |
| Reserve allocation | 102,350,000 MGX | 20%; held in deployer wallet for future use |
| Deployer staging wallet | 481,515,310 MGX | Operational staging balance |
| Core | 19,990,220 MGX | Staged community distribution balance |
| Staking rewardPool | 10,235,000 MGX | Funded |
| Distributed to users | 9,780 MGX | Across 144 users |

## Why Deployer Holds 481M MGX
DESIGN NOTE:

The deployer wallet holds a large MGX balance because launch allocations were minted to the deployer address intentionally as an operational staging model.

This design supports:

- Staged funding of Core rather than sending the full community allocation at once.
- Liquidity allocation custody until Phase 5 DEX work is ready.
- Reserve custody until a future reserve policy is finalized.

This does not mean the deployer wallet is the permanent treasury structure.

## Core Staged Funding
VERIFIED:

- Core currently holds 19,990,220 MGX.
- Core distributes MGX through platform activity.
- Only part of the community allocation is staged in Core.

DESIGN NOTE:

Staged funding reduces unnecessary exposure by keeping only operationally needed MGX inside Core.

UNKNOWN:

- Formal minimum Core balance threshold.
- Formal refill schedule.
- Public refill policy.

## Liquidity Allocation
VERIFIED:

- Liquidity allocation is 102,350,000 MGX.
- It is currently held in the deployer staging wallet.
- It is reserved for Phase 5 DEX.

FUTURE WORK:

- Separate liquidity wallet.
- DEX pair planning.
- Liquidity deployment process.
- Public liquidity policy.

UNKNOWN:

- DEX launch date.
- Pair ratio.
- Liquidity lock design.

## Reserve Allocation
VERIFIED:

- Reserve allocation is 102,350,000 MGX.
- It is currently held in the deployer staging wallet.
- It is reserved for future use.

FUTURE WORK:

- Separate reserve wallet.
- Reserve governance policy.
- Reserve release policy.

UNKNOWN:

- Reserve release schedule.
- Reserve usage categories.

## Future Migration Model
When DEX and reserve operations mature, the expected future direction is:

1. Keep Gnosis Safe ownership for contracts.
2. Separate liquidity funds into a dedicated liquidity wallet.
3. Separate reserve funds into a dedicated reserve wallet.
4. Document wallet purposes publicly.
5. Publish operational procedures for each transfer.

No timeline is invented or committed here.

## Risk Notes
- Deployer staging wallet concentration should be reduced over time through documented wallet separation.
- Core refill operations should be monitored.
- Liquidity and reserve movements should be recorded with transaction hashes.
- Any owner-only operation should go through Gnosis Safe when contract permissions are involved.

