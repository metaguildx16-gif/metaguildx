# MetaGuildX System Blueprint

## Roadmap

1. Community Building Platform (C&B)
2. MGX Token Launch
3. NFT Creation
4. NFT Marketplace
5. MGX DEX
6. Gaming Platform
7. Helping Concept
8. Metaverse

The first implementation stage is `C&B (Community + Income System)`.

## Package Ladder

| Level | Amount (USD) |
| --- | ---: |
| 1 | 10 |
| 2 | 20 |
| 3 | 40 |
| 4 | 80 |
| 5 | 160 |
| 6 | 320 |
| 7 | 640 |
| 8 | 1280 |
| 9 | 2560 |
| 10 | 5120 |

## Income Types

1. Coin Income
2. Staking Income
3. Hybrid Income Plan (Binary + Level)
4. Spillover Income
5. Cross Line Income

## MGX Token Model

- Total supply: `511,750,000 MGX`
- Community allocation: `307,050,000 MGX` (`60%`)
- Liquidity allocation: `20%`
- Reserve allocation: `20%`
- No mint after launch

### Box Release System

| Box | Price (USD) | Token Release |
| --- | ---: | ---: |
| 1 | 1.00 | 20% |
| 2 | 1.25 | 15% |
| 3 | 1.50 | 12% |
| 4 | 1.75 | 10% |
| 5 | 2.00 | 8% |
| 6 | 2.25 | 8% |
| 7 | 2.50 | 7% |
| 8 | 2.75 | 7% |
| 9 | 3.00 | 7% |
| 10 | 3.25 | 6% |

Early users access lower box prices. Later users access higher box prices.

## Staking Model

- Launch liquidity allocation: `20%`
- Split: `10%` future DEX liquidity, `10%` staking reward pool
- Initial rewards come only from the staking reward pool
- Daily reward pool release: `0.1%` of the staking reward pool
- User reward formula:

`userDailyReward = (userStake / totalStake) * dailyPoolRelease`

### Staking Options

- Claim daily reward
- Auto-compound reward into stake
- Withdrawal fee: `20%`
- Add-to-stake fee: `20%`
- Fees return to staking reward pool

### Duration Modifiers

| Duration | Modifier | Notes |
| --- | --- | --- |
| 1 year | Base reward | Default pool release |
| 2 years | +5% to +10% | Incentivized lock |
| 3 years | +10% to +20% | Maximum reward multiplier |

Future staking sustainability is intended to include DEX fees, NFT royalties, and gaming revenue.

## Hybrid Income Plan

### Placement Structure

Auto placement order:

1. Right
2. Left
3. Right-Right
4. Left-Right
5. Right-Left
6. Left-Left

Rules:

- Binary tree with two legs: left and right
- Spillover and auto-fill are enabled
- No left/right matching requirement
- Any placement can generate income

### Level Income

- 10 levels
- Each level pays `4%`

### Level Unlock Conditions

| Referrals | Levels Unlocked |
| ---: | ---: |
| 1 | 2 |
| 2 | 4 |
| 3 | 6 |
| 4 | 8 |
| 5 | 10 |

### Junior Package Rule

Income is calculated only on the downline value covered by the junior package amount.

Example:

- User package: `320 USD`
- Downline purchases: `10 + 20 + 40`
- Level income is calculated on `70 USD`

## Spillover Income

Upline placement combined with downline growth can generate additional income for the upline.

## Cross Line Income

- On the `5th X` income event, a new `10 USD` ID is created
- The new ID is placed in the upline weak leg
- That new ID can generate upline income

## Automation Rules

### Auto Upgrade

- `2X + 3X` income triggers upgrade to the next package

### Auto Reactivation

- `5th X` triggers creation of a new `10 USD` ID

## Cashback System

If the user fails to build a team:

- User can surrender the ID
- Cashback wallet is activated
- Every new join contributes `4%` to the cashback pool
- Pool is split daily among surrendered users
- Surrender is allowed only `3 to 6 months` after joining

## Wallet and Network

- Wallet connect: MetaMask / Trust Wallet
- User confirms transactions inside the wallet
- Target network: OPBNB

## Frontend Scope

### Landing Page

- Logo
- Home
- About
- System
- Packages
- Contact
- Tagline
- AI + Blockchain
- 5 Income Streams
- Auto System
- Roadmap preview
- Connect Wallet button only

### Dashboard

- User panel
- Binary tree view
- Income dashboard
- Referral system
- Level summary
- Rebirth tree
- Internal wallet

## Contract Architecture

1. Core contract
2. Binary tree contract
3. Income contract
4. Token contract
5. Upgrade contract
6. Cashback contract

## Core Flow

### Registration

User joins, pays for a package, and is placed in the tree.

### Income Flow

- Join event pays `50%` to direct upline
- Tree activity distributes level income

### Token Flow

Payment leads to MGX token allocation into the wallet.

### Upgrade Flow

- `2X + 3X` causes upgrade
- `5X` causes re-entry

## Reality Check

The blueprint describes an MLM + crypto hybrid design. Sustainability depends on real utility and later platform stages.
