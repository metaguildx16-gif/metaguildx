# MetaGuildX Architecture Decisions

## Documentation Version: v1.0 — Architecture Freeze
This decision log separates deployed architecture from Foundation policy decisions.

## Decision Log Format
Each decision includes:

- Date.
- Decision.
- Status.
- Rationale.
- Future review trigger.

## Protocol Specification (Immutable)

### 2026-07-05: Bridge Provider Adapter Pattern
| Field | Value |
| --- | --- |
| Decision | Use a Provider Adapter Pattern for the cross-chain bridge module. |
| Status | ACTIVE |
| Files | `bridge/types.ts`, `bridge/registry.ts`, `bridge/index.ts` |

#### Rationale
The adapter pattern keeps bridge providers isolated behind `IBridgeProvider`. This allows MetaGuildX to keep the UI stable while changing provider routing later.

#### Current Provider State
| Adapter | Status | Notes |
| --- | --- | --- |
| LiFiAdapter | ACTIVE | Used for supported non-opBNB routes via LI.FI API. |
| BNBBridgeAdapter | REFERENCE ONLY | Kept as reference implementation, not registered. |
| OwltoAdapter | REMOVED | SDK v0.2.5 has no opBNB pairs. |
| ThirdwebAdapter | REJECTED | Vendor lock-in and security concerns. |

### 2026-07-05: LI.FI Retained for Non-opBNB Routes
| Field | Value |
| --- | --- |
| Decision | Retain LI.FI for active non-opBNB swaps. |
| Status | ACTIVE |
| Provider | LI.FI API at `li.quest/v1` |
| Fee | 0.15% to treasury wallet |

#### Rationale
LI.FI provides broad route support for major chains while avoiding custom bridge contract execution risk.

#### Supported Route Scope
- BSC to Ethereum.
- BSC to Polygon.
- BSC to Arbitrum.
- BSC to Avalanche.
- BSC to Linea.
- Other LI.FI-supported chains.

### 2026-07-05: opBNB Bridge Coming Soon
| Field | Value |
| --- | --- |
| Decision | Show opBNB bridge route as Coming Soon. |
| Status | ACTIVE |

#### Rationale
LI.FI has no opBNB routes and returns API error 1002. Owlto SDK v0.2.5 does not include opBNB pairs. Thirdweb was rejected.

The UI should avoid broken routes, redirects, and disabled dead-end buttons.

## Foundation Policy (Evolving)

### 2026-07-05: Staking Rate Policy
| Field | Value |
| --- | --- |
| Decision | Use deployed staking rewardRate as current policy baseline. |
| Status | ACTIVE |

#### Rationale
The staking reward rate is currently set at 0.03% per day. The Foundation may adjust this rate through future governance decisions as ecosystem revenue and treasury sustainability evolve.

#### Future Review Trigger
Review as ecosystem revenue, staking adoption, and treasury sustainability mature.

### 2026-07-05: Staking Activation Policy
| Field | Value |
| --- | --- |
| Decision | Treat staking as deployed and operational, with broader activation governed by adoption metrics. |
| Status | ACTIVE |

#### Rationale
MGXStaking contract is deployed and operational. The Foundation monitors adoption metrics to determine optimal timing for broader community staking activation.

#### Verified Facts
- MGXStaking: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3`.
- Reward pool initial tranche: 10,235,000 MGX.
- Full staking pool allocation: 51,175,000 MGX.
- Remaining staking pool to fund: 40,940,000 MGX staged.
- Reward rate: 3 bps, 0.03% per day.
- totalStaked: 40 MGX, test only.

### 2026-07-05: Distribution Lifecycle Policy
| Field | Value |
| --- | --- |
| Decision | Transition from distribution incentives to utility after full community distribution. |
| Status | ACTIVE |

#### Rationale
Upon full community distribution, the protocol transitions from token distribution incentives to token utility. The Foundation may establish buyback or redistribution mechanisms through governance at that stage.

NoTokensAvailable() is a platform maturity milestone, not a failure.

#### Future Review Trigger
Review as Box 10 completion approaches and utility products mature.

### 2026-07-05: Treasury Operating Policy
| Field | Value |
| --- | --- |
| Decision | Use staged Core funding and operational reserves instead of hard public refill thresholds. |
| Status | ACTIVE |

#### Rationale
The Foundation monitors Core MGX balance and maintains operational reserves. Refill thresholds are operational decisions that may evolve with growth.

#### Verified Facts
- Community allocation: 307,050,000 MGX.
- Core currently holds 19,990,220 MGX.
- Deployer staging wallet holds 481,515,310 MGX.
- `mintLaunchAllocations` used deployer address intentionally as staging.

### 2026-07-05: Governance Transition Roadmap
| Field | Value |
| --- | --- |
| Decision | Progressively decentralize governance as the platform matures. |
| Status | ACTIVE |

#### Rationale
Governance will progressively decentralize as the platform matures. Advisory participation begins in early phases; on-chain governance is planned for introduction alongside future DEX development.

#### Future Review Trigger
Review alongside future DEX development and token utility expansion.

### 2026-07-05: Token Distribution Uses Staged Core Funding
| Field | Value |
| --- | --- |
| Decision | Fund Core in stages rather than depositing all community MGX at once. |
| Status | ACTIVE |

#### Rationale
Staged funding limits operational exposure and allows Core to hold only the MGX required for near-term platform distribution.

#### Verified Facts
- Community allocation: 307,050,000 MGX.
- Core currently holds 19,990,220 MGX.
- Total distributed: 9,850 MGX across 144 users.

### 2026-07-05: Deployer Staging Treasury Model
| Field | Value |
| --- | --- |
| Decision | Use deployer wallet as operational staging wallet after launch mint. |
| Status | ACTIVE |

#### Rationale
Deployment scripts verified that `mintLaunchAllocations` was called with `deployer.address` x 3 intentionally.

The deployer wallet currently stages:

- Liquidity allocation split between staged staking pool funding and future DEX work.
- Reserve allocation for future use.
- Remaining operational MGX not yet staged into Core.

#### Future Review Trigger
Review when DEX liquidity operations begin or reserve governance policy is finalized.
