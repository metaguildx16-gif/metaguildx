// ============================================================
// MetaGuildX Cross-Chain Hub - Swap Engine
// ISOLATED MODULE - No dependency on C&B system
// ============================================================

export const ENABLE_MGX_SWAP = false;
export const TREASURY_WALLET = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
export const PLATFORM_FEE_BPS = 15;

export const SUPPORTED_CHAINS = [
  { id: 56,  key: "bsc",     name: "BNB Smart Chain", shortName: "BSC",   nativeCurrency: "BNB",  rpc: "https://bsc-dataseed.binance.org",           explorerUrl: "https://bscscan.com",     logoColor: "#F0B90B" },
  { id: 204, key: "opbnb",   name: "opBNB Mainnet",   shortName: "opBNB", nativeCurrency: "BNB",  rpc: "https://opbnb-mainnet-rpc.bnbchain.org",     explorerUrl: "https://opbnbscan.com",   logoColor: "#F0B90B" },
  { id: 137, key: "polygon", name: "Polygon",          shortName: "MATIC", nativeCurrency: "MATIC",rpc: "https://polygon-rpc.com",                    explorerUrl: "https://polygonscan.com", logoColor: "#8247E5" },
  { id: 1,   key: "eth",     name: "Ethereum",         shortName: "ETH",  nativeCurrency: "ETH",  rpc: "https://cloudflare-eth.com",                 explorerUrl: "https://etherscan.io",    logoColor: "#627EEA" },
] as const;

export type ChainKey = typeof SUPPORTED_CHAINS[number]["key"];

export const SUPPORTED_TOKENS = [
  {
    symbol: "USDT", name: "Tether USD", decimals: 18,
    addresses: {
      bsc:     "0x55d398326f99059fF775485246999027B3197955",
      opbnb:   "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3",
      polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      eth:     "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    }, coingeckoId: "tether",
  },
  {
    symbol: "USDC", name: "USD Coin", decimals: 6,
    addresses: {
      bsc:     "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      opbnb:   "0x",
      polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      eth:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    }, coingeckoId: "usd-coin",
  },
  {
    symbol: "BNB", name: "BNB", decimals: 18,
    addresses: {
      bsc:     "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      opbnb:   "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      polygon: "0x3BA4c387f786bFEE076A58914F5Bd38d668B42c",
      eth:     "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
    }, coingeckoId: "binancecoin",
  },
  {
    symbol: "ETH", name: "Ethereum", decimals: 18,
    addresses: {
      bsc:     "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      opbnb:   "0xE7798f023fC62146e8Aa1b36Da45fb70855a77Ea",
      polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      eth:     "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    }, coingeckoId: "ethereum",
  },
] as const;

export type TokenSymbol = typeof SUPPORTED_TOKENS[number]["symbol"];

export interface SwapQuote {
  fromChainId: number; toChainId: number;
  fromToken: string; toToken: string;
  fromAmount: string; toAmount: string; toAmountMin: string;
  estimatedGas: string; executionDuration: number;
  steps: RouteStep[];
  platformFeeAmount: string; platformFeeUsd: string;
  priceImpact: string; route: string;
}
export interface RouteStep {
  type: string; tool: string;
  toolDetails: { name: string; logoURI: string };
  estimate: { fromAmount: string; toAmount: string; executionDuration: number };
}
export interface TxRecord {
  txHash: string; fromChain: string; toChain: string;
  fromToken: string; toToken: string;
  fromAmount: string; toAmount: string;
  status: "pending" | "success" | "failed";
  timestamp: number; explorerUrl: string;
}

const LIFI_API = "https://li.quest/v1";

export async function getQuote(params: {
  fromChainId: number; toChainId: number;
  fromTokenAddress: string; toTokenAddress: string;
  fromAmount: string; fromAddress: string;
}): Promise<SwapQuote> {
  const url = new URL(`${LIFI_API}/quote`);
  url.searchParams.set("fromChain",    params.fromChainId.toString());
  url.searchParams.set("toChain",      params.toChainId.toString());
  url.searchParams.set("fromToken",    params.fromTokenAddress);
  url.searchParams.set("toToken",      params.toTokenAddress);
  url.searchParams.set("fromAmount",   params.fromAmount);
  url.searchParams.set("fromAddress",  params.fromAddress);
  url.searchParams.set("integrator",   "metaguildx");
  url.searchParams.set("fee",          (PLATFORM_FEE_BPS / 10000).toString());
  url.searchParams.set("feeRecipient", TREASURY_WALLET);
  url.searchParams.set("referrer",     TREASURY_WALLET);

  const apiKey = import.meta.env.VITE_LIFI_API_KEY || "";
  const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json", ...(apiKey ? { "x-lifi-api-key": apiKey } : {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Failed to get quote");
  }
  const data = await res.json() as {
    action?: { fromAmount?: string };
    estimate?: {
      toAmount?: string; toAmountMin?: string;
      gasCosts?: Array<{ estimate?: string }>;
      executionDuration?: number;
      feeCosts?: Array<{ amount?: string; amountUSD?: string }>;
      fromAmountUSD?: string; toAmountUSD?: string;
    };
    steps?: RouteStep[]; tool?: string; includedSteps?: RouteStep[];
  };
  const fromUsd = parseFloat(data.estimate?.fromAmountUSD ?? "0");
  const toUsd   = parseFloat(data.estimate?.toAmountUSD ?? "0");
  return {
    fromChainId: params.fromChainId, toChainId: params.toChainId,
    fromToken: params.fromTokenAddress, toToken: params.toTokenAddress,
    fromAmount: data.action?.fromAmount ?? params.fromAmount,
    toAmount: data.estimate?.toAmount ?? "0",
    toAmountMin: data.estimate?.toAmountMin ?? "0",
    estimatedGas: data.estimate?.gasCosts?.[0]?.estimate ?? "0",
    executionDuration: data.estimate?.executionDuration ?? 0,
    steps: data.includedSteps ?? data.steps ?? [],
    platformFeeAmount: data.estimate?.feeCosts?.[0]?.amount ?? "0",
    platformFeeUsd: data.estimate?.feeCosts?.[0]?.amountUSD ?? "0",
    priceImpact: fromUsd > 0 ? (((fromUsd - toUsd) / fromUsd) * 100).toFixed(2) : "0.00",
    route: data.tool ?? "LI.FI",
  };
}

export async function getSwapStatus(txHash: string, fromChainId: number, toChainId: number): Promise<string> {
  const res = await fetch(`${LIFI_API}/status?txHash=${txHash}&fromChain=${fromChainId}&toChain=${toChainId}`);
  if (!res.ok) return "PENDING";
  const data = await res.json() as { status?: string };
  return data.status ?? "PENDING";
}

const TX_KEY = "mgx_cc_tx_history";
export function saveTxRecord(r: TxRecord): void {
  const list = getTxHistory(); list.unshift(r);
  localStorage.setItem(TX_KEY, JSON.stringify(list.slice(0, 50)));
}
export function getTxHistory(): TxRecord[] {
  try { return JSON.parse(localStorage.getItem(TX_KEY) ?? "[]") as TxRecord[]; } catch { return []; }
}
export function formatDuration(s: number): string { return s < 60 ? `~${s}s` : `~${Math.ceil(s/60)}min`; }
export function formatTokenAmount(amount: string, decimals: number, dp = 4): string {
  try { return (Number(BigInt(amount)) / Math.pow(10, decimals)).toFixed(dp); } catch { return "0.0000"; }
}
export function getTokenAddress(symbol: TokenSymbol, chainKey: ChainKey): string {
  const t = SUPPORTED_TOKENS.find((t) => t.symbol === symbol);
  return t ? (t.addresses as Record<string, string>)[chainKey] ?? "" : "";
}
export function getChainById(id: number) { return SUPPORTED_CHAINS.find((c) => c.id === id); }
