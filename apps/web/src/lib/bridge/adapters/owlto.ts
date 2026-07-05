import { Bridge } from "owlto-sdk";
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

const BSC_CHAIN_ID = 56;
const OPBNB_CHAIN_ID = 204;
const ETH_CHAIN_ID = 1;
const POLYGON_CHAIN_ID = 137;
const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const OPBNB_USDT_ADDRESS = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";
const NATIVE_BNB_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const CHAIN_NAME_BY_ID: Record<number, string> = {
  [BSC_CHAIN_ID]: "BNBChainMainnet",
  [OPBNB_CHAIN_ID]: "opBNBMainnet",
  [ETH_CHAIN_ID]: "EthereumMainnet",
  [POLYGON_CHAIN_ID]: "PolygonMainnet"
};

const owltoBridge = new Bridge({});

const BRIDGE_CHAINS: BridgeChain[] = [
  {
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
  },
  {
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
  }
];

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

function findToken(chainId: number, address: string) {
  return TOKENS_BY_CHAIN[chainId]?.find((token) => sameAddress(token.address, address));
}

function hasRouteInPairs(pairs: unknown, params: QuoteParams) {
  const fromChain = CHAIN_NAME_BY_ID[params.fromChainId];
  const toChain = CHAIN_NAME_BY_ID[params.toChainId];
  const fromToken = findToken(params.fromChainId, params.fromTokenAddress)?.symbol;
  const toToken = findToken(params.toChainId, params.toTokenAddress)?.symbol;
  if (!fromChain || !toChain || !fromToken || !toToken || fromToken !== toToken) {
    return false;
  }
  const haystack = JSON.stringify(pairs).toLowerCase();
  return (
    haystack.includes(fromChain.toLowerCase()) &&
    haystack.includes(toChain.toLowerCase()) &&
    haystack.includes(fromToken.toLowerCase())
  );
}

function normalizeStatus(receipt: unknown): SwapStatus {
  const status = typeof receipt === "object" && receipt
    ? String((receipt as { status?: unknown }).status ?? "").toLowerCase()
    : "";
  if (["success", "done", "completed", "complete"].includes(status)) return "success";
  if (["failed", "failure", "error"].includes(status)) return "failed";
  if (["pending", "running", "processing"].includes(status)) return "pending";
  return "unknown";
}

export class OwltoAdapter implements IBridgeProvider {
  readonly name = "Owlto Finance";
  readonly id = "owlto";

  supportsRoute(fromChainId: number, toChainId: number): boolean {
    return (
      (fromChainId === BSC_CHAIN_ID && toChainId === OPBNB_CHAIN_ID) ||
      (fromChainId === OPBNB_CHAIN_ID && toChainId === BSC_CHAIN_ID)
    );
  }

  getChains(): Promise<BridgeChain[]> {
    return Promise.resolve(BRIDGE_CHAINS);
  }

  getTokens(chainId: number): Promise<BridgeToken[]> {
    return Promise.resolve(TOKENS_BY_CHAIN[chainId] ?? []);
  }

  async getQuote(params: QuoteParams): Promise<BridgeQuote | null> {
    try {
      if (!this.supportsRoute(params.fromChainId, params.toChainId)) {
        return null;
      }
      const fromToken = findToken(params.fromChainId, params.fromTokenAddress);
      const toToken = findToken(params.toChainId, params.toTokenAddress);
      if (!fromToken || !toToken || fromToken.symbol !== toToken.symbol) {
        return null;
      }
      const pairs = await owltoBridge.getAllPairInfos();
      if (!pairs || !hasRouteInPairs(pairs, params)) {
        return null;
      }
      return {
        provider: "owlto",
        estimatedOutput: params.fromAmount,
        fee: { protocol: "Gas only", platform: "0%" },
        estimatedTime: "5-15 minutes",
        routeName: "Owlto Finance",
        action: {
          fromAmount: params.fromAmount,
          fromToken,
          toToken
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
            tool: "Owlto Finance",
            toolDetails: { name: "Owlto Finance" },
            estimate: {
              fromAmount: params.fromAmount,
              toAmount: params.fromAmount,
              executionDuration: 600
            }
          }
        ],
        tool: "Owlto Finance"
      };
    } catch {
      return null;
    }
  }

  executeSwap(_quote: BridgeQuote, _signer: Signer): Promise<SwapResult> {
    throw new Error("Phase 3B: Live transactions not yet enabled");
  }

  async getStatus(txHash: string, _fromChainId: number, _toChainId: number): Promise<SwapStatus> {
    try {
      const receipt = await owltoBridge.getReceipt(txHash);
      if (receipt?.toChainHash) {
        return "success";
      }
      return normalizeStatus(receipt);
    } catch {
      return "unknown";
    }
  }
}
