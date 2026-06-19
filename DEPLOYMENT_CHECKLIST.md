
## Bug #104 Fix (June 18, 2026)
- metaguildx.ts: singleton provider cache (30min TTL), pollingInterval 15s, mainnet fallback RPC
- App.tsx: staticNetwork:true + pollingInterval on all 3 inline providers
- Web .env: VITE_RPC_URL → opbnb-mainnet-rpc.bnbchain.org (NodeReal removed as primary)
- Admin .env: VITE_RPC_URL → opbnb-mainnet-rpc.bnbchain.org
- NodeReal API key retained as fallback only in getReadRpcUrls()
