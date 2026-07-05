# MetaGuildX Architecture Decisions

## Decision Log Format
Each decision includes:

- Date.
- Decision.
- Status.
- Rationale.
- Future review trigger.

## 2026-07-05: Bridge Provider Adapter Pattern
| Field | Value |
| --- | --- |
| Decision | Use a Provider Adapter Pattern for the cross-chain bridge module. |
| Status | ACTIVE |
| Files | `bridge/types.ts`, `bridge/registry.ts`, `bridge/index.ts` |

### Rationale
The adapter pattern keeps bridge providers isolated behind `IBridgeProvider`. This allows MetaGuildX to keep the UI stable while changing provider routing later.

### Current Provider State
| Adapter | Status | Notes |
| --- | --- | --- |
| LiFiAdapter | ACTIVE | Used for supported non-opBNB routes via LI.FI API. |
| BNBBridgeAdapter | REFERENCE ONLY | Kept as reference implementation, not registered. |
| OwltoAdapter | REMOVED | SDK v0.2.5 has no opBNB pairs. |
| ThirdwebAdapter | REJECTED | Vendor lock-in and security concerns. |

### Future Review Trigger
Review when LI.FI, Owlto, or another provider confirms production-ready opBNB USDT support.

## 2026-07-05: LI.FI Retained for Non-opBNB Routes
| Field | Value |
| --- | --- |
| Decision | Retain LI.FI for active non-opBNB swaps. |
| Status | ACTIVE |
| Provider | LI.FI API at `li.quest/v1` |
| Fee | 0.15% to treasury wallet |

### Rationale
LI.FI provides broad route support for major chains while avoiding custom bridge contract execution risk.

### Supported Route Scope
Active route examples:

- BSC to Ethereum.
- BSC to Polygon.
- BSC to Arbitrum.
- BSC to Avalanche.
- BSC to Linea.
- Other LI.FI-supported chains.

## 2026-07-05: opBNB Bridge Coming Soon
| Field | Value |
| --- | --- |
| Decision | Show opBNB bridge route as Coming Soon. |
| Status | ACTIVE |

### Rationale
LI.FI has no opBNB routes and returns API error 1002. Owlto SDK v0.2.5 does not include opBNB pairs. Thirdweb was rejected.

The UI should avoid broken routes, redirects, and disabled dead-end buttons.

### Future Review Trigger
Enable opBNB route only after a production-ready provider confirms USDT support.

## 2026-07-05: Token Distribution Uses Staged Core Funding
| Field | Value |
| --- | --- |
| Decision | Fund Core in stages rather than depositing all community MGX at once. |
| Status | ACTIVE |

### Rationale
Staged funding limits operational exposure and allows Core to hold only the MGX required for near-term platform distribution.

### Verified Facts
- Community allocation: 307,050,000 MGX.
- Core currently holds 19,990,220 MGX.
- Total distributed: 9,780 MGX across 144 users.

### Future Review Trigger
Review when Core balance approaches an operational refill threshold. The threshold is not documented yet.

## 2026-07-05: Deployer Staging Treasury Model
| Field | Value |
| --- | --- |
| Decision | Use deployer wallet as operational staging wallet after launch mint. |
| Status | ACTIVE |

### Rationale
Deployment scripts verified that `mintLaunchAllocations` was called with `deployer.address` x 3 intentionally.

The deployer wallet currently stages:

- Liquidity allocation for Phase 5 DEX.
- Reserve allocation for future use.
- Remaining operational MGX not yet staged into Core.

### Future Review Trigger
Review when DEX liquidity operations begin or reserve governance policy is finalized.

## 2026-07-05: Staking Activation Deferred
| Field | Value |
| --- | --- |
| Decision | Keep staking deployed and funded, but defer broad public activation. |
| Status | ACTIVE |

### Rationale
The staking contract is deployed and funded, but current totalStaked is only 40 MGX and marked as test only. Public activation should wait for meaningful user base, UI readiness, monitoring, support, and announcement.

### Verified Facts
- MGXStaking: `0xD18E7b23AeD67340bf974311d490cd4b903e26A3`.
- Reward pool: 10,235,000 MGX.
- Reward rate: 3 bps, 0.03% per day.
- Lock periods: 30, 90, 180, 365, 730 days.

### Future Review Trigger
Review when staking UI, education, and monitoring are complete.

