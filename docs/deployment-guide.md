# Deployment Guide

## Local Deployment

1. Copy `.env.example` to `.env` and keep the default localhost RPC URL.
2. Start a local node:
   - `npm run dev:contracts`
3. In a second terminal, deploy:
   - `npm run deploy:localhost`
4. Sync the frontend contract address and ABI:
   - `npm run sync:web:localhost`
5. Seed demo data for the dashboard:
   - `npm run seed:localhost`
6. Start the frontend:
   - `npm run dev:web`

## OPBNB Deployment

1. Add `DEPLOYER_PRIVATE_KEY` and the target RPC URL to `.env`.
2. For testnet frontend reads, also set `VITE_PUBLIC_RPC_URL` to the same OPBNB testnet RPC.
3. Make sure the deployer wallet has enough native gas balance on the target chain.
4. Deploy to the intended network:
   - `npm run deploy:opbnb:testnet`
   - or `npm run deploy:opbnb:mainnet`
5. Sync the frontend:
   - `npm run sync:web:opbnb:testnet`
   - or `npm run sync:web:opbnb:mainnet`
6. Start the frontend and test wallet connection:
   - `npm run dev:web`
7. Connect the wallet to the same network and verify:
   - registration
   - package upgrade
   - current running box display
   - dashboard reads

## OPBNB Testnet Preparation Checklist

Before deploying to OPBNB testnet, confirm:

- `.env` exists and contains `DEPLOYER_PRIVATE_KEY`
- `.env` contains `OPBNB_TESTNET_RPC_URL`
- `.env` contains `VITE_PUBLIC_RPC_URL` for testnet reads
- deployer wallet has testnet gas balance
- frontend is not still pointing to localhost RPC
- previous localhost `.env.local` values are replaced by the sync step

Recommended command order:

1. `npm run deploy:opbnb:testnet`
2. `npm run sync:web:opbnb:testnet`
3. `npm run build:web`
4. `npm run dev:web`

Important note:

- `seed:localhost` is for local demo only
- do not run localhost seeding against testnet

## Output Files

- Deployment metadata is written to `contracts/deployments/<network>.json`
- Frontend ABI copy is written to `apps/web/src/generated/MetaGuildXSystem.json`
- Frontend contract address is written to `apps/web/.env.local`
