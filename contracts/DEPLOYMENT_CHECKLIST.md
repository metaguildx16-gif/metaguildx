# MetaGuildX V3 - Deployment Checklist

## Contract Addresses (opBNB Testnet)
Core:         0x9B343ae746538218F37f0DA77bdae8dF352ea41c
Income:       0x962885b5226efB71D48B8C329066e64E1354DB22
Upgrade:      0x3aB615f3027c3D4de73d053279b965DC63D8eeAd
Router:       0x90D8D553Ab30f0aeAB227DD4743990122870f729
BinaryTree:   0xF094Be11582C680a9c476F22405E37873EddEe95
CashbackPool: 0x9C37421E37C1F239a408B40F15F01BbA79BA081b
MGXStaking:   0xFf2E00A180D4f4Eb03D94a4a736a452025bDe226
MGXToken:     0xFBA4f9618ab7b76705669667542030a1549e68B3
TokenEngine:  0x3f5C41b0eBa48D26d7ef1A6D157241bb2B84C626
USDT:         0xF4975eB104932bDBcA491A9Cb985439eA03863e0
Deploy Block: 164614245

## Critical Bug Fixes Applied (MUST verify after any upgrade)

### 1. `resetIncome()` - no escrow wipe
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
Verify: package-mismatch level payouts still reach the correct upline

### 10. `routeIncome()` - all income types share the same xSlot routing
File: `MetaGuildXIncome.sol`
Rule: `direct`, `level`, and `spillover` must all follow the same xSlot routing with no special bypass
Verify: xSlot `0/3` pays the wallet, xSlot `1/2` goes to `escrowBalances`, and xSlot `4+` routes to `rebirthEscrow` for all eligible income types

### 11. `_insertIntoLevelTree()` - walk sponsor ancestry before root fallback
File: `BinaryTree.sol`
Rule: if the immediate sponsor is not level-eligible, insertion must walk sponsor ancestry before falling back to `levelRootId`
Verify: level-tree placement stays under the nearest eligible sponsor ancestor

### 12. `_insertIntoLevelTree()` - left-across-level BFS ordering
File: `BinaryTree.sol`
Rule: level-tree BFS must fill all left slots across a level before right slots
Verify: placement order matches `LL, RL, LR, RR`

### 13. `MGXStaking` reward-rate initialization
File: `MGXStaking.sol`
Rule: staking reward rate must be set after deploy
Verify: `rewardRate()` is non-zero after post-deploy setup

### 22. `resetIncome()` wiped wrong pkg bucket during rebirth
File: `MetaGuildXIncome.sol`, `MetaGuildXUpgrade.sol`, `MetaGuildXCore.sol`
Rule: rebirth must reset only package 1 income via `resetIncomeByPkg(userId, 1)`, never the user's current package bucket
Verify: package-2+ `totalEarnings` survive rebirth, reset is blocked when escrow exists, and xSlot routing reverts on invalid bucket state instead of silently restarting at `0` ✅

### 23. Spillover level income duplicate payout bug
File: `IncomeRouter.sol`
Rule: spillover receiver must be added to `paidIds`, and `placementCursor` must advance after spillover so the same user cannot be paid repeatedly in one registration
Verify: spillover receiver added to `paidIds` + `placementCursor` advances after spillover ✅

### 24. adminFundStakingPool missing platformReserve/assetReserve update
File: `MGXStaking.sol`
Rule: `adminFundStakingPool()` must update `rewardPool`, `stakingRewardPoolPlatformReserve`, and `stakingRewardPoolAssetReserve`
Verify: staking claim no longer always reverts with `Insufficient reward reserve` after admin funding ✅

### 25. stakeFor() missing MGX transferFrom
File: `MGXStaking.sol`
Rule: `stakeFor()` must transfer MGX from the user wallet before recording stake state
Verify: users can no longer stake unlimited times without spending MGX ✅

## Post-Deploy Fixes

1. Bug #24 — Staking claim reliability fixes (polling mutex, RPC fallback, error messages) ✅
39. Bug #25 — isStakePending guard prevents double-stake from stale MGX balance display ✅

## distribution-test.ts Coverage

- Test 13: Bug #24 — adminFundStakingPool sets platformReserve ✅
- Test 14: Bug #24 — rewardPool increases after adminFundStakingPool ✅
- Test 15: Bug #26 — stakeFor transfers MGX from user wallet ✅
- Test 16: Bug #25 — double stake not possible with 0 MGX balance ✅

## Payment Normalization (Critical)

- `PLATFORM_SCALE = 10`
- Package 1 raw price = `100`
- Correct USDT `paymentAssetUnitPrice = 100000000000000000` (`1e17`)

Why `1e17` is required:
- One raw platform unit represents `0.1` displayed USD
- USDT uses `18` decimals on this testnet deployment
- `100 * 1e17 = 1e19`
- `1e19` with 18 decimals = exactly `10 USDT`

Never use:
- `paymentAssetUnitPrice = 10`

## Post-Deploy Verification Script
Run:
`npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet`

Expected:
`14 passed, 0 failed`

This must verify at minimum:
- `defaultPaymentAsset = correct USDT`
- `enabledPaymentAssets[USDT] = true`
- `paymentAssetUnitPrice[USDT] = 1e17`
- `productionMode = true`

## Pre-Deploy Mandatory Tests

Note: `distribution-test.ts` now covers 16 checks (was 14)

## Fresh Deploy Order (Exact)

1. `npx hardhat compile`
2. `npx hardhat run scripts/fresh-deploy-v3.ts --network opbnbTestnet`
3. `npx hardhat run scripts/post-deploy-setup.ts --network opbnbTestnet`
4. `npx hardhat run scripts/update-env-after-deploy.ts --network opbnbTestnet`
5. `npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet`
   Must show `14/14` pass

Recommended immediately after:
- `npx hardhat run scripts/distribution-test.ts --network opbnbTestnet`
- `npx hardhat run scripts/debug-registration-flow.ts --network opbnbTestnet`
- Build web + admin
- Deploy to VPS
- Verify real ERC20 settlement on explorer

## VPS Web Env Checklist

The deployed web env must include the current deploy block and full live address set:

- `VITE_NETWORK=testnet`
- `VITE_DEPLOY_BLOCK=163957149`
- `VITE_CORE_ADDRESS=0x332b3a977caa27dCBA85735fa1317389b4D8745b`
- `VITE_ROUTER_ADDRESS=0x8a509Db0119f51e4891E5F3A80d13fDf9602B7da`
- `VITE_INCOME_ADDRESS=0x7E746e5b3bF16110812BE675338A87b2D6631F5F`
- `VITE_INCOME_ENGINE_ADDRESS=0x7E746e5b3bF16110812BE675338A87b2D6631F5F`
- `VITE_INCOME_ROUTER_ADDRESS=0x8a509Db0119f51e4891E5F3A80d13fDf9602B7da`
- `VITE_BINARY_TREE_ADDRESS=0xCC9505925E4D161f275Af24cCf0dfBA657D98409`
- `VITE_UPGRADE_ADDRESS=0xBBcaE29f8834bfD67D7419D193c79419a668C4C1`
- `VITE_CASHBACK_POOL_ADDRESS=0xE331A62489c2dBea196AC9f05b341558C274160e`
- `VITE_MGX_STAKING_ADDRESS=0xCf731C4d43E8a5948706A8A9bba0C713DcbE5FCb`
- `VITE_TOKEN_ENGINE_ADDRESS=0x46c78FA113cb200b24f55fa331902cD8F947a793`
- `VITE_USDT_ADDRESS=0xF4975eB104932bDBcA491A9Cb985439eA03863e0`

## Final Runtime Notes

- `normalizeNetworkKey(...)` must default unknown networks to `testnet`, not `local`
- landing/public stats must use the public RPC path, not wallet-driven RPC state
- `SHOW_DIAGNOSTICS = false` in production
- `BLOCK_CHUNK_SIZE = 10000` retained unless RPC behavior is re-evaluated
- support ticket system uses shared signer storage and is production-ready on VPS ✅
- staking reward UI uses reward-debt timing and current claim gating ✅
