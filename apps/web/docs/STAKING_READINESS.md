# MGX Staking Readiness

## Status Legend
| Label | Meaning |
| --- | --- |
| FACT | Verified from deployment state or provided contract facts. |
| ASSUMPTION | Operational interpretation that requires final approval. |
| UNKNOWN | Not yet documented or not yet verified. |
| PENDING | Future action required. |

## Deployment Confirmation
| Item | Value |
| --- | --- |
| Contract | FACT: MGXStaking |
| Address | FACT: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |
| Chain | FACT: opBNB Mainnet |
| Owner | FACT: Gnosis Safe `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` |
| Reward pool | FACT: 10,235,000 MGX funded |
| totalStaked | FACT: 40 MGX, test only |
| rewardRate | FACT: 3 bps, 0.03% per day |

## Contract Feature List
FACT: MGXStaking supports the following documented features:

- MGX staking positions.
- Reward pool funding.
- Daily reward rate accounting.
- Lock periods.
- Lock multipliers.
- Claim, compound, withdraw, and add-to-stake style flows.
- Action fee for withdraw/add-to-stake.
- Treasury top-up variables reserved for future use.

## Lock Periods and Multipliers
FACT:

| Lock Period | Multiplier Range |
| --- | --- |
| 30 days | 100% |
| 90 days | Within 100% to 115% range |
| 180 days | Within 100% to 115% range |
| 365 days | Within 100% to 115% range |
| 730 days | 115% |

UNKNOWN:

- Final public table mapping each exact period to each exact multiplier is not included in the verified facts supplied for this document.

## Release and Fee Parameters
FACT:

| Parameter | Value |
| --- | ---: |
| DAILY_RELEASE_BPS | 10, equal to 0.1% per day |
| rewardRate | 3 bps, equal to 0.03% per day |
| Action fee | 20% |

## Current State
FACT:

- Staking contract is deployed.
- Reward pool is funded with 10,235,000 MGX.
- Only 40 MGX is currently staked and this is test activity.
- Platform has 144+ active users.

## Why Staking Is Not Fully Enabled Now
ASSUMPTION:

Staking should not be broadly promoted until there is enough user adoption to make reward distribution meaningful and operationally stable.

Reasons:

- Current totalStaked is only 40 MGX and marked as test only.
- Public staking requires education, support, and monitoring readiness.
- RewardPool depletion monitoring should be visible before full launch.
- Staking UI and user instructions should be complete before announcement.

## Readiness Prerequisites
| Prerequisite | Status |
| --- | --- |
| Contract deployed | FACT: complete |
| RewardPool funded | FACT: complete |
| UI completion | PENDING |
| Public staking guide | PENDING |
| Support readiness | PENDING |
| RewardPool monitoring | PENDING |
| Minimum adoption threshold | UNKNOWN |
| Launch announcement | PENDING |

## Activation Checklist
Before enabling staking publicly:

1. Verify MGXStaking address and owner.
2. Verify rewardPool balance.
3. Verify totalStaked and remove or account for test stake context.
4. Verify front-end staking UI.
5. Verify mobile wallet compatibility.
6. Verify claim, compound, withdraw, and add-to-stake flows.
7. Verify action fee wording.
8. Publish staking education material.
9. Set monitoring for rewardPool depletion.
10. Announce activation.

## Monitoring Requirements
PENDING monitoring:

- rewardPool balance.
- totalStaked.
- Daily claim volume.
- Compound volume.
- Withdraw volume.
- Failed claim or withdraw transactions.
- Large individual staking positions.

## Known Unknowns
- Public staking launch date.
- Exact adoption threshold.
- Final marketing and education schedule.
- Long-term rewardPool refill policy.

