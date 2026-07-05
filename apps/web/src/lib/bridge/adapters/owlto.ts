import { Bridge } from "owlto-sdk";
import type { Signer, TransactionRequest } from "ethers";
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
const OWLTO_LIVE_ENABLED = false;

const CHAIN_NAME_BY_ID: Record<number, string> = {
  [BSC_CHAIN_ID]: "BNBChainMainnet",
  [OPBNB_CHAIN_ID]: "opBNBMainnet",
  [ETH_CHAIN_ID]: "EthereumMainnet",
  [POLYGON_CHAIN_ID]: "PolygonMainnet"
};

const owltoBridge = new Bridge({});

type OwltoExecutionQuote = BridgeQuote & {
  fromChainId: number;
  toChainId: number;
  fromToken: BridgeToken;
  toToken: BridgeToken;
  inputAmount: string;
  outputAmount: string;
  provider: "owlto";
};

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

function getOwltoChainName(chainId: number): string {
  if (chainId === BSC_CHAIN_ID) return "BNBChainMainnet";
  if (chainId === OPBNB_CHAIN_ID) return "opBNBMainnet";
  throw new Error(`Unsupported Owlto chain: ${chainId}`);
}

function getOwltoTokenName(symbol: string): string {
  if (symbol === "USDT") return "USDT";
  if (symbol === "BNB") return "BNB";
  throw new Error(`Unsupported Owlto token: ${symbol}`);
}

function hasRouteInPairs(pairs: unknown, params: QuoteParams) {
  let fromChain = "";
  let toChain = "";
  try {
    fromChain = getOwltoChainName(params.fromChainId);
    toChain = getOwltoChainName(params.toChainId);
  } catch {
    return false;
  }
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

function normalizeBuildTxBody(body: unknown): TransactionRequest {
  const tx = (body ?? {}) as Record<string, unknown>;
  return {
    to: typeof tx.to === "string" ? tx.to : undefined,
    data: typeof tx.data === "string" ? tx.data : "0x",
    value: tx.value !== undefined && tx.value !== null ? BigInt(String(tx.value)) : undefined,
    gasLimit: tx.gasLimit !== undefined && tx.gasLimit !== null ? BigInt(String(tx.gasLimit)) : undefined,
    gasPrice: tx.gasPrice !== undefined && tx.gasPrice !== null ? BigInt(String(tx.gasPrice)) : undefined
  };
}

function getUserFriendlyOwltoError(error: unknown): Error {
  const err = error as { code?: unknown; message?: string };
  const message = err.message ?? "Unknown error";
  if (err.code === 4001 || err.code === "ACTION_REJECTED") {
    return new Error("Transaction cancelled by user");
  }
  if (message.toLowerCase().includes("insufficient funds")) {
    return new Error("Insufficient funds for transaction");
  }
  return new Error(`Bridge failed: ${message}`);
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
      const quote: OwltoExecutionQuote = {
        provider: "owlto",
        fromChainId: params.fromChainId,
        toChainId: params.toChainId,
        fromToken,
        toToken,
        inputAmount: params.fromAmount,
        outputAmount: params.fromAmount,
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
      return quote;
    } catch {
      return null;
    }
  }

  async executeSwap(quote: BridgeQuote, signer: Signer): Promise<SwapResult> {
    if (!OWLTO_LIVE_ENABLED) {
      throw new Error("Owlto live transactions not yet enabled for production");
    }

    try {
      const owltoQuote = quote as Partial<OwltoExecutionQuote>;
      if (!owltoQuote.fromChainId || !owltoQuote.toChainId || !owltoQuote.fromToken || !owltoQuote.toToken || !owltoQuote.inputAmount) {
        throw new Error("Invalid Owlto quote");
      }

      const network = await signer.provider?.getNetwork();
      const currentChainId = network ? Number(network.chainId) : 0;
      if (currentChainId !== owltoQuote.fromChainId) {
        throw new Error(`Wrong network. Please switch to ${getOwltoChainName(owltoQuote.fromChainId)}`);
      }

      const fromAddress = await signer.getAddress();
      const bridge = new Bridge({});
      const tokenName = getOwltoTokenName(owltoQuote.fromToken.symbol);
      const fromChainName = getOwltoChainName(owltoQuote.fromChainId);
      const toChainName = getOwltoChainName(owltoQuote.toChainId);
      const buildResult = await bridge.getBuildTx(
        tokenName,
        fromChainName,
        toChainName,
        owltoQuote.inputAmount.toString(),
        fromAddress,
        fromAddress
      );
      console.log("[Bridge:Owlto] Build tx result:", buildResult);

      if (buildResult.txs?.approveBody) {
        console.log("[Bridge:Owlto] Approval required, sending approval tx...");
        const approveTx = await signer.sendTransaction(normalizeBuildTxBody(buildResult.txs.approveBody));
        console.log("[Bridge:Owlto] Approval tx hash:", approveTx.hash);
        await approveTx.wait();
        console.log("[Bridge:Owlto] Approval confirmed");
      }

      console.log("[Bridge:Owlto] Sending transfer tx...");
      const transferTx = await signer.sendTransaction(normalizeBuildTxBody(buildResult.txs?.transferBody));
      console.log("[Bridge:Owlto] Transfer tx hash:", transferTx.hash);
      await transferTx.wait();
      console.log("[Bridge:Owlto] Transfer confirmed on source chain");

      const result: SwapResult & {
        fromChainId: number;
        toChainId: number;
        fromToken: BridgeToken;
        toToken: BridgeToken;
        inputAmount: string;
        outputAmount: string;
        provider: "owlto";
      } = {
        txHash: transferTx.hash,
        status: "pending",
        fromChainId: owltoQuote.fromChainId,
        toChainId: owltoQuote.toChainId,
        fromToken: owltoQuote.fromToken,
        toToken: owltoQuote.toToken,
        inputAmount: owltoQuote.inputAmount,
        outputAmount: owltoQuote.outputAmount ?? owltoQuote.inputAmount,
        provider: "owlto"
      };
      return result;
    } catch (error) {
      throw getUserFriendlyOwltoError(error);
    }
  }

  async getStatus(txHash: string, _fromChainId: number, _toChainId: number): Promise<SwapStatus> {
    try {
      const bridge = new Bridge({});
      const receipt = await bridge.getReceipt(txHash);
      console.log("[Bridge:Owlto] Status for", txHash, ":", receipt);
      const code = (receipt as unknown as { code?: number | string | null })?.code;
      const toChainHash = (receipt as unknown as { toChainHash?: string | null })?.toChainHash;
      if (receipt === null) return "pending";
      if (typeof toChainHash === "string" && toChainHash.length > 0) return "success";
      if (code === 1) return "success";
      if (code === -1) return "failed";
      return "pending";
    } catch {
      return "pending";
    }
  }
}
