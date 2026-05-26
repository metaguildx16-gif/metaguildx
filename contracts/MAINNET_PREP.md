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

- [ ] Owner -> multisig wallet
- [ ] SSL for `metaguildx.net` + `www.metaguildx.net` (main domain)
- [ ] Redis-backed rate limiting
- [ ] Mainnet USDT address configured
- [ ] Final security audit

## Security

- [ ] `VITE_LOCAL_PLACEMENT_SIGNER_KEY` removed from all env files
- [ ] Placement signer = hardware wallet address
- [ ] Owner = hardware wallet or multisig
- [ ] Creator fee wallet = separate hardware wallet
- [ ] Treasury wallet = separate hardware wallet
- [ ] Private keys never stored in repo

## Payment Asset (Critical for Registration)

- [ ] `defaultPaymentAsset = mainnet USDT address`
- [ ] `usdtAddress = mainnet USDT address`
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
- [ ] UUPS upgrade keys secured

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
- [ ] SSL for `metaguildx.net` + `www.metaguildx.net` (main domain)
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

- [ ] Mainnet USDT address configured
- [ ] Owner moved to multisig
- [ ] Main domain SSL live
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
