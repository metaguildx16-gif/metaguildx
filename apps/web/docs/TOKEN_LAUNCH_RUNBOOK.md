# MGX Token Launch Runbook

## Documentation Version: v1.0 — Architecture Freeze
This runbook documents the live token deployment and separates completed protocol state from future Foundation operations.

## Status Legend
| Label | Meaning |
| --- | --- |
| COMPLETE | Verified deployed or already active. |
| PENDING | Future action required before use. |
| POLICY | Operational decision managed by the Foundation. |
| UNKNOWN | Not yet documented or not yet verified. |

## Protocol Specification (Immutable)

### Current Deployment State
| Component | Address / Value | Status |
| --- | --- | --- |
| MGXToken | `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` | COMPLETE |
| Core | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` | COMPLETE |
| MGXStaking | `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` | COMPLETE |
| TokenEngine | `0xD3f119B64B72303F3fd3749a314E902D92fc75cd` | COMPLETE |
| Gnosis Safe owner | `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` | COMPLETE |
| Deployer staging wallet | `0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe` | COMPLETE |
| Active users | 144+ | COMPLETE |
| Total MGX distributed | 9,780 MGX | COMPLETE |

### Completed Steps
- MGXToken is deployed.
- Launch mint is complete.
- Total supply is fixed at 511,750,000 MGX.
- Core, TokenEngine, and MGXStaking are deployed.
- All contracts are owned by Gnosis Safe.
- Core has staged community allocation funding.
- Staking reward pool is funded with 10,235,000 MGX.
- MGXStaking is deployed and operational.
- Community Building Platform is live on opBNB Mainnet.

### Current Token State
| Item | Value |
| --- | --- |
| Current Box | VERIFIED: Box 1 |
| Box 1 price | VERIFIED: $1.00/MGX |
| MGX distributed | VERIFIED: 9,780 MGX |
| Core MGX balance | VERIFIED: 19,990,220 MGX |
| Staking rewardPool | VERIFIED: 10,235,000 MGX |
| totalStaked | VERIFIED: 40 MGX, test only |

## Foundation Policy (Evolving)

### Future Action Register
| Item | Status | Notes |
| --- | --- | --- |
| DEX listing | PENDING | Phase 5 MGX DEX is future work. |
| Liquidity deployment | PENDING | Future DEX component remains policy-controlled. |
| Reserve wallet separation | PENDING | Reserve currently held in deployer staging wallet. |
| Core refill monitoring | POLICY | Foundation monitors Core MGX balance and operational reserves. |
| Broader staking activation | POLICY | Staking is deployed and operational; timing depends on adoption and readiness. |
| Public liquidity/reserve release schedule | UNKNOWN | No documented release schedule. |

### Future Token Operation Checklist
Before any future token operation:

1. Confirm the target chain is opBNB Mainnet.
2. Confirm contract ownership is still Gnosis Safe.
3. Confirm the exact contract address from deployed-address records.
4. Confirm the token balance of source wallet or contract.
5. Confirm the intended destination address.
6. Prepare a transaction simulation or dry-run when tooling supports it.
7. Review operation with multisig signers.
8. Submit through Gnosis Safe when owner privileges are required.
9. Verify transaction receipt and event logs.
10. Update this runbook with the result.

### Core Refill Procedure
Status: POLICY.

The Foundation monitors Core MGX balance and maintains operational reserves. Refill thresholds are operational decisions that may evolve with growth.

Checklist:

1. Verify Core address: `0xE3cD200609E223c96987c9FEa41C6014e8625c2F`.
2. Verify MGXToken address: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81`.
3. Verify current Core MGX balance.
4. Verify deployer staging wallet balance.
5. Determine refill amount based on current operational policy.
6. Transfer MGX from staging wallet to Core when approved.
7. Verify Core balance after transfer.
8. Record transaction hash in operations log.

### Staking Operations Procedure
Status: POLICY.

MGXStaking contract is deployed and operational. The Foundation monitors adoption metrics to determine optimal timing for broader community staking activation.

Operational checklist:

1. Confirm MGXStaking address: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3`.
2. Confirm rewardPool balance: 10,235,000 MGX funded.
3. Confirm current totalStaked and test stake state.
4. Confirm staking UI and mobile wallet readiness.
5. Confirm support and monitoring readiness.
6. Confirm public announcement plan.
7. Monitor stake, claim, compound, and withdraw activity.
8. Monitor rewardPool depletion.

### DEX Listing / Liquidity Preparation
Status: PENDING.

VERIFIED:

- Liquidity allocation is 102,350,000 MGX.
- A staking rewardPool of 10,235,000 MGX is already funded.
- Future DEX liquidity remains future work.

UNKNOWN:

- DEX launch date.
- Pair configuration.
- Initial liquidity ratio.
- Liquidity lock policy.

### Reserve Management
Status: POLICY.

VERIFIED:

- Reserve allocation is 102,350,000 MGX.
- Current holder is deployer staging wallet.

UNKNOWN:

- Reserve wallet separation date.
- Reserve use policy.
- Reserve release schedule.

### Emergency Notes
- Contract owner is Gnosis Safe.
- Owner-only operations require multisig coordination.
- Deployer wallet is operational staging, not a replacement for owner governance.
- No private keys or signer secrets should be stored in this document.

