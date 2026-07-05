# MetaGuildX Cross-Chain Bridge — Architecture Status

## Architecture
- Provider Adapter Pattern (IBridgeProvider interface)
- Files: bridge/types.ts, bridge/registry.ts, bridge/index.ts
- Adapters: LiFiAdapter (active), BNBBridgeAdapter (reference only)

## Supported Routes (Active)
- BSC ↔ Ethereum
- BSC ↔ Polygon
- BSC ↔ Arbitrum
- BSC ↔ Avalanche
- BSC ↔ Linea
- All other LI.FI supported chains
- Provider: LI.FI API (li.quest/v1)
- Fee: 0.15% to treasury wallet

## Unsupported Routes
- BSC ↔ opBNB: NOT available
- Reason: LI.FI has no opBNB routes (API error 1002)
- owlto-sdk v0.2.5 does not include opBNB pairs in getAllPairInfos()
- Thirdweb rejected: unverified USDT support, Dec 2025 exploit, bundle size

## opBNB Status
- UI shows "Coming Soon" message
- No broken flow, no redirect, no disabled buttons
- Will be enabled when a production-ready provider confirms USDT support

## Future Upgrade Path
- Monitor LI.FI changelog for opBNB support
- Monitor owlto-sdk releases for opBNB pairs
- When available: add ThirdwebAdapter or OwltoAdapter to bridge/adapters/
- Register in registry.ts: if opBNB route → return new [Provider]Adapter()
- Zero UI changes needed

## Security Notes
- VITE_LIFI_API_KEY: restrict by domain in LI.FI dashboard
- Treasury wallet: 0x63450D17A86E41ad7571040105a80c5860C6655b
- Fee: 0.15% platform fee on all swaps

## Decision Log
- 2026-07-05: Owlto removed (SDK v0.2.5 no opBNB pairs)
- 2026-07-05: Thirdweb rejected (vendor lock-in, security concerns)
- 2026-07-05: opBNB route shows Coming Soon pending native provider
