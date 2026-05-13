# MetaGuildX V3 - Deployment Checklist

## Contract Addresses (opBNB Testnet)
Core:         0x63125067659EEC130Cd7df8fe7fA4319511EEE6E
Income:       0x21B412C35B657D4a1e736b9cE459dA68D2EDf4A7
Upgrade:      0x45bb87926f9248d92c1B1aca0d61ac3C59313B92
Router:       0x3DAF4F9080af5bf877FF00bb80d42F3333A54c22
BinaryTree:   0x84A5EA422114c4E230E4c085F01685437fECdA00
CashbackPool: 0x2861e5Ec275605A22B237E866Ca14733F5a76a7d
MGXStaking:   0x3836cDFE1a639A6eCdECCF4fC3c0E8E28F57A47F
MGXToken:     0x3727D801165502dC1a0C39B36738F232d9eb4168
TokenEngine:  0x53178455158Ee49399D7B7D227F1ec67fCF61635
USDT:         0xF4975eB104932bDBcA491A9Cb985439eA03863e0
Deploy Block: 158940507

## Critical Bug Fixes Applied (MUST verify after any upgrade)

### 1. resetIncome() - NO escrow wipe
File: MetaGuildXIncome.sol
Rule: resetIncome() must NOT zero escrowBalances
Verify: escrowBalances preserved after rebirth

### 2. _findEligibleLevelUpline() - paidIds check
File: IncomeRouter.sol
Rule: Spillover cannot go to already-paid users
Verify: L1 sponsor cannot receive L2+ spillover

### 3. _distributeLevelIncome() - sponsor-based start
File: IncomeRouter.sol
Rule: L1=sponsor, L2+ from placement chain with getBinaryParent fallback
Verify: Level income chain correct after registration

### 4. createRebirthUser() - _distributeCashbackAndCreator
File: MetaGuildXCore.sol
Rule: Rebirth must trigger cashback+creator payout
Verify: $1.40 goes to Creator on each rebirth

### 5. Auto-upgrade remainder -> user wallet
File: MetaGuildXUpgrade.sol
Rule: Excess escrow after upgrade -> released to user
Verify: No leftover in old pkg bucket

### 6. Level Tree - sponsor-based placement
File: BinaryTree.sol
Rule: New users placed under sponsor subtree, not global BFS
Verify: getLevelParent(newUser) = correct sponsor chain

### 7. RebirthCannotSponsor restriction - REMOVED
File: MetaGuildXCore.sol
Rule: Rebirth IDs CAN be sponsors/referrers
Verify: Rebirth referral links work for registration

### 8. Opposite-side rebirth placement
File: MetaGuildXCore.sol
Rule: When sponsor has no rebirth, place on opposite side
Verify: createRebirthUser placement logic

## Post-Deploy Verification Script
Run: npx hardhat run scripts/verify-deployment.ts --network opbnbTestnet

## Environment Variables (NEVER commit to git)
- VITE_PLACEMENT_SIGNER_URL must point to the live signer service
- VITE_PLACEMENT_SIGNER_TOKEN is browser-exposed and only a light gate
- SIGNER_PRIVATE_KEY and SIGNER_AUTH_TOKEN must live outside the repo
