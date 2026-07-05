# MGX Token Launch Runbook

## Purpose
This runbook documents the current MGX token deployment state and future operational procedures. It is documentation only and does not authorize execution of any operation.

## Status Legend
| Label | Meaning |
| --- | --- |
| COMPLETE | Verified deployed or already active. |
| PENDING | Future action required before use. |
| DO NOT EXECUTE YET | Operationally available but intentionally deferred. |
| UNKNOWN | Not yet documented or not yet verified. |

## Current Deployment State
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

## What Is Complete
- MGXToken is deployed.
- Launch mint is complete.
- Total supply is fixed at 511,750,000 MGX.
- Core, TokenEngine, and MGXStaking are deployed.
- All contracts are owned by Gnosis Safe.
- Core has staged community allocation funding.
- Staking reward pool is funded with 10,235,000 MGX.
- Community Building Platform is live on opBNB Mainnet.

## What Requires Future Action
| Item | Status | Notes |
| --- | --- | --- |
| DEX listing | PENDING | Phase 5 MGX DEX is future work. |
| Liquidity deployment | PENDING | 102,350,000 MGX held in deployer wallet for Phase 5 DEX. |
| Reserve wallet separation | PENDING | 102,350,000 MGX held in deployer wallet for future use. |
| Core refill monitoring | PENDING operational routine | Core currently holds 19,990,220 MGX. |
| Staking public activation | DO NOT EXECUTE YET | Staking contract deployed and funded, but broad activation is deferred. |
| Public liquidity/reserve release schedule | UNKNOWN | No documented release schedule. |

## Future Token Operation Checklist
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

## Core Refill Procedure
Status: PENDING operational routine.

Use only when Core MGX balance is low enough to require additional staged community allocation.

Checklist:

1. Verify Core address: `0xE3cD200609E223c96987c9FEa41C6014e8625c2F`.
2. Verify MGXToken address: `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81`.
3. Verify current Core MGX balance.
4. Verify deployer staging wallet balance.
5. Determine refill amount based on expected near-term distribution need.
6. Transfer MGX from staging wallet to Core.
7. Verify Core balance after transfer.
8. Record transaction hash in operations log.

UNKNOWN:

- Minimum Core balance threshold is not documented in this runbook.
- Refill amount policy is not finalized.

## Staking Activation Procedure
Status: DO NOT EXECUTE YET.

Staking contract is deployed and reward pool is funded, but public activation is deferred.

Prerequisites:

1. Confirm UI completion.
2. Confirm staking education material.
3. Confirm rewardPool balance: 10,235,000 MGX funded.
4. Confirm current totalStaked and test stake state.
5. Confirm launch announcement plan.
6. Confirm support and monitoring readiness.
7. Confirm operational policy for rewardPool refill or pause conditions.

Activation steps, when approved:

1. Final review of MGXStaking configuration.
2. Final UI QA on desktop and mobile wallets.
3. Public announcement.
4. Enable staking UI if currently hidden or restricted.
5. Monitor stake, claim, compound, and withdraw activity.
6. Monitor rewardPool depletion.

## DEX Listing / Liquidity Preparation
Status: PENDING.

VERIFIED allocation:

- Liquidity allocation: 102,350,000 MGX.
- Current holder: deployer staging wallet.
- Purpose: Phase 5 DEX.

UNKNOWN:

- DEX launch date.
- Pair configuration.
- Initial liquidity ratio.
- Liquidity lock policy.

## Reserve Management
Status: PENDING.

VERIFIED allocation:

- Reserve allocation: 102,350,000 MGX.
- Current holder: deployer staging wallet.
- Purpose: future use.

UNKNOWN:

- Reserve wallet separation date.
- Reserve use policy.
- Reserve release schedule.

## Emergency Notes
- Contract owner is Gnosis Safe.
- Owner-only operations require multisig coordination.
- Deployer wallet is operational staging, not a replacement for owner governance.
- No private keys or signer secrets should be stored in this document.

