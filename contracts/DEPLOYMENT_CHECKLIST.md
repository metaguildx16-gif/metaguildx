# MetaGuildX V3 - Deployment Checklist

## Contract Addresses (opBNB Testnet)
Core:         0x650B3646CE093912Ea1f177c9b212307314C1A26
Income:       0x45ABfB0122c45DeAce143Ef2239641a0717576cD
Upgrade:      0x66a51Ce77bae17FAbb7F0539dd82C938865b1D9E
Router:       0x41cCeE5C343190DBBcfCb7473FDE48493Ee5020B
BinaryTree:   0x2c446C2f7B609bDE9cC3c29919176Da119f97425
CashbackPool: 0x9ee157973f1156D9292d146CD89fB4db7c37D8F9
MGXStaking:   0xa908B4700fFf0990f43758E3E69773B1a87B9Be1
MGXToken:     0x6AfFA8D165AfBf4e58B1254Cf12634017aCCb20c
TokenEngine:  0x20c5c0CCb1e55C1D0c351E2e46D8Cc6BeFAd54aa
USDT:         0xF4975eB104932bDBcA491A9Cb985439eA03863e0
Deploy Block: 162809056

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

### 5b. Auto-upgrade safety check after escrow routing
File: `MetaGuildXIncome.sol`
Rule: after every escrow-affecting route, a final upgrade eligibility check must run so threshold-crossing escrow cannot miss `checkAndTriggerUpgrade()`
Verify: when escrow crosses `pkgPrice * 2`, auto-upgrade fires in the same transaction instead of waiting for a later manual upgrade

### 5c. Manual upgrade excess escrow refund
File: `MetaGuildXCore.sol`
Rule: manual upgrade must consume only the current package escrow needed for the upgrade cost, and refund any excess to the user wallet
Verify: `escrow > upgradeCost` returns the remainder to the user instead of leaving it stranded in Core

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

### 9. `_distributeLevelIncome()` - advance cursor on package-mismatch skip
File: `IncomeRouter.sol`
Rule: if L1 sponsor is underqualified for the junior package, traversal must advance to the next level parent before checking L2+
Verify: User #4 `Pkg1 -> Pkg2` style upgrades can still reach User #1 for level income when User #3 is underqualified
Impact: without this fix, valid L2 payouts can incorrectly fall through to creator fallback

### 10. `routeIncome()` - level and spillover keep xSlot routing but bypass rebirth escrow absorption
File: `MetaGuildXIncome.sol`
Rule: `level` and `spillover` income must still follow normal xSlot routing, including escrow at xSlot `1/2`, but must not be absorbed into `rebirthEscrow` at rebirth slots
Verify: level/spillover income can still enter `escrowBalances` at xSlot `1/2`, but at rebirth slots it must pay the wallet directly instead of entering `rebirthEscrow`
Impact: without this fix, valid level income can either become incorrectly always-liquid or be absorbed into rebirth funding and released later as escrow remainder instead of following package-cycle escrow rules

### 11. `_insertIntoLevelTree()` - walk sponsor ancestry before root fallback
File: `BinaryTree.sol`
Rule: if the immediate sponsor is not level-eligible, level-tree insertion must walk sponsor -> sponsor's sponsor -> ... until the first eligible ancestor before falling back to `levelRootId`
Verify: level-tree placement stays under the nearest eligible sponsor ancestor instead of jumping straight to root
Impact: without this fix, eligible users can be inserted under the wrong branch and level-income genealogy diverges from intended sponsor-chain behavior

### 12. `_insertIntoLevelTree()` - left-across-level BFS ordering
File: `BinaryTree.sol`
Rule: level-tree BFS must fill all left slots across the current level before any right slots, giving `LL, RL, LR, RR` ordering
Verify: placement order matches left-across-level traversal, not per-node `LL, LR, RL, RR`
Impact: without this fix, level-tree positions diverge from the intended breadth order and spillover/level genealogy becomes harder to predict

### 13. `MGXStaking` reward-rate initialization
File: `MGXStaking.sol`
Rule: staking reward rate must be set after deploy; default deployment target is `DEFAULT_STAKING_REWARD_RATE = 3` bps/day (~10.95% simple annualized)
Verify: `rewardRate()` is non-zero after post-deploy setup and rewards begin accruing after full-day intervals
Impact: if reward rate remains `0`, staking appears funded but no user earns any rewards

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
   Performs root registration, staking setup, reward-rate initialization, and post-deploy checks
4. `npx hardhat run scripts/update-env-after-deploy.ts --network opbnbTestnet`
   Updates frontend/admin env references
5. `npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet`
   Must show `15/15` pass

Recommended immediately after those 5 steps:
- `npx hardhat run scripts/debug-registration-flow.ts --network opbnbTestnet`
- Build web + admin
- Deploy to VPS
- Test registration and verify real ERC20 settlement on explorer
- Because `IncomeRouter.sol` changed for level traversal, a fresh deploy is required before re-validating level income

## VPS Web Env Checklist

The deployed web env must include the current deploy block and the full live address set. At minimum:

- `VITE_NETWORK=testnet`
- `VITE_DEPLOY_BLOCK=161857500`
- `VITE_CORE_ADDRESS=0xFBEcE2F22c2856bF985eC45FcDB56ef7d6e62c0f`
- `VITE_ROUTER_ADDRESS=0x931Ce86E932E9320f132D66e55a18Ba436765c3D`
- `VITE_INCOME_ADDRESS=0x1D776DB168495371AD1D16CEb4811f1Cb725bBfb`
- `VITE_INCOME_ENGINE_ADDRESS=0x1D776DB168495371AD1D16CEb4811f1Cb725bBfb`
- `VITE_INCOME_ROUTER_ADDRESS=0x931Ce86E932E9320f132D66e55a18Ba436765c3D`
- `VITE_BINARY_TREE_ADDRESS=0x4F7d0a74e9Dcd47880B255bB69F91312b3Aa7468`
- `VITE_UPGRADE_ADDRESS=0x484eA1053Fa54807CA9959108480b25f80AAAEeA`
- `VITE_CASHBACK_POOL_ADDRESS=0x29541f94bE348Ca9dF0369964F8d2591d927aBCE`
- `VITE_MGX_STAKING_ADDRESS=0x69fAdFB4Ad5343D63170F624e23Cc6d239Ac7a13`
- `VITE_TOKEN_ENGINE_ADDRESS=0x8958b02588A8A9b6AAA44519652D5ED362dC4AB6`
- `VITE_USDT_ADDRESS=0xF4975eB104932bDBcA491A9Cb985439eA03863e0`

If `VITE_DEPLOY_BLOCK` or router/income addresses are wrong:
- box earnings can show empty
- level breakdown scans can return `0 members`
- analytics can silently read the wrong deployment

## Frontend Runtime Safety Notes

- `normalizeNetworkKey(...)` must default unknown/missing networks to `testnet`, not `local`
- landing page public stats must use the public testnet RPC path, not wallet-driven RPC state
- `wallet_addEthereumChain` testnet metadata must remain:
  - `chainName = opBNB Testnet`
  - `nativeCurrency.name = tBNB`
  - `nativeCurrency.symbol = tBNB`
  - `blockExplorerUrls = https://opbnb-testnet.bscscan.com`
- `SHOW_DIAGNOSTICS = false` in production builds
- event-scan chunking is intentionally reduced to `BLOCK_CHUNK_SIZE = 10000`
- noisy `queryFilter` / `getLogs` progress logs should stay disabled in production
- `level` and `spillover` income must follow xSlot routing, including escrow at xSlot `1/2`, but must bypass `rebirthEscrow` absorption at rebirth slots
- level tree behavior is intentionally: eligible-users-only BFS under the nearest eligible sponsor ancestor
- level tree level-order must still fill all left slots across a level before right slots (`LL, RL, LR, RR`)
- manual upgrades must refund excess current-package escrow instead of zeroing it into Core
- auto-upgrade protection must still re-check threshold after escrow-affecting routing completes
- `MGXStaking.setRewardRate()` must be called post-deploy with `DEFAULT_STAKING_REWARD_RATE = 3`
- `contracts/scripts/set-staking-reward-rate.ts` is the repair script for already-deployed staking contracts with `rewardRate = 0`

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
