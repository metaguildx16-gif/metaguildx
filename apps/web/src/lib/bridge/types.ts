import type { Signer } from "ethers";

export type BridgeChain = {
  id: number;
  key?: string;
  name: string;
  chainType?: string;
  logoURI?: string;
  nativeToken?: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    logoURI?: string;
    priceUSD?: string;
  };
};

export type BridgeToken = {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  priceUSD?: string;
};

export type RouteStep = {
  type: string;
  tool: string;
  toolDetails?: { name?: string; logoURI?: string };
  estimate?: { fromAmount?: string; toAmount?: string; executionDuration?: number };
};

export type QuoteParams = {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
};

export type BridgeQuote = {
  provider?: string;
  estimatedOutput?: string;
  fee?: {
    protocol?: string;
    platform?: string;
  };
  estimatedTime?: string;
  routeName?: string;
  action?: {
    fromAmount?: string;
    fromToken?: BridgeToken;
    toToken?: BridgeToken;
  };
  estimate?: {
    toAmount?: string;
    toAmountMin?: string;
    executionDuration?: number;
    fromAmountUSD?: string;
    toAmountUSD?: string;
    feeCosts?: Array<{ amount?: string; amountUSD?: string; name?: string; token?: BridgeToken }>;
    gasCosts?: Array<{ estimate?: string; amountUSD?: string }>;
  };
  includedSteps?: RouteStep[];
  steps?: RouteStep[];
  tool?: string;
  transactionRequest?: {
    to: string;
    data?: string;
    value?: string;
    gasLimit?: string;
    gasPrice?: string;
    from?: string;
  };
};

export type SwapStatus = "pending" | "success" | "failed" | "unknown";

export type SwapResult = {
  txHash: string;
  status: SwapStatus;
  explorerUrl?: string;
};

export interface IBridgeProvider {
  readonly name: string;
  readonly id: string;
  getChains(): Promise<BridgeChain[]>;
  getTokens(chainId: number): Promise<BridgeToken[]>;
  getQuote(params: QuoteParams): Promise<BridgeQuote | null>;
  executeSwap(quote: BridgeQuote, signer: Signer): Promise<SwapResult>;
  getStatus(txHash: string, fromChainId: number, toChainId: number): Promise<SwapStatus>;
  supportsRoute(fromChainId: number, toChainId: number): boolean;
}
