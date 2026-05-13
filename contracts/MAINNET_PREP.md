# Mainnet Preparation Checklist

## Security
- [ ] VITE_LOCAL_PLACEMENT_SIGNER_KEY removed from .env
- [ ] Placement signer = hardware wallet address
- [ ] Owner = hardware wallet (multisig preferred)
- [ ] Creator fee wallet = separate hardware wallet
- [ ] Treasury wallet = separate hardware wallet
- [ ] Private keys never in codebase

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
