# Mainnet Preparation Checklist

## Security
- [ ] VITE_LOCAL_PLACEMENT_SIGNER_KEY removed from .env
- [ ] Placement signer = hardware wallet address
- [ ] Owner = hardware wallet (multisig preferred)
- [ ] Creator fee wallet = separate hardware wallet
- [ ] Treasury wallet = separate hardware wallet
- [ ] Private keys never in codebase

## Payment Asset (Critical for Registration)
- [ ] defaultPaymentAsset = mainnet USDT address
- [ ] usdtAddress = mainnet USDT address
- [ ] enabledPaymentAssets[mainnet USDT] = true
- [ ] paymentAssetUnitPrice[mainnet USDT] = 10
- [ ] Test registration -> verify income distributed
- [ ] Core USDT balance = 0 before first registration ✅ (correct)
      (USDT comes IN when user registers)

## Contracts
- [ ] Security audit completed
- [ ] All contract sizes < 24KB (Core = 21.23KB ✅)
- [ ] Gas optimization reviewed
- [ ] verify-deployment.ts passes all checks
- [ ] UUPS upgrade keys secured

## Frontend
- [ ] productionMode = true in Core
- [ ] All VITE_ env vars set for mainnet
- [ ] No localhost URLs
- [ ] Error tracking enabled (Sentry etc.)
- [ ] Analytics setup

## Testing
- [ ] Full registration flow tested
- [ ] Auto-upgrade tested
- [ ] Rebirth tested
- [ ] Level income distribution verified
- [ ] Admin panel verified

## Launch
- [ ] Fund staking pool with MGX
- [ ] Set initial package prices
- [ ] Wire all contracts
- [ ] Run verify-deployment.ts ✅
- [ ] Root user registered

## Known Issue History
- [ ] opBNB Testnet deploy block 158940507:
      defaultPaymentAsset was set to mock USDT `0xF80Dd7c09539093d48e5Fd629d9731eA684d078F`
      causing `TRANSFER_FAILED` on all registrations
      fixed with `fix-payment-asset.ts`
