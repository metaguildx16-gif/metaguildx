# MGX Token Whitepaper

**Version 1.0 | MetaGuildX Protocol**

---

> This document is provided for informational purposes only. It does not constitute financial advice, investment advice, or a solicitation to purchase tokens. Participation in the MetaGuildX Protocol involves financial risk. Please conduct your own research before making any decisions.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Core Principles](#2-core-principles)
3. [Vision](#3-vision)
4. [MGX Token](#4-mgx-token)
5. [Token Supply and Allocation](#5-token-supply-and-allocation)
6. [Community Distribution — Box Release System](#6-community-distribution--box-release-system)
7. [Token Utility](#7-token-utility)
8. [Staking](#8-staking)
9. [Ecosystem Roadmap](#9-ecosystem-roadmap)
10. [Smart Contracts](#10-smart-contracts)
11. [Risk Disclosure](#11-risk-disclosure)
12. [Document Information](#12-document-information)

---

## 1. Introduction

MGX is the native utility token of the MetaGuildX Protocol — a fixed-supply, on-chain token deployed on opBNB Mainnet. The MGX Token is distributed to community participants through a transparent, contract-defined mechanism and is designed to serve as the economic foundation of a progressively expanding decentralized protocol.

The MetaGuildX Protocol is a community building protocol where all token distribution, staking mechanics, and reward flows are executed by publicly deployed smart contracts. Every allocation, distribution event, and staking position is verifiable on-chain by anyone.

This whitepaper describes the MGX Token: its fixed supply, allocation model, distribution mechanism, staking architecture, and protocol roadmap. All information is based on verified deployed contracts.

---

## 2. Core Principles

| Principle | Description |
|-----------|-------------|
| **Fixed Supply** | 511,750,000 MGX. No additional tokens can be minted. Enforced at the contract level. |
| **Public Smart Contracts** | All contracts are deployed on opBNB Mainnet and open to independent review. |
| **On-Chain Verification** | Token supply, balances, distribution state, and staking positions are verifiable on-chain. |
| **Transparent Distribution** | Community MGX is distributed through the Box Release System — a contract-defined, on-chain mechanism. |
| **Community Participation** | Token distribution begins from the first day of participation and is accessible to all community members. |
| **Progressive Decentralization** | Governance is designed to evolve toward increasing community participation and future on-chain decision-making as the protocol matures. |

---

## 3. Vision

The MGX Token is designed to:

- Reward community participants through a transparent, on-chain distribution system
- Enable staking with verifiable, contract-defined reward mechanics
- Serve as the shared economic layer across all MetaGuildX Protocol phases
- Maintain a permanent fixed supply with no inflationary mechanism

The MetaGuildX Protocol is built on the principle that every token allocation, distribution, and protocol action should be publicly verifiable on-chain.

---

## 4. MGX Token

| Property | Value |
|----------|-------|
| **Name** | MetaGuildX |
| **Symbol** | MGX |
| **Network** | opBNB Mainnet |
| **Chain ID** | 204 |
| **Contract** | `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| **Standard** | ERC-20 |
| **Total Supply** | 511,750,000 MGX |
| **Mint Policy** | Fixed — no additional minting possible |
| **Decimals** | 18 |

The total supply of 511,750,000 MGX was minted in a single launch transaction. The `launchMinted` flag is permanently set to `true`. No mechanism exists to create additional tokens. This is verifiable on the opBNB Mainnet block explorer.

---

## 5. Token Supply and Allocation

| Allocation | Amount | Share | Purpose |
|------------|--------|-------|---------|
| Community | 307,050,000 MGX | 60% | Distributed via on-chain Box Release System |
| Liquidity | 102,350,000 MGX | 20% | DEX liquidity and staking reward pool |
| Reserve | 102,350,000 MGX | 20% | Protocol development and future expansion |
| **Total** | **511,750,000 MGX** | **100%** | |

### Liquidity Allocation

The 20% liquidity allocation is divided equally:

- **51,175,000 MGX** — Staking reward pool. An initial tranche of 10,235,000 MGX is funded to the deployed staking contract. The remainder is staged for release as the protocol grows.
- **51,175,000 MGX** — DEX liquidity, reserved for the DEX phase of the roadmap.

### Reserve Allocation

The 20% reserve is allocated for protocol development, security, infrastructure, and future expansion. Reserve utilization is executed through the governance framework.

---

## 6. Community Distribution — Box Release System

Community MGX (307,050,000 MGX — 60% of total supply) is distributed through the Box Release System: a contract-defined, on-chain mechanism that progressively increases the distribution price per MGX Token as the protocol grows.

### Box Release Table

| Box | Price (USD/MGX) | Allocation | MGX Amount |
|-----|----------------|------------|------------|
| 1 | $1.00 | 20% | 61,410,000 |
| 2 | $1.25 | 15% | 46,057,500 |
| 3 | $1.50 | 12% | 36,846,000 |
| 4 | $1.75 | 10% | 30,705,000 |
| 5 | $2.00 | 8% | 24,564,000 |
| 6 | $2.25 | 8% | 24,564,000 |
| 7 | $2.50 | 7% | 21,493,500 |
| 8 | $2.75 | 7% | 21,493,500 |
| 9 | $3.00 | 7% | 21,493,500 |
| 10 | $3.25 | 6% | 18,423,000 |
| **Total** | — | **100%** | **307,050,000** |

The total protocol volume required to exhaust the entire community allocation across all ten boxes is approximately **$569,577,750**.

Box advancement is fully automatic. When a box's allocation is exhausted, the smart contract advances to the next box without manual intervention. The distribution price increases across boxes, reflecting protocol maturity.

### Distribution Lifecycle

When the Box 10 allocation is fully distributed, the MetaGuildX Protocol transitions from token distribution to token utility — a maturity milestone for the protocol. Mechanisms for continued token circulation may be introduced through future protocol upgrades executed under the governance framework at that stage.

---

## 7. Token Utility

MGX Token utility expands across each protocol phase:

| Phase | Status | MGX Utility |
|-------|--------|------------|
| Community Building | **Live** | On-chain distribution reward on every registration and upgrade |
| Staking | Planned | Rewards distributed from the funded on-chain staking pool |
| DEX | Planned | Trading pair, liquidity provision, trading fee participation |
| NFT | Future | NFT creation and marketplace transactions |
| Gaming | Future | In-game economy and reward distribution |
| Metaverse | Future | Virtual economy participation |

The MGX Token is the shared economic layer across all MetaGuildX Protocol phases.

---

## 8. Staking

### Deployed Infrastructure

The MGXStaking contract is deployed on opBNB Mainnet with the initial reward pool funded.

| Property | Value |
|----------|-------|
| **Contract** | `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |
| **Current Reward Rate** | 0.03% per day (3 basis points) |
| **Lock Periods** | 30 / 90 / 180 / 365 / 730 days |
| **Lock Multipliers** | 100% — 115% (proportional to lock duration) |
| **Action Fee** | 20% on withdraw and add-to-stake (returned to reward pool) |

The reward rate is the current contract parameter and may be modified through future protocol upgrades under the governance framework as conditions evolve. The action fee mechanism recycles value back into the reward pool, supporting long-term staking sustainability.

### Community Activation

Staking infrastructure is deployed and the reward pool is funded. Broader community activation follows protocol adoption milestones.

### Staking Mechanics

Participants stake MGX Tokens for a chosen lock period. Rewards accrue daily, proportional to each participant's share of total staked MGX. Rewards may be claimed, compounded, or withdrawn after the lock period ends. Settlement and execution are performed entirely by the deployed on-chain smart contracts.

---

## 9. Ecosystem Roadmap

The MetaGuildX Protocol is designed as a nine-phase ecosystem. Each phase expands MGX Token utility and community value.

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Community Building | **Live** |
| 2 | MGX Token | **Active** |
| 3 | MGX DEX | Planned |
| 4 | Staking Activation | Planned |
| 5 | Trading Platform | Planned |
| 6 | NFT Creation | Future |
| 7 | NFT Marketplace | Future |
| 8 | Gaming | Future |
| 9 | Metaverse | Future |

> This roadmap represents the long-term vision of the MetaGuildX Protocol. Development priorities may evolve over time. No guaranteed delivery timeline is implied.

---

## 10. Smart Contracts

All MetaGuildX Protocol contracts are deployed on opBNB Mainnet (Chain ID: 204) and are publicly verifiable.

| Contract | Address |
|----------|---------|
| **Core** | `0xE3cD200609E223c96987c9FEa41C6014e8625c2F` |
| **MGX Token** | `0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81` |
| **MGX Staking** | `0xD18E7b23AeD67340bf974311d490cd4b903e26A3` |

All contracts are inspectable at `https://opbnb.bscscan.com`.

### Upgradeable Architecture

Contracts use UUPS upgradeable proxy architecture. Protocol upgrades are executed through the governance framework.

### Governance

The MetaGuildX Protocol operates under a governance framework designed to evolve toward progressive decentralization and future on-chain community governance as the protocol matures.

### Audit Status

A third-party smart contract audit has not yet been completed. All contracts are publicly deployed and open to independent review.

---

## 11. Risk Disclosure

Participation in the MetaGuildX Protocol and holding MGX Tokens involves significant risks:

**Market risk.** Token values are not guaranteed and may fluctuate significantly or decline to zero.

**Smart contract risk.** Despite internal review, smart contracts may contain undiscovered vulnerabilities. A third-party audit has not yet been completed.

**Regulatory risk.** The regulatory treatment of blockchain tokens varies by jurisdiction and may change. Participants are responsible for compliance with applicable laws in their jurisdiction.

**Liquidity risk.** MGX Tokens may have limited liquidity prior to DEX deployment. No guarantee exists that a liquid market will develop.

**Protocol risk.** Future phases are planned but not guaranteed. Development priorities may evolve.

**Governance risk.** On-chain community governance is not yet implemented. Community governance mechanisms are planned for future phases of the protocol roadmap.

This document does not constitute financial, legal, or investment advice. Participants should conduct independent due diligence and consult qualified advisors before making any decisions related to MGX Tokens.

---

## 12. Document Information

### Version

| Field | Value |
|-------|-------|
| **Document Version** | 1.0 |
| **Status** | Public Release |
| **Last Updated** | July 2026 |

### Copyright

© 2026 MetaGuildX Protocol. All rights reserved.

### Official Channels

| Channel | Link |
|---------|------|
| **Official Website** | *(To be updated)* |
| **Documentation** | *(To be updated)* |
| **Community** | *(To be updated)* |

---

*This whitepaper is provided for informational purposes only and does not constitute financial, legal, or investment advice.*
