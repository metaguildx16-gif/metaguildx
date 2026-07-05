# MGX Staking Readiness

## Documentation Version: v1.0 — Architecture Freeze
This document reflects deployed staking state and separates contract facts from Foundation activation policy.

## Status Legend
| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed from deployment state or supplied contract facts. |
| UNKNOWN | Not yet documented or not yet verified. |
| FUTURE WORK | Future operational or governance decision. |

## Protocol Specification (Immutable)

### Deployment Confirmation
| Item | Value |
| --- | --- |
| Contract | VERIFIED: MGXStaking |
| Address | VERIFIED: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |
| Chain | VERIFIED: opBNB Mainnet |
| Owner | VERIFIED: Gnosis Safe `0x6D01d1E9771193467B5fae47Ce8463d7060098eA` |
| Initial rewardPool tranche | VERIFIED: 10,235,000 MGX funded |
| Full staking pool allocation | VERIFIED: 51,175,000 MGX, staged release from liquidity allocation |
| Remaining staking pool to fund | VERIFIED: 40,940,000 MGX staged |
| totalStaked | VERIFIED: 40 MGX, test only |
| rewardRate | VERIFIED: 3 bps, 0.03% per day |

### Operational Status
VERIFIED: MGXStaking contract is deployed and operational.

Current state:

- Initial tranche funded: 10,235,000 MGX.
- Full allocation: 51,175,000 MGX, staged release from liquidity allocation.
- Remaining staking pool to fund: 40,940,000 MGX.
- 40 MGX is staked as test activity.
- The contract supports staking operations.
- Broader community activation is a Foundation policy decision, not a deployment blocker.

### Contract Feature List
VERIFIED feature set:

- MGX staking positions.
- Reward pool funding.
- Daily reward rate accounting.
- Lock periods.
- Lock multipliers.
- Claim, compound, withdraw, and add-to-stake style flows.
- Action fee for withdraw/add-to-stake.
- Treasury top-up variables reserved for future use.

### Lock Periods and Multipliers
VERIFIED:

| Lock Period | Multiplier |
| --- | --- |
| 30 days | 100% |
| 90 days | Within verified 100% to 115% range |
| 180 days | Within verified 100% to 115% range |
| 365 days | Within verified 100% to 115% range |
| 730 days | 115% |

UNKNOWN: A public table mapping every intermediate lock period to its exact deployed multiplier was not included in the supplied verified facts.

### Reward and Fee Parameters
VERIFIED:

| Parameter | Value |
| --- | ---: |
| rewardRate | 3 bps, equal to 0.03% per day |
| DAILY_RELEASE_BPS | 10, release parameter separate from staking rewardRate |
| Action fee | 20% |

## Foundation Policy (Evolving)

### Staking Rate Policy
The staking reward rate is currently set at 0.03% per day. The Foundation may adjust this rate through future governance decisions as ecosystem revenue and treasury sustainability evolve.

### Community Activation Policy
MGXStaking contract is deployed and operational. The Foundation monitors adoption metrics to determine optimal timing for broader community staking activation.

### Readiness Prerequisites
| Prerequisite | Status |
| --- | --- |
| Contract deployed | VERIFIED: complete |
| Initial RewardPool tranche funded | VERIFIED: 10,235,000 MGX |
| Full staking pool allocation | VERIFIED: 51,175,000 MGX staged |
| Test stake present | VERIFIED: 40 MGX |
| UI completion | FUTURE WORK |
| Public staking guide | FUTURE WORK |
| Support readiness | FUTURE WORK |
| RewardPool monitoring | FUTURE WORK |
| Minimum adoption threshold | UNKNOWN |
| Launch announcement | FUTURE WORK |

### Activation Checklist
Before broader public activation:

1. Verify MGXStaking address and owner.
2. Verify rewardPool balance.
3. Verify totalStaked and test stake context.
4. Verify front-end staking UI.
5. Verify mobile wallet compatibility.
6. Verify claim, compound, withdraw, and add-to-stake flows.
7. Verify action fee wording.
8. Publish staking education material.
9. Set monitoring for rewardPool depletion.
10. Announce activation when Foundation policy criteria are met.

### Monitoring Requirements
FUTURE WORK:

- rewardPool balance.
- totalStaked.
- Daily claim volume.
- Compound volume.
- Withdraw volume.
- Failed claim or withdraw transactions.
- Large individual staking positions.

### Remaining Open Items
- Public staking activation timing.
- Minimum adoption threshold.
- Final education schedule.
- Long-term rewardPool refill policy.
