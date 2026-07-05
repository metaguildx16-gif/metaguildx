import type { Signer } from "ethers";
import type {
  BridgeChain,
  BridgeQuote,
  BridgeToken,
  IBridgeProvider,
  QuoteParams,
  SwapResult,
  SwapStatus
} from "../types";

export const BNB_BRIDGE_URL = "https://opbnb-bridge.bnbchain.org/deposit";
export const BSC_CHAIN_ID = 56;
export const OPBNB_CHAIN_ID = 204;
export const BSC_TOKEN_HUB_ADDRESS = "0x0000000000000000000000000000000000001004";
export const OPBNB_L1_CROSS_CHAIN_MESSENGER_ADDRESS = "0x0000000000000000000000000000000000002000";
export const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
export const OPBNB_USDT_ADDRESS = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";
export const NATIVE_BNB_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const BSC_CHAIN: BridgeChain = {
  id: BSC_CHAIN_ID,
  key: "bsc",
  name: "BNB Smart Chain",
  chainType: "EVM",
  nativeToken: {
    address: NATIVE_BNB_ADDRESS,
    symbol: "BNB",
    decimals: 18,
    name: "BNB"
  }
};

const OPBNB_CHAIN: BridgeChain = {
  id: OPBNB_CHAIN_ID,
  key: "opbnb",
  name: "opBNB Mainnet",
  chainType: "EVM",
  nativeToken: {
    address: NATIVE_BNB_ADDRESS,
    symbol: "BNB",
    decimals: 18,
    name: "BNB"
  }
};

const TOKENS_BY_CHAIN: Record<number, BridgeToken[]> = {
  [BSC_CHAIN_ID]: [
    {
      chainId: BSC_CHAIN_ID,
      address: BSC_USDT_ADDRESS,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 18
    },
    {
      chainId: BSC_CHAIN_ID,
      address: NATIVE_BNB_ADDRESS,
      symbol: "BNB",
      name: "BNB",
      decimals: 18
    }
  ],
  [OPBNB_CHAIN_ID]: [
    {
      chainId: OPBNB_CHAIN_ID,
      address: OPBNB_USDT_ADDRESS,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 18
    },
    {
      chainId: OPBNB_CHAIN_ID,
      address: NATIVE_BNB_ADDRESS,
      symbol: "BNB",
      name: "BNB",
      decimals: 18
    }
  ]
};

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function tokenSymbolFor(chainId: number, tokenAddress: string) {
  return TOKENS_BY_CHAIN[chainId]?.find((token) => sameAddress(token.address, tokenAddress))?.symbol ?? "";
}

function isSupportedBridgePair(params: QuoteParams) {
  const fromSymbol = tokenSymbolFor(params.fromChainId, params.fromTokenAddress);
  const toSymbol = tokenSymbolFor(params.toChainId, params.toTokenAddress);
  return Boolean(fromSymbol && toSymbol && fromSymbol === toSymbol);
}

export class BNBBridgeAdapter implements IBridgeProvider {
  readonly name = "BNB Chain Bridge";
  readonly id = "bnbbridge";

  getChains(): Promise<BridgeChain[]> {
    return Promise.resolve([BSC_CHAIN, OPBNB_CHAIN]);
  }

  getTokens(chainId: number): Promise<BridgeToken[]> {
    return Promise.resolve(TOKENS_BY_CHAIN[chainId] ?? []);
  }

  getQuote(params: QuoteParams): Promise<BridgeQuote | null> {
    if (!this.supportsRoute(params.fromChainId, params.toChainId) || !isSupportedBridgePair(params)) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      action: {
        fromAmount: params.fromAmount,
        fromToken: TOKENS_BY_CHAIN[params.fromChainId]?.find((token) => sameAddress(token.address, params.fromTokenAddress)),
        toToken: TOKENS_BY_CHAIN[params.toChainId]?.find((token) => sameAddress(token.address, params.toTokenAddress))
      },
      estimate: {
        toAmount: params.fromAmount,
        toAmountMin: params.fromAmount,
        executionDuration: 600,
        feeCosts: [],
        gasCosts: []
      },
      includedSteps: [
        {
          type: "bridge",
          tool: "BNB Chain Bridge",
          toolDetails: { name: "BNB Chain Bridge" },
          estimate: {
            fromAmount: params.fromAmount,
            toAmount: params.fromAmount,
            executionDuration: 600
          }
        }
      ],
      tool: "BNB Chain Bridge"
    });
  }

  executeSwap(_quote: BridgeQuote, _signer: Signer): Promise<SwapResult> {
    window.open(BNB_BRIDGE_URL, "_blank", "noopener,noreferrer");
    return Promise.resolve({
      txHash: "",
      status: "unknown",
      explorerUrl: BNB_BRIDGE_URL
    });
  }

  getStatus(_txHash: string, _fromChainId: number, _toChainId: number): Promise<SwapStatus> {
    return Promise.resolve("unknown");
  }

  supportsRoute(fromChainId: number, toChainId: number): boolean {
    return (
      (fromChainId === BSC_CHAIN_ID && toChainId === OPBNB_CHAIN_ID) ||
      (fromChainId === OPBNB_CHAIN_ID && toChainId === BSC_CHAIN_ID)
    );
  }
}
