# Mainnet Preparation Checklist

## Current Testnet Status (Deploy Block `163957149`)

- [x] All contract bugs fixed
- [x] All frontend fixes completed
- [x] Admin VPS deployed
- [x] Support ticket system working
- [x] `distribution-test.ts` created
- [x] Spillover duplicate payout fix deployed
- [x] `resetIncomeByPkg` fix deployed
- [x] Staking proxy fix deployed
- [x] `78` registrations tested

## Remaining Before Mainnet

- [x] Owner -> Gnosis Safe multisig wallet
  Safe: `0x6D01d1E9771193467B5fae47Ce8463d7060098eA`
  Threshold: 2 of 3 signers
  Contracts transferred: Core, Income, Upgrade, MGXStaking, MGXToken, TokenEngine (6/6)
- [x] SSL for `metaguildx.net` + `www.metaguildx.net` (main domain)
  Certbot deployed, auto-renewal active until 2026-08-24
- [x] Mainnet USDT address configured
  opBNB Mainnet USDT: `0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3`
  Network-aware selection in `fresh-deploy-v3.ts` and `post-deploy-setup.ts`
  `opbnbMainnet` network added to `hardhat.config.ts`
- [ ] Redis-backed rate limiting
- [ ] Final security audit

## Security

- [ ] `VITE_LOCAL_PLACEMENT_SIGNER_KEY` removed from all env files
- [ ] Placement signer = hardware wallet address
- [x] Owner = Gnosis Safe multisig
- [ ] Creator fee wallet = separate hardware wallet
- [ ] Treasury wallet = separate hardware wallet
- [ ] Private keys never stored in repo

## Payment Asset (Critical for Registration)

- [x] `defaultPaymentAsset = mainnet USDT address`
- [x] `usdtAddress = mainnet USDT address`
- [ ] `enabledPaymentAssets[mainnet USDT] = true`
- [ ] `paymentAssetUnitPrice[mainnet USDT] = 100000000000000000` (`1e17`)
- [ ] `productionMode = true` only after wiring and payment checks are complete
- [ ] Test paid registration and verify real income distribution
- [ ] Core USDT balance starts at `0` before first registration

## Contracts

- [x] All documented contract bug fixes applied in source
- [x] `distribution-test.ts` created
- [x] Spillover duplicate payout fix deployed
- [x] `resetIncomeByPkg` rebirth fix deployed
- [ ] Final security audit completed
- [x] UUPS upgrade ownership transferred to Gnosis Safe multisig

## Frontend

- [x] All documented frontend fixes applied
- [x] Staking pending reward uses live state with snapshot fallback
- [x] Staking countdown is reward-debt based
- [x] Claim success reads actual `Claimed` event amount
- [x] Claim button is gated by reward window readiness
- [x] Clear staking error messages for no reward / window not reached
- [ ] All `VITE_` env vars set for mainnet
- [ ] No localhost URLs in production env

## Infrastructure

- [x] Admin VPS deployed
- [x] `admin.metaguildx.net` nginx server block configured
- [x] Admin SSL configured
- [x] Support tickets moved from localStorage to shared signer API
- [x] Tickets stored at `/etc/metaguildx/tickets.json`
- [x] Signer endpoints: `POST/GET /support/tickets`, `PATCH /support/tickets/:id`
- [x] Admin reads tickets with `x-admin-token`
- [x] `admin.metaguildx.net` added to signer `ALLOWED_ORIGINS`
- [x] SSL for `metaguildx.net` + `www.metaguildx.net` (main domain)
  Certbot deployed, auto-renewal active until 2026-08-24
- [ ] Redis-backed rate limiting

## Testing

- [x] Full registration flow tested on testnet
- [x] Auto-upgrade tested
- [x] Rebirth tested
- [x] Level income distribution verified
- [x] Direct, level, and spillover use the same xSlot routing
- [x] Manual upgrade excess escrow refund verified
- [x] Support ticket system tested end-to-end
- [x] `78` registrations tested
- [ ] Final mainnet smoke test on production addresses

## Launch Prerequisites

- [x] Mainnet USDT address configured
- [x] Owner moved to Gnosis Safe multisig
- [x] Main domain SSL live
- [ ] Final security audit complete
- [ ] Run `npx hardhat run scripts/verify-deployment.ts --network <mainnet>`
- [ ] Run `npx hardhat run scripts/distribution-test.ts --network <mainnet>`

## Known Fixed Items on Current Testnet Deploy

Bug Fixed (`resetIncomeByPkg` rebirth reset):
- rebirth now resets only package 1 income
- escrow guard blocks invalid reset
- xSlot bucket invariant now reverts on broken state

Bug Fixed (`IncomeRouter.sol` spillover duplicate payout):
- spillover receiver added to `paidIds`
- `placementCursor` advances after spillover
- same user can no longer be paid repeatedly in one registration

Staking System (deployed and verified ✅):
- staking proxy wiring fix deployed on current testnet deployment
- `pendingStakingReward(wallet)` and claim flow fixed on current deployment
- reward window gating prevents premature claim attempts
- reward-debt countdown used on web and admin staking pages

Support Ticket System (fully working ✅):
- user submits ticket -> stored in `/etc/metaguildx/tickets.json`
- admin reads all tickets via `GET /support/tickets`
- admin responds via `PATCH /support/tickets/:id`
- user sees admin response in mobile app
