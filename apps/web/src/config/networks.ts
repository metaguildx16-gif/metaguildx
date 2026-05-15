export type NetworkKey = "local" | "testnet" | "mainnet";

export type NetworkConfig = {
  key: NetworkKey;
  label: string;
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  analyticsAddress: string;
  usdtAddress: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
};

function parseChainId(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNetworkKey(value: string | undefined): NetworkKey {
  if (value === "testnet" || value === "mainnet") {
    return value;
  }
  return "local";
}

export const activeNetworkKey = normalizeNetworkKey(import.meta.env.VITE_NETWORK);

export const networkConfigs: Record<NetworkKey, NetworkConfig> = {
  local: {
    key: "local",
    label: import.meta.env.VITE_LOCAL_CHAIN_NAME || "Localhost 8545",
    chainId: parseChainId(import.meta.env.VITE_LOCAL_CHAIN_ID, 31337),
    rpcUrl: import.meta.env.VITE_LOCAL_RPC_URL || import.meta.env.VITE_PUBLIC_RPC_URL || "",
    contractAddress: import.meta.env.VITE_LOCAL_CONTRACT_ADDRESS || import.meta.env.VITE_METAGUILDX_SYSTEM_ADDRESS || "",
    analyticsAddress: import.meta.env.VITE_LOCAL_ANALYTICS_ADDRESS || import.meta.env.VITE_METAGUILDX_ANALYTICS_ADDRESS || "",
    usdtAddress: import.meta.env.VITE_LOCAL_USDT_ADDRESS || "",
    nativeCurrency: {
      name: import.meta.env.VITE_LOCAL_CURRENCY_NAME || "ETH",
      symbol: import.meta.env.VITE_LOCAL_CURRENCY_SYMBOL || "ETH",
      decimals: 18
    },
    blockExplorerUrls: import.meta.env.VITE_LOCAL_EXPLORER_URL ? [import.meta.env.VITE_LOCAL_EXPLORER_URL] : []
  },
  testnet: {
    key: "testnet",
    label: import.meta.env.VITE_TESTNET_CHAIN_NAME || "MGX Testnet",
    chainId: parseChainId(import.meta.env.VITE_CHAIN_ID || import.meta.env.VITE_TESTNET_CHAIN_ID, 5611),
    rpcUrl: import.meta.env.VITE_TESTNET_RPC || import.meta.env.VITE_TESTNET_RPC_URL || "",
    contractAddress:
      import.meta.env.VITE_CORE_ADDRESS ||
      import.meta.env.VITE_SYSTEM_ADDRESS ||
      import.meta.env.VITE_ROUTER_ADDRESS ||
      import.meta.env.VITE_TESTNET_CONTRACT_ADDRESS ||
      import.meta.env.VITE_METAGUILDX_SYSTEM_ADDRESS ||
      "",
    analyticsAddress: import.meta.env.VITE_TESTNET_ANALYTICS_ADDRESS || import.meta.env.VITE_METAGUILDX_ANALYTICS_ADDRESS || "",
    usdtAddress: import.meta.env.VITE_USDT_ADDRESS || import.meta.env.VITE_TESTNET_USDT_ADDRESS || "",
    nativeCurrency: {
      name: import.meta.env.VITE_TESTNET_CURRENCY_NAME || "BNB",
      symbol: import.meta.env.VITE_TESTNET_CURRENCY_SYMBOL || "tBNB",
      decimals: 18
    },
    blockExplorerUrls: import.meta.env.VITE_TESTNET_EXPLORER_URL ? [import.meta.env.VITE_TESTNET_EXPLORER_URL] : []
  },
  mainnet: {
    key: "mainnet",
    label: import.meta.env.VITE_MAINNET_CHAIN_NAME || "MGX Mainnet",
    chainId: parseChainId(import.meta.env.VITE_MAINNET_CHAIN_ID, 204),
    rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL || "",
    contractAddress: import.meta.env.VITE_MAINNET_CONTRACT_ADDRESS || import.meta.env.VITE_METAGUILDX_SYSTEM_ADDRESS || "",
    analyticsAddress: import.meta.env.VITE_MAINNET_ANALYTICS_ADDRESS || import.meta.env.VITE_METAGUILDX_ANALYTICS_ADDRESS || "",
    usdtAddress: import.meta.env.VITE_MAINNET_USDT_ADDRESS || "",
    nativeCurrency: {
      name: import.meta.env.VITE_MAINNET_CURRENCY_NAME || "BNB",
      symbol: import.meta.env.VITE_MAINNET_CURRENCY_SYMBOL || "BNB",
      decimals: 18
    },
    blockExplorerUrls: import.meta.env.VITE_MAINNET_EXPLORER_URL ? [import.meta.env.VITE_MAINNET_EXPLORER_URL] : []
  }
};

export const activeNetworkConfig = networkConfigs[activeNetworkKey];

export function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}
