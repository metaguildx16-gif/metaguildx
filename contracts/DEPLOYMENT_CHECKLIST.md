# MetaGuildX V3 - Deployment Checklist

## Contract Addresses (opBNB Testnet)
Core:         0xe66443ed0628a44CB95e0aD0BfF7549600ECe123
Income:       0x3086A4353bc84beD0e6675c46078c49BEfa6162a
Upgrade:      0x871265071462e7cA5B216207F6D51B172975F90c
Router:       0xAF3e39628d2651a849Ce9cc1cDe4190254245763
BinaryTree:   0x0240679ce5B1f81aa0e67132A045759A8D016e2f
CashbackPool: 0x81358e56F967b243B7C3bF1018538fa36ebFcE98
MGXStaking:   0x71330515fea58ecCD1129699Ef909CA2163e0417
MGXToken:     0xFA40a59e4C3d5350eF896c19c138b33f9cc5e976
TokenEngine:  0xA722E601dDB9abc38C44C02cDeF6DD86Df296C8e
USDT:         0xF4975eB104932bDBcA491A9Cb985439eA03863e0
Deploy Block: 161228800

## Web/Testnet Fallback Addresses

The web fallback constants in `apps/web/src/lib/metaguildx.ts` must stay aligned with the current canonical testnet deployment set:

- `TESTNET_CORE_ADDRESS = 0xB7607Ed884C665BE1ddE73e6D82d0ac5AD4095af`
- `TESTNET_BINARY_TREE_ADDRESS = 0xdfC9C58a20cFd481Dd3e83955d75EfCBA2E6756f`
- `TESTNET_INCOME_ROUTER_ADDRESS = 0x02fEAadC09C052Ad0f7EE95Ce1336De80AB380D2`
- `TESTNET_CASHBACK_POOL_ADDRESS = 0x0919D80A105746fe53d7b68544b6D9283EcA9724`
- `TESTNET_STAKING_ADDRESS = 0x6a8E438f54394141D808a1A24A7a8CA9469E4CfA`

If these fallbacks are stale, event scans and safety fallbacks can silently read old deployments.

## Critical Bug Fixes Applied (MUST verify after any upgrade)

### 1. `resetIncome()` - NO escrow wipe
File: `MetaGuildXIncome.sol`
Rule: `resetIncome()` must not zero `escrowBalances`
Verify: escrow balances survive rebirth

### 2. `_findEligibleLevelUpline()` - `paidIds` check
File: `IncomeRouter.sol`
Rule: spillover cannot go to already-paid users
Verify: L1 sponsor cannot receive L2+ spillover twice

### 3. `_distributeLevelIncome()` - sponsor-based start
File: `IncomeRouter.sol`
Rule: L1 = sponsor, L2+ follow placement chain with `getBinaryParent` fallback
Verify: level-income chain matches actual genealogy

### 4. `createRebirthUser()` - cashback + creator payout
File: `MetaGuildXCore.sol`
Rule: rebirth must still trigger cashback and creator payout
Verify: creator receives the rebirth creator share each time

### 5. Auto-upgrade remainder -> user wallet
File: `MetaGuildXUpgrade.sol`
Rule: excess escrow after upgrade must be released to the user
Verify: no stranded value remains in the old package bucket

### 6. Level tree - sponsor-based placement
File: `BinaryTree.sol`
Rule: new users must be placed under the sponsor subtree, not global BFS
Verify: `getLevelParent(newUser)` matches expected sponsor chain

### 7. `RebirthCannotSponsor` restriction removed
File: `MetaGuildXCore.sol`
Rule: rebirth IDs may act as sponsors/referrers
Verify: rebirth referral links work in registration

### 8. Opposite-side rebirth placement
File: `MetaGuildXCore.sol`
Rule: when sponsor has no rebirth, place on opposite side
Verify: `createRebirthUser` placement logic is respected

## Payment Normalization (Critical)

- `PLATFORM_SCALE = 10`
- Package 1 raw price = `100`
- Correct USDT `paymentAssetUnitPrice = 100000000000000000` (`1e17`)

Why `1e17` is required:
- One raw platform unit represents `0.1` displayed USD
- USDT uses `18` decimals on this testnet deployment
- Raw package 1 price = `100`
- Settlement formula is:
  `settlementRaw = platformRaw * paymentAssetUnitPrice`
- Therefore:
  `100 * 1e17 = 1e19`
- `1e19` with 18 USDT decimals = exactly `10 USDT`

Critical warning:
- DO NOT use `paymentAssetUnitPrice = 10`
- `100 * 10 = 1000`
- `1000` with 18 decimals = `0.000000000000001 USDT`
- This creates microscopic dust transfers and economically invalid registrations

## ProductionMode Safety

`productionMode = true` enforces real payment collection.

It must remain `false` until ALL of the following are complete:
- router wired
- income wired
- creator wallet set
- payment asset configured
- `paymentAssetUnitPrice` verified as `1e17`

Only enable `productionMode = true` after those checks pass.

If `productionMode = false` during live user onboarding:
- registration may appear to succeed
- but real settlement collection is bypassed
- this creates silent economic inconsistency

## Allowance / Approval Requirements

Post-deploy root registration is a paid ERC20 registration.

Requirements:
- deployer USDT balance must be `>= settlement amount`
- deployer allowance to Core must be `>= settlement amount`
- root registration must call `approve()` before `registerWithPlacement(...)`

If allowance is missing:
- Core payment collection fails at `transferFrom`
- revert reason is `INCOME_TRANSFER_FAILED`

Always verify before registration scripts:
- `balanceOf(deployer)`
- `allowance(deployer, core)`
- estimated settlement amount

## Critical Economic Validation

Registration event success does NOT automatically prove payment success.

Always verify:
- actual ERC20 `Transfer` logs exist
- the real settlement amount on explorer is correct
- no microscopic dust transfers occurred
- no free registrations occurred
- `failedDistribution[userId] = false`

For root registration specifically:
- `UserRegistered` must exist
- paid settlement must be visible as ERC20 transfer into Core
- creator fallback distributions must be visible as real ERC20 transfers out of Core

## Explorer Verification Checklist

After every fresh deploy and first registration, verify on explorer:
- real ERC20 `Transfer` from payer -> Core
- correct settlement amount
- creator distribution transfers
- sponsor payout transfers where applicable
- no dust transfers
- no silent payment bypass
- `failedDistribution = false`

For the validated root registration on testnet, expected pattern was:
- payer -> Core: `10.0 USDT`
- Core -> creator fallback payouts totaling `10.0 USDT`
- Core post-registration balance may legitimately be `0` if the full amount is distributed immediately

## Known Critical Failure Modes

- Microscopic dust transfers from wrong unit price (`10` instead of `1e17`)
- Silent economic inconsistency when `productionMode = false`
- Missing allowance causing `INCOME_TRANSFER_FAILED`
- Frontend double-counting wallet values
- Fake Moralis wallet balances
- Registration event present while real payment was missing or invalid

## Post-Deploy Verification Script
Run:
`npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet`

Expected:
`15 passed, 0 failed`

This must verify at minimum:
- `defaultPaymentAsset = correct USDT`
- `enabledPaymentAssets[USDT] = true`
- `paymentAssetUnitPrice[USDT] = 1e17`
- `productionMode = true`

## Payment Asset Setup (MUST after fresh deploy)

After `fresh-deploy-v3.ts` runs:

1. `defaultPaymentAsset = 0xF4975eB104932bDBcA491A9Cb985439eA03863e0`
2. `usdtAddress = 0xF4975eB104932bDBcA491A9Cb985439eA03863e0`
3. `enabledPaymentAssets[USDT] = true`
4. `paymentAssetUnitPrice[USDT] = 100000000000000000` (`1e17`)
5. `productionMode = true`

If any of these are wrong, registrations are not production-safe.

## Fresh Deploy Order (EXACT)

1. `npx hardhat compile`
2. `npx hardhat run scripts/fresh-deploy-v3.ts --network opbnbTestnet`
   Deploys contracts, wires them, configures USDT, sets production mode
3. `npx hardhat run scripts/post-deploy-setup.ts --network opbnbTestnet`
   Performs root registration, staking setup, and post-deploy checks
4. `npx hardhat run scripts/update-env-after-deploy.ts --network opbnbTestnet`
   Updates frontend/admin env references
5. `npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet`
   Must show `15/15` pass

Recommended immediately after those 5 steps:
- `npx hardhat run scripts/debug-registration-flow.ts --network opbnbTestnet`
- Build web + admin
- Deploy to VPS
- Test registration and verify real ERC20 settlement on explorer

## VPS Web Env Checklist

The deployed web env must include the current deploy block and the full live address set. At minimum:

- `VITE_DEPLOY_BLOCK=161228800`
- `VITE_CORE_ADDRESS=0xe66443ed0628a44CB95e0aD0BfF7549600ECe123`
- `VITE_ROUTER_ADDRESS=0xAF3e39628d2651a849Ce9cc1cDe4190254245763`
- `VITE_INCOME_ADDRESS=0x3086A4353bc84beD0e6675c46078c49BEfa6162a`
- `VITE_INCOME_ENGINE_ADDRESS=0x3086A4353bc84beD0e6675c46078c49BEfa6162a`
- `VITE_INCOME_ROUTER_ADDRESS=0xAF3e39628d2651a849Ce9cc1cDe4190254245763`
- `VITE_BINARY_TREE_ADDRESS=0x0240679ce5B1f81aa0e67132A045759A8D016e2f`
- `VITE_UPGRADE_ADDRESS=0x871265071462e7cA5B216207F6D51B172975F90c`
- `VITE_CASHBACK_POOL_ADDRESS=0x81358e56F967b243B7C3bF1018538fa36ebFcE98`
- `VITE_MGX_STAKING_ADDRESS=0x71330515fea58ecCD1129699Ef909CA2163e0417`
- `VITE_TOKEN_ENGINE_ADDRESS=0xA722E601dDB9abc38C44C02cDeF6DD86Df296C8e`
- `VITE_USDT_ADDRESS=0xF4975eB104932bDBcA491A9Cb985439eA03863e0`

If `VITE_DEPLOY_BLOCK` or router/income addresses are wrong:
- box earnings can show empty
- level breakdown scans can return `0 members`
- analytics can silently read the wrong deployment

## Environment Variables (NEVER commit to git)

- `VITE_PLACEMENT_SIGNER_URL` must point to the live signer service
- `VITE_PLACEMENT_SIGNER_TOKEN` is browser-exposed and only a light gate
- `SIGNER_PRIVATE_KEY` and `SIGNER_AUTH_TOKEN` must live outside the repo
- `PLACEMENT_SIGNER_PRIVATE_KEY` must be available for root registration scripts
- the signer service self-loads `/etc/metaguildx/signer.env` at startup
- `ALLOWED_ORIGINS` must include:
  - `https://test.metaguildx.net`
  - `https://metaguildx.net`
  - `https://www.metaguildx.net`
