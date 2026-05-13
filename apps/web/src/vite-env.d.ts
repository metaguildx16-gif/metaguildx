/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: "local" | "testnet" | "mainnet";
  readonly VITE_METAGUILDX_SYSTEM_ADDRESS?: string;
  readonly VITE_METAGUILDX_ANALYTICS_ADDRESS?: string;
  readonly VITE_PUBLIC_RPC_URL?: string;
  readonly VITE_LOCAL_CHAIN_NAME?: string;
  readonly VITE_LOCAL_CHAIN_ID?: string;
  readonly VITE_LOCAL_RPC_URL?: string;
  readonly VITE_LOCAL_CONTRACT_ADDRESS?: string;
  readonly VITE_LOCAL_ANALYTICS_ADDRESS?: string;
  readonly VITE_LOCAL_USDT_ADDRESS?: string;
  readonly VITE_LOCAL_EXPLORER_URL?: string;
  readonly VITE_LOCAL_CURRENCY_NAME?: string;
  readonly VITE_LOCAL_CURRENCY_SYMBOL?: string;
  readonly VITE_TESTNET_CHAIN_NAME?: string;
  readonly VITE_TESTNET_CHAIN_ID?: string;
  readonly VITE_TESTNET_RPC_URL?: string;
  readonly VITE_TESTNET_CONTRACT_ADDRESS?: string;
  readonly VITE_TESTNET_ANALYTICS_ADDRESS?: string;
  readonly VITE_TESTNET_USDT_ADDRESS?: string;
  readonly VITE_TESTNET_EXPLORER_URL?: string;
  readonly VITE_TESTNET_CURRENCY_NAME?: string;
  readonly VITE_TESTNET_CURRENCY_SYMBOL?: string;
  readonly VITE_MAINNET_CHAIN_NAME?: string;
  readonly VITE_MAINNET_CHAIN_ID?: string;
  readonly VITE_MAINNET_RPC_URL?: string;
  readonly VITE_MAINNET_CONTRACT_ADDRESS?: string;
  readonly VITE_MAINNET_ANALYTICS_ADDRESS?: string;
  readonly VITE_MAINNET_USDT_ADDRESS?: string;
  readonly VITE_MAINNET_EXPLORER_URL?: string;
  readonly VITE_MAINNET_CURRENCY_NAME?: string;
  readonly VITE_MAINNET_CURRENCY_SYMBOL?: string;
  readonly VITE_MORALIS_API_KEY?: string;
  readonly VITE_BINARY_TREE_ADDRESS?: string;
  readonly VITE_INCOME_ROUTER_ADDRESS?: string;
  readonly VITE_INCOME_ENGINE_ADDRESS?: string;
  readonly VITE_UPGRADE_ENGINE_ADDRESS?: string;
  readonly VITE_CASHBACK_POOL_ADDRESS?: string;
  readonly VITE_MGX_STAKING_ADDRESS?: string;
  readonly VITE_MGX_TOKEN_ADDRESS?: string;
  readonly VITE_SYSTEM_ADDRESS?: string;
  readonly VITE_ROUTER_ADDRESS?: string;
  readonly VITE_TESTNET_RPC?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_USDT_ADDRESS?: string;
  readonly VITE_CREATOR_WALLET?: string;
  readonly VITE_PLACEMENT_SIGNER_URL?: string;
  readonly VITE_PLACEMENT_SIGNER_TOKEN?: string;
  readonly VITE_ADMIN_PANEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
    };
  }
}

export {};
