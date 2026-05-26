# Mainnet Preparation Checklist

## Security
- [ ] `VITE_LOCAL_PLACEMENT_SIGNER_KEY` removed from all env files
- [ ] Placement signer = hardware wallet address
- [ ] Owner = hardware wallet or multisig
- [ ] Creator fee wallet = separate hardware wallet
- [ ] Treasury wallet = separate hardware wallet
- [ ] Private keys never stored in repo

## Payment Normalization (Critical)

Mainnet must preserve the same economic scale used by the validated testnet flow:
- `PLATFORM_SCALE = 10`
- Package 1 raw price = `100`
- Correct USDT `paymentAssetUnitPrice = 100000000000000000` (`1e17`)

Why this matters:
- raw settlement is calculated as `platformRaw * paymentAssetUnitPrice`
- package 1 raw = `100`
- `100 * 1e17 = 1e19`
- `1e19` with 18 decimals = exactly `10 USDT`

Never use:
- `paymentAssetUnitPrice = 10`

That would produce:
- `100 * 10 = 1000`
- `1000` with 18 decimals = `0.000000000000001 USDT`

That is an economically broken dust transfer.

## Payment Asset (Critical for Registration)
- [ ] `defaultPaymentAsset = mainnet USDT address`
- [ ] `usdtAddress = mainnet USDT address`
- [ ] `enabledPaymentAssets[mainnet USDT] = true`
- [ ] `paymentAssetUnitPrice[mainnet USDT] = 100000000000000000` (`1e17`)
- [ ] `productionMode = true` only after wiring and payment checks are complete
- [ ] Test paid registration and verify real income distribution
- [ ] Core USDT balance starts at `0` before first registration

## Income Routing Safety

- [ ] `MetaGuildXIncome.routeIncome()` keeps `direct`, `level`, and `spillover` on the same xSlot routing
- [ ] all income types still enter `escrowBalances` at xSlot `1/2`
- [ ] all eligible income types enter `rebirthEscrow` at xSlot `4+`
- [ ] rebirth funding still applies only to the intended rebirth escrow flow
- [ ] after escrow-affecting routing, the final safety check still runs so `checkAndTriggerUpgrade()` cannot miss a threshold-crossing credit

## Level Tree Safety

- [ ] `BinaryTree._insertIntoLevelTree()` walks sponsor ancestry to the nearest eligible sponsor ancestor before falling back to `levelRootId`
- [ ] level tree remains an eligible-users-only BFS under the nearest eligible sponsor ancestor
- [ ] level tree breadth order fills all left slots across a level before right slots (`LL, RL, LR, RR`)
- [ ] level-income genealogy is validated against sponsor-chain expectations after fresh deploy

## Upgrade Escrow Safety

- [ ] manual upgrade uses only the current-package escrow required for the upgrade cost
- [ ] excess current-package escrow is refunded to the user wallet
- [ ] old-package stranded escrow is released only after package level changes

## Staking Reward Safety

- [ ] `MGXStaking.setRewardRate()` exists and is owner-gated
- [ ] post-deploy setup calls `setRewardRate(DEFAULT_STAKING_REWARD_RATE)`
- [ ] `DEFAULT_STAKING_REWARD_RATE = 3` bps/day (~10.95% simple annualized)
- [ ] `contracts/scripts/set-staking-reward-rate.ts` is available as a repair script for deployments where `rewardRate = 0`
- [ ] `rewardRate()` verified non-zero on-chain after deploy

## Contract Address Checklist

Before launch, confirm the full deployed address set is documented and copied into every deployment surface:
- [ ] Core
- [ ] Income
- [ ] Router
- [ ] BinaryTree
- [ ] Upgrade
- [ ] CashbackPool
- [ ] MGXStaking
- [ ] MGXToken
- [ ] TokenEngine
- [ ] USDT
- [ ] deploy block

## VPS Web Env Checklist

The VPS/frontend env must contain the full live address set, not just Core + Router:
- [ ] `VITE_DEPLOY_BLOCK` set to the live deploy block
- [ ] `VITE_CORE_ADDRESS`
- [ ] `VITE_ROUTER_ADDRESS`
- [ ] `VITE_INCOME_ADDRESS`
- [ ] `VITE_INCOME_ENGINE_ADDRESS`
- [ ] `VITE_INCOME_ROUTER_ADDRESS`
- [ ] `VITE_BINARY_TREE_ADDRESS`
- [ ] `VITE_UPGRADE_ADDRESS`
- [ ] `VITE_CASHBACK_POOL_ADDRESS`
- [ ] `VITE_MGX_STAKING_ADDRESS`
- [ ] `VITE_TOKEN_ENGINE_ADDRESS`
- [ ] `VITE_USDT_ADDRESS`

If any of these are stale:
- event scans can hit the wrong deployment
- box earnings can appear empty
- level breakdowns can show `0 members`

## Web Fallback Address Reminder

The web fallback constants in `apps/web/src/lib/metaguildx.ts` must be kept in sync with the canonical testnet deployment.

Before using fallback addresses for any validation flow:
- [ ] `TESTNET_CORE_ADDRESS` updated
- [ ] `TESTNET_BINARY_TREE_ADDRESS` updated
- [ ] `TESTNET_INCOME_ROUTER_ADDRESS` updated
- [ ] `TESTNET_CASHBACK_POOL_ADDRESS` updated
- [ ] `TESTNET_STAKING_ADDRESS` updated

If those are stale, testnet fallback logic can silently read old deployments.

Also verify:
- [ ] `VITE_NETWORK=testnet` on staging/testnet VPS
- [ ] `normalizeNetworkKey(...)` default fallback remains `testnet`, not `local`
- [ ] testnet env addresses match the current deployment set and deploy block

Admin Panel (completed):
- Support tickets moved from localStorage to shared signer API
- Tickets stored at /etc/metaguildx/tickets.json on VPS
- Signer endpoints: POST/GET /support/tickets, PATCH /support/tickets/:id
- Admin reads tickets with x-admin-token auth
- admin.metaguildx.net nginx server block configured
- admin.metaguildx.net DNS A record added -> 103.91.186.181
- Admin dist built at /var/www/metaguildx/apps/admin/dist ✅
- DNS propagation pending (Bigrock: 4-6 hours)

## ProductionMode Safety

`productionMode = true` enforces real settlement collection.

Do not enable it until ALL of the following are true:
- [ ] router wired
- [ ] income wired
- [ ] creator wallet set
- [ ] payment asset configured
- [ ] `paymentAssetUnitPrice` verified as `1e17`
- [ ] allowance + approval logic tested in scripts

If `productionMode = false` while users register:
- registration can appear successful
- but real payment collection is bypassed
- this creates silent economic inconsistency

## Allowance / Approval Requirements

Every paid registration depends on ERC20 approval.

Before any root-registration or scripted registration:
- [ ] payer USDT balance `>= required settlement`
- [ ] payer allowance to Core `>= required settlement`
- [ ] scripts explicitly perform `approve()` before registration

Missing allowance causes:
- `INCOME_TRANSFER_FAILED`

This failure happens at the initial `transferFrom`, before sponsor/creator distributions run.

## Critical Economic Validation

Do not rely on high-level success signals alone.

Must validate:
- [ ] registration event success matches real payment success
- [ ] actual ERC20 `Transfer` logs exist
- [ ] settlement amount on explorer is correct
- [ ] no microscopic dust transfers
- [ ] no free registrations
- [ ] `failedDistribution = false`

Root-registration validation must prove:
- [ ] payer -> Core `10 USDT`
- [ ] creator fallback distributions are real ERC20 transfers
- [ ] Core balance behavior matches intended distribution flow

## Explorer Verification Checklist

After first paid registrations, verify on explorer:
- [ ] real ERC20 `Transfer` from payer -> Core
- [ ] correct settlement amount
- [ ] creator distributions
- [ ] sponsor payouts
- [ ] no dust transfers
- [ ] no silent payment bypass
- [ ] no `INCOME_TRANSFER_FAILED`
- [ ] `failedDistribution = false`

## Contracts
- [ ] Security audit completed
- [ ] All contract sizes < 24KB
- [ ] Gas optimization reviewed
- [ ] `verify-deployment.ts` passes all checks
- [ ] UUPS upgrade keys secured

## Frontend
- [ ] `productionMode = true` in Core before live traffic
- [ ] All `VITE_` env vars set for mainnet
- [ ] No localhost URLs
- [ ] Error tracking enabled
- [ ] Analytics setup
- [ ] landing/public stats use a dedicated public RPC, not wallet-driven RPC state
- [ ] `wallet_addEthereumChain` testnet metadata stays SafePal-compatible on staging
- [ ] testnet native currency remains `tBNB`
- [ ] testnet explorer URL remains `https://opbnb-testnet.bscscan.com`
- [ ] `SHOW_DIAGNOSTICS = false` in production
- [ ] event scan noise stays disabled in production
- [ ] `BLOCK_CHUNK_SIZE = 10000` retained unless RPC behavior is re-evaluated

## Signer Environment

- [ ] signer service self-loads `/etc/metaguildx/signer.env`
- [ ] `ALLOWED_ORIGINS` set explicitly
- [ ] production origins included
- [ ] test domain included when validating on staging/testnet
- [ ] do not rely on `VITE_PLACEMENT_SIGNER_TOKEN` as a true secret

## Testing
- [ ] Full registration flow tested
- [ ] Auto-upgrade tested
- [ ] Auto-upgrade triggers in the same tx that crosses the escrow threshold
- [ ] Rebirth tested
- [ ] Level income distribution verified
- [ ] Level-income package-mismatch traversal verified after `IncomeRouter` cursor-advance fix
- [ ] Direct, level, and spillover income verified to follow the same xSlot routing with no rebirth bypass
- [ ] Manual upgrade refunds excess escrow instead of leaving value in Core
- [ ] Frontend upgrade flow invalidates dashboard analytics caches before forcing the post-upgrade snapshot reload
- [ ] Admin panel verified
- [ ] Wallet balance display verified after Moralis removal

## Launch
- [ ] Fund staking pool with MGX
- [ ] Set staking reward rate (`DEFAULT_STAKING_REWARD_RATE = 3`)
- [ ] Set initial package prices
- [ ] Wire all contracts
- [ ] Run `npx hardhat run scripts/debug-registration-flow.ts --network <network>`
- [ ] Run `npx hardhat run scripts/post-deploy-setup.ts --network <network>`
- [ ] Run `npx hardhat run scripts/verify-deployment.ts --network <network>`
- [ ] Root user registered

## Known Critical Failure Modes

- Wrong unit price caused microscopic dust transfers
- `productionMode = false` allowed economically invalid registrations
- Missing allowance caused `INCOME_TRANSFER_FAILED`
- Frontend double-counted wallet values
- Fake Moralis wallet balances polluted connected-wallet views
- Registration event success could exist without valid real-money behavior if explorer transfer logs were not checked

## Known Issue History

- opBNB Testnet deploy block `158940507`
  - `defaultPaymentAsset` was set to mock USDT `0xF80Dd7c09539093d48e5Fd629d9731eA684d078F`
  - registrations failed with `TRANSFER_FAILED`
  - fixed with `fix-payment-asset.ts`

- Later testnet debugging discovered:
  - `paymentAssetUnitPrice = 10` produced dust transfers
  - missing allowance on root registration caused `INCOME_TRANSFER_FAILED`
  - root registration only became economically valid after:
    - correct unit price (`1e17`)
    - `productionMode = true`
    - deployer USDT approval to Core

- Later testnet debugging also discovered:
  - stale `TESTNET_*` fallback addresses caused frontend safety fallbacks to point at old deployments
  - default unknown network selection must not fall back to `Localhost 8545`
  - level-income traversal required a cursor-advance fix when L1 sponsor was underqualified for the junior package
  - level-tree insertion needed to walk sponsor ancestry before `levelRootId` fallback so eligible users stay under the correct sponsor branch
  - level-tree breadth order needed to fill left slots across a level before right slots (`LL, RL, LR, RR`)
  - all income types (`direct`, `level`, `spillover`) needed to return to the same xSlot routing with no rebirth bypass so business rules stay consistent at xSlot `4+`
  - manual upgrade needed to refund excess current-package escrow instead of leaving the remainder stranded in Core
  - escrow-triggered auto-upgrade needed a post-routing safety check so threshold-crossing credits cannot be missed
  - frontend dashboard refresh needed explicit analytics cache invalidation after upgrades so post-upgrade snapshots stop showing stale package data
  - staking reward generation stayed at zero until `rewardRate` was explicitly set after deploy
  - public landing stats needed a dedicated testnet RPC path independent of wallet state

Bug Fixed (Deploy Block: 163462778 -> next deploy):
- `resetIncome()` was resetting `Pkg2 totalEarnings` during rebirth flow
- Root cause: rebirth called `resetIncome(userId)` which read `getUserPackageLevel() = 2`, wiping the `Pkg2` bucket instead of `Pkg1`
- Fix: `resetIncomeByPkg(userId, 1)` so rebirth always resets `Pkg1` only
- Guard: `escrowBalances[userId][pkgLevel]` must be `0` before reset is allowed
- Safety: xSlot calculation now uses `require()` instead of silent clamp
- Files changed: `MetaGuildXIncome.sol`, `MetaGuildXUpgrade.sol`, `MetaGuildXCore.sol`

## Admin Panel Pre-Launch Checklist

1. Treasury wallet configured
   - setTreasury(treasuryWallet) called on MGXStaking ✅
   - Verify non-zero address shown in admin staking page

2. UpgradeEscrow display verified
   - Progress shows current package escrow only ✅
   - xSlot shows escrow cycle position (not event count) ✅
   - Waiting income from higher buckets shown separately ✅

3. Box earnings display verified
   - Box 1 shows for all active users ✅
   - Box 2+ shows only after package upgrade ✅

4. Auto-upgrade status verified
   - "Ready to upgrade" only when currentPkgEscrow >= threshold ✅
   - Cross-bucket totals not used for status ✅

5. Staking rewards
   - First reward cycle completes ~24h after deploy
   - Pending reward = 0 before first cycle is expected ✅
   - Reward rate: 10.95% APY (0.03% daily) at rewardRate = 3

6. Manual upgrade cross-bucket escrow verified
   - upgradePackage() uses pkg1 + next pkg bucket combined ✅
   - User not overcharged when higher pkg income exists ✅
   - getEscrowByPkg() and releaseEscrowByPkg() interfaces present ✅
