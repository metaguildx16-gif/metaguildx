# OPBNB Testnet Checklist

## Goal

Move MetaGuildX from localhost prototype usage to a real OPBNB testnet deployment flow.

## Required Inputs

Before starting, prepare:

- `DEPLOYER_PRIVATE_KEY`
- `OPBNB_TESTNET_RPC_URL`
- `VITE_PUBLIC_RPC_URL`

Recommended:

- use the same RPC value for `OPBNB_TESTNET_RPC_URL` and `VITE_PUBLIC_RPC_URL`
- use a dedicated deployer wallet for testnet

## Pre-Deploy Checklist

- `.env` is created from `.env.example`
- deployer private key is filled
- testnet RPC is filled
- frontend public RPC is updated from localhost to testnet
- deployer wallet has enough testnet gas balance
- local frontend is not still using an old localhost contract address

## Deploy Steps

1. Deploy contract:
   - `npm run deploy:opbnb:testnet`
2. Sync ABI and frontend address:
   - `npm run sync:web:opbnb:testnet`
3. Build frontend:
   - `npm run build:web`
4. Start frontend:
   - `npm run dev:web`

## Post-Deploy Validation

After deployment, verify:

- contract deployment file exists in `contracts/deployments/opbnbTestnet.json`
- `apps/web/.env.local` contains the deployed contract address
- frontend can load dashboard reads from testnet RPC
- wallet connects on the same testnet
- current running box information loads
- registration flow is reachable
- package upgrade flow is reachable
- dashboard pages load without localhost warnings

## Important Notes

- `seed:localhost` is only for local demo data
- do not use localhost seed flow on OPBNB testnet
- testnet should be treated as a real external environment, not an in-memory dev chain

## Recommended Next Validation Pass

After successful deployment:

1. connect a testnet wallet
2. verify dashboard read methods
3. verify registration transaction
4. verify next-package-only upgrade behavior
5. verify frontend sync after redeploy if contract address changes
