import { BrowserProvider, Contract, formatUnits } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BSC_USDT,
  DEFAULT_SLIPPAGE,
  OPBNB_USDT,
  RANGO_REFERRER_ADDRESS,
  RANGO_REFERRER_FEE,
  getRangoMeta,
  getRangoQuote,
  getRangoStatus,
  getRangoSwap,
  type RangoAsset,
  type RangoBlockchain,
  type RangoQuoteResponse,
  type RangoToken
} from "../lib/rango";

const HISTORY_KEY = "mgx_crosschain_history";
const MGX_SYMBOL = "MGX";
const ZERO_NATIVE_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const POPULAR_CHAIN_ORDER = ["BSC", "ETH", "POLYGON", "OPBNB", "ARBITRUM", "AVAX_CCHAIN", "AVALANCHE"];
const CHAIN_ALIASES: Record<string, string[]> = {
  BSC: ["BSC", "BNB", "BNB SMART CHAIN", "BINANCE"],
  ETH: ["ETH", "ETHEREUM"],
  POLYGON: ["POLYGON", "MATIC"],
  OPBNB: ["OPBNB", "OP BNB"],
  ARBITRUM: ["ARBITRUM", "ARBITRUM ONE"],
  AVAX_CCHAIN: ["AVAX_CCHAIN", "AVALANCHE", "AVAX"]
};
const EXPLORERS: Record<string, string> = {
  BSC: "https://bscscan.com/tx/",
  ETH: "https://etherscan.io/tx/",
  POLYGON: "https://polygonscan.com/tx/",
  OPBNB: "https://opbnbscan.com/tx/",
  ARBITRUM: "https://arbiscan.io/tx/",
  AVAX_CCHAIN: "https://snowtrace.io/tx/"
};

type SwapHistoryRow = {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  outputAmount: string;
  status: "running" | "success" | "failed";
  txHash: string;
  timestamp: number;
};

type ParsedQuote = {
  outputAmount: string;
  estimatedTimeInSeconds: number | null;
  routeName: string;
  priceImpact: string | null;
  feeLabel: string | null;
  requestId: string | null;
};

type TxModalState = {
  status: "pending" | "success" | "failed";
  title: string;
  detail: string;
  txHash?: string;
  explorerUrl?: string;
};

const S = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top left,rgba(56,189,248,.18),transparent 32%), #0f172a",
    color: "#f1f5f9",
    fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
    padding: "24px 16px 48px",
    boxSizing: "border-box"
  } as CSSProperties,
  container: { width: "100%", maxWidth: 760, margin: "0 auto" } as CSSProperties,
  header: { textAlign: "center", marginBottom: 28 } as CSSProperties,
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#38bdf8,#2563eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    fontSize: 24,
    boxShadow: "0 0 34px rgba(56,189,248,0.34)"
  } as CSSProperties,
  h1: {
    margin: "0 0 6px",
    fontSize: 28,
    fontWeight: 800,
    background: "linear-gradient(90deg,#f1f5f9,#38bdf8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  } as CSSProperties,
  subtitle: { margin: "0 0 16px", color: "#94a3b8", fontSize: 13 } as CSSProperties,
  badges: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 } as CSSProperties,
  badge: {
    padding: "5px 11px",
    borderRadius: 20,
    border: "1px solid rgba(56,189,248,.28)",
    background: "rgba(56,189,248,.08)",
    color: "#bae6fd",
    fontSize: 11,
    fontWeight: 700
  } as CSSProperties,
  card: {
    background: "linear-gradient(180deg,rgba(30,41,59,.96),rgba(15,23,42,.96))",
    border: "1px solid #334155",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 24px 80px rgba(0,0,0,.28)"
  } as CSSProperties,
  section: {
    border: "1px solid rgba(51,65,85,.86)",
    background: "rgba(15,23,42,.58)",
    borderRadius: 18,
    padding: 16
  } as CSSProperties,
  label: { color: "#94a3b8", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 } as CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } as CSSProperties,
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f1f5f9",
    borderRadius: 12,
    padding: "12px 13px",
    fontSize: 14,
    outline: "none"
  } as CSSProperties,
  amountInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    color: "#f1f5f9",
    fontSize: 30,
    fontWeight: 800,
    outline: "none",
    padding: "12px 0 4px"
  } as CSSProperties,
  selectedToken: { display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 12, minHeight: 22 } as CSSProperties,
  logo: { width: 20, height: 20, borderRadius: "50%", objectFit: "cover", background: "#1e293b" } as CSSProperties,
  helper: { color: "#64748b", fontSize: 12, marginTop: 6 } as CSSProperties,
  reverseWrap: { display: "flex", justifyContent: "center", margin: "12px 0" } as CSSProperties,
  reverseBtn: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "1px solid rgba(56,189,248,.5)",
    background: "linear-gradient(135deg,rgba(56,189,248,.24),rgba(37,99,235,.28))",
    color: "#38bdf8",
    cursor: "pointer",
    fontSize: 19
  } as CSSProperties,
  quoteBox: {
    marginTop: 16,
    padding: 15,
    borderRadius: 16,
    background: "rgba(56,189,248,.08)",
    border: "1px solid rgba(56,189,248,.22)"
  } as CSSProperties,
  qrow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", color: "#cbd5e1", fontSize: 13 } as CSSProperties,
  qlabel: { color: "#94a3b8" } as CSSProperties,
  error: { marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.34)", color: "#fecaca", fontSize: 13 } as CSSProperties,
  actionBtn: (disabled: boolean): CSSProperties => ({
    width: "100%",
    marginTop: 16,
    border: "none",
    borderRadius: 15,
    padding: "15px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#64748b" : "#06111f",
    background: disabled ? "#1e293b" : "linear-gradient(135deg,#38bdf8,#22c55e)",
    fontSize: 16,
    fontWeight: 800,
    boxShadow: disabled ? "none" : "0 16px 36px rgba(56,189,248,.24)"
  }),
  history: { marginTop: 20, background: "rgba(30,41,59,.62)", border: "1px solid #334155", borderRadius: 20, padding: 18 } as CSSProperties,
  historyRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "12px 0", borderTop: "1px solid rgba(51,65,85,.6)" } as CSSProperties,
  pill: (status: SwapHistoryRow["status"]): CSSProperties => ({
    alignSelf: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 800,
    color: status === "success" ? "#bbf7d0" : status === "failed" ? "#fecaca" : "#fde68a",
    background: status === "success" ? "rgba(34,197,94,.15)" : status === "failed" ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)"
  }),
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2,6,23,.74)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 50
  } as CSSProperties,
  modal: { width: "100%", maxWidth: 390, background: "#1e293b", border: "1px solid #334155", borderRadius: 22, padding: 24, textAlign: "center" } as CSSProperties,
  spinner: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    border: "3px solid rgba(56,189,248,.18)",
    borderTopColor: "#38bdf8",
    animation: "mgx-spin .8s linear infinite",
    margin: "0 auto 16px"
  } as CSSProperties
} as const;

function getExplorerUrl(blockchain: string, txHash: string) {
  const base = EXPLORERS[blockchain.toUpperCase()];
  return base ? `${base}${txHash}` : "";
}

function readHistory(): SwapHistoryRow[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as SwapHistoryRow[];
  } catch {
    return [];
  }
}

function writeHistory(rows: SwapHistoryRow[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows.slice(0, 5)));
}

function chainLabel(chain?: RangoBlockchain) {
  return chain?.displayName || chain?.shortName || chain?.name || "";
}

function chainLogo(chain?: RangoBlockchain) {
  return chain?.logo || chain?.logoUrl || chain?.image || "";
}

function tokenLogo(token?: RangoToken | null) {
  return token?.image || token?.logoURI || "";
}

function normalizeAddress(address?: string | null) {
  return (address || "").toLowerCase();
}

function isNativeToken(token: RangoToken | null) {
  const address = normalizeAddress(token?.address);
  return !address || address === "0x" || address === ZERO_NATIVE_ADDRESS;
}

function tokenUsdValue(token: RangoToken | null, amount: string) {
  const usdPrice = Number(token?.usdPrice ?? 0);
  const parsedAmount = Number(amount || "0");
  if (!Number.isFinite(usdPrice) || !Number.isFinite(parsedAmount) || usdPrice <= 0 || parsedAmount <= 0) {
    return "";
  }
  return `≈ $${(usdPrice * parsedAmount).toFixed(2)}`;
}

function selectedAsset(token: RangoToken | null, fallback: RangoAsset): RangoAsset {
  return {
    blockchain: token?.blockchain || fallback.blockchain,
    symbol: token?.symbol || fallback.symbol,
    address: token?.address ?? fallback.address
  };
}

function pickDefaultToken(tokens: RangoToken[], blockchain: string, address: string, symbol = "USDT") {
  const byAddress = tokens.find(
    (token) => token.blockchain === blockchain && normalizeAddress(token.address) === normalizeAddress(address)
  );
  return byAddress || tokens.find((token) => token.blockchain === blockchain && token.symbol === symbol) || null;
}

function deepFindString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }
  for (const candidate of Object.values(record)) {
    const nested = deepFindString(candidate, keys);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function parseQuote(quote: RangoQuoteResponse | null): ParsedQuote | null {
  if (!quote) {
    return null;
  }
  return {
    outputAmount: deepFindString(quote, ["outputAmount", "toAmount", "amountOut", "expectedOutput"]) ?? "0",
    estimatedTimeInSeconds: Number(deepFindString(quote, ["estimatedTimeInSeconds", "estimatedTime", "duration"]) ?? 0) || null,
    routeName: deepFindString(quote, ["swapper", "swapperTitle", "swapperId", "route", "tool"]) ?? "Best Rango route",
    priceImpact: deepFindString(quote, ["priceImpact", "priceImpactPercent"]),
    feeLabel: deepFindString(quote, ["fee", "feeAmount", "platformFee"]),
    requestId: deepFindString(quote, ["requestId"])
  };
}

function parseSwapTx(swap: Record<string, unknown>) {
  const tx = (swap.tx || swap.transaction || swap) as Record<string, unknown>;
  return {
    to: deepFindString(tx, ["to", "txTo", "target"]),
    data: deepFindString(tx, ["data", "txData"]) ?? "0x",
    value: deepFindString(tx, ["value"]) ?? "0",
    gasLimit: deepFindString(tx, ["gasLimit", "gas"]),
    gasPrice: deepFindString(tx, ["gasPrice"]),
    requestId: deepFindString(swap, ["requestId"])
  };
}

function toBigIntValue(value?: string | null) {
  if (!value) {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function isSameChainName(value: string, canonical: string) {
  const normalized = value.toUpperCase();
  return normalized === canonical || (CHAIN_ALIASES[canonical] ?? []).includes(normalized);
}

function sortPopularChains(chains: RangoBlockchain[]) {
  return POPULAR_CHAIN_ORDER
    .map((canonical) => chains.find((chain) => isSameChainName(chain.name, canonical)))
    .filter((chain): chain is RangoBlockchain => Boolean(chain));
}

function TokenSelector(props: {
  label: string;
  chain: string;
  chains: RangoBlockchain[];
  tokens: RangoToken[];
  value: RangoToken | null;
  search: string;
  onSearch: (value: string) => void;
  onChainChange: (chain: string) => void;
  onTokenChange: (token: RangoToken | null) => void;
  amount?: string;
  onAmountChange?: (amount: string) => void;
  outputAmount?: string;
  usdValue?: string;
}) {
  const filteredTokens = props.tokens
    .filter((token) => token.blockchain === props.chain && token.symbol.toUpperCase() !== MGX_SYMBOL)
    .filter((token) => {
      const q = props.search.trim().toLowerCase();
      if (!q) {
        return true;
      }
      return token.symbol.toLowerCase().includes(q) || (token.name ?? "").toLowerCase().includes(q);
    })
    .slice(0, 120);

  return (
    <div style={S.section}>
      <div style={S.label}>{props.label}</div>
      <div style={S.grid}>
        <select style={S.input} value={props.chain} onChange={(event) => props.onChainChange(event.target.value)}>
          {props.chains.map((chain) => (
            <option key={chain.name} value={chain.name}>
              {chainLabel(chain)}
            </option>
          ))}
        </select>
        <select
          style={S.input}
          value={`${props.value?.blockchain ?? ""}:${props.value?.symbol ?? ""}:${props.value?.address ?? ""}`}
          onChange={(event) => {
            const [, symbol, address] = event.target.value.split(":");
            props.onTokenChange(
              filteredTokens.find((token) => token.symbol === symbol && String(token.address ?? "") === address) ?? null
            );
          }}
        >
          {filteredTokens.map((token) => (
            <option key={`${token.blockchain}:${token.symbol}:${token.address ?? "native"}`} value={`${token.blockchain}:${token.symbol}:${token.address ?? ""}`}>
              {token.symbol} - {token.name ?? token.symbol}
            </option>
          ))}
        </select>
      </div>
      <input
        style={{ ...S.input, marginTop: 10 }}
        value={props.search}
        onChange={(event) => props.onSearch(event.target.value)}
        placeholder="Search token..."
      />
      <div style={S.selectedToken}>
        {tokenLogo(props.value) ? <img src={tokenLogo(props.value)} alt="" style={S.logo} /> : null}
        <span>{props.value ? `${props.value.symbol} · ${props.value.name ?? props.value.symbol}` : "Select a token"}</span>
      </div>
      {props.onAmountChange ? (
        <>
          <input
            type="number"
            min="0"
            value={props.amount ?? ""}
            onChange={(event) => props.onAmountChange?.(event.target.value)}
            placeholder="0.00"
            style={S.amountInput}
          />
          <div style={S.helper}>{props.usdValue || "Enter the amount you want to swap"}</div>
        </>
      ) : (
        <>
          <div style={S.amountInput}>{props.outputAmount || "0.00"}</div>
          <div style={S.helper}>{props.usdValue || "Estimated output"}</div>
        </>
      )}
    </div>
  );
}

export default function CrossChainHubPage() {
  const [chains, setChains] = useState<RangoBlockchain[]>([]);
  const [tokens, setTokens] = useState<RangoToken[]>([]);
  const [fromChain, setFromChain] = useState("BSC");
  const [toChain, setToChain] = useState("OPBNB");
  const [fromToken, setFromToken] = useState<RangoToken | null>(null);
  const [toToken, setToToken] = useState<RangoToken | null>(null);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [quote, setQuote] = useState<RangoQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<SwapHistoryRow[]>([]);
  const [modal, setModal] = useState<TxModalState | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedQuote = useMemo(() => parseQuote(quote), [quote]);

  const fromChainMeta = chains.find((chain) => chain.name === fromChain);
  const toChainMeta = chains.find((chain) => chain.name === toChain);
  const outputAmount = parsedQuote?.outputAmount && parsedQuote.outputAmount !== "0" ? parsedQuote.outputAmount : "";
  const amountNumber = Number(amount || "0");
  const insufficientBalance = balance !== null && amountNumber > balance;
  const canQuote = Boolean(fromToken && toToken && amountNumber > 0);
  const canSwap = Boolean(wallet && quote && canQuote && !insufficientBalance && !quoteLoading && !swapLoading);

  useEffect(() => {
    let isActive = true;
    getRangoMeta()
      .then((meta) => {
        if (!isActive) {
          return;
        }
        const popularChains = sortPopularChains(meta.blockchains);
        const safeTokens = (meta.tokens ?? []).filter((token) => token.symbol.toUpperCase() !== MGX_SYMBOL);
        setChains(popularChains);
        setTokens(safeTokens);
        const defaultToChain = popularChains.some((chain) => chain.name === "OPBNB") ? "OPBNB" : "ETH";
        setFromChain("BSC");
        setToChain(defaultToChain);
        setFromToken(pickDefaultToken(safeTokens, "BSC", BSC_USDT));
        setToToken(pickDefaultToken(safeTokens, defaultToChain, defaultToChain === "OPBNB" ? OPBNB_USDT : "", "USDT"));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load cross-chain metadata."));
    setHistory(readHistory());

    const selectedAddress = (window.ethereum as unknown as { selectedAddress?: string } | undefined)?.selectedAddress;
    if (selectedAddress) {
      setWallet(selectedAddress);
    }

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!fromToken || !wallet || !window.ethereum) {
      setBalance(null);
      return;
    }

    let isActive = true;
    const ethereum = window.ethereum;
    const loadBalance = async () => {
      try {
        const provider = new BrowserProvider(ethereum);
        if (isNativeToken(fromToken)) {
          const nativeBalance = await provider.getBalance(wallet);
          if (isActive) {
            setBalance(Number(formatUnits(nativeBalance, 18)));
          }
          return;
        }
        const token = new Contract(fromToken.address!, ERC20_ABI, provider);
        const [rawBalance, decimals] = await Promise.all([token.balanceOf(wallet), token.decimals()]);
        if (isActive) {
          setBalance(Number(formatUnits(rawBalance, Number(decimals))));
        }
      } catch {
        if (isActive) {
          setBalance(null);
        }
      }
    };
    void loadBalance();
    return () => {
      isActive = false;
    };
  }, [fromToken, wallet]);

  useEffect(() => {
    if (quoteTimer.current) {
      clearTimeout(quoteTimer.current);
    }
    if (!canQuote) {
      setQuote(null);
      return;
    }

    quoteTimer.current = setTimeout(() => {
      void fetchQuote();
    }, 500);

    return () => {
      if (quoteTimer.current) {
        clearTimeout(quoteTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromChain, toChain, fromToken, toToken]);

  const fetchQuote = useCallback(async () => {
    if (!fromToken || !toToken || !canQuote) {
      return;
    }
    setQuoteLoading(true);
    setError("");
    try {
      const nextQuote = await getRangoQuote({
        from: selectedAsset(fromToken, { blockchain: fromChain, symbol: "USDT", address: BSC_USDT }),
        to: selectedAsset(toToken, { blockchain: toChain, symbol: "USDT", address: OPBNB_USDT }),
        amount,
        slippage: DEFAULT_SLIPPAGE,
        referrerAddress: RANGO_REFERRER_ADDRESS,
        referrerFee: RANGO_REFERRER_FEE
      });
      setQuote(nextQuote);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "No route found for this swap.");
    } finally {
      setQuoteLoading(false);
    }
  }, [amount, canQuote, fromChain, fromToken, toChain, toToken]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("No wallet found. Please open MetaGuildX in a Web3 wallet browser or install MetaMask.");
      return null;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
      const account = accounts[0] ?? null;
      setWallet(account);
      return account;
    } catch {
      setError("Wallet connection was rejected.");
      return null;
    }
  };

  const reverseRoute = () => {
    setFromChain(toChain);
    setToChain(fromChain);
    setFromToken(toToken);
    setToToken(fromToken);
    setFromSearch("");
    setToSearch("");
    setQuote(null);
    setError("");
  };

  const updateHistory = (row: SwapHistoryRow) => {
    const nextHistory = [row, ...readHistory().filter((entry) => entry.id !== row.id)].slice(0, 5);
    writeHistory(nextHistory);
    setHistory(nextHistory);
  };

  const executeSwap = async () => {
    const activeWallet = wallet || await connectWallet();
    if (!activeWallet || !fromToken || !toToken) {
      return;
    }
    if (!window.ethereum) {
      setError("No wallet found. Please open MetaGuildX in a Web3 wallet browser or install MetaMask.");
      return;
    }

    setSwapLoading(true);
    setError("");
    try {
      const swap = await getRangoSwap({
        from: selectedAsset(fromToken, { blockchain: fromChain, symbol: "USDT", address: BSC_USDT }),
        to: selectedAsset(toToken, { blockchain: toChain, symbol: "USDT", address: OPBNB_USDT }),
        amount,
        walletAddress: activeWallet,
        slippage: DEFAULT_SLIPPAGE,
        referrerAddress: RANGO_REFERRER_ADDRESS,
        referrerFee: RANGO_REFERRER_FEE
      });
      const tx = parseSwapTx(swap);
      if (!tx.to) {
        throw new Error("Rango did not return executable transaction data.");
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const sent = await signer.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: toBigIntValue(tx.value) ?? 0n,
        gasLimit: toBigIntValue(tx.gasLimit),
        gasPrice: toBigIntValue(tx.gasPrice)
      });
      const explorerUrl = getExplorerUrl(fromChain, sent.hash);
      setModal({
        status: "pending",
        title: "Transaction submitted",
        detail: "Your cross-chain swap is now being processed.",
        txHash: sent.hash,
        explorerUrl
      });
      updateHistory({
        id: sent.hash,
        fromChain,
        toChain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amount,
        outputAmount: outputAmount || "Pending",
        status: "running",
        txHash: sent.hash,
        timestamp: Date.now()
      });

      await sent.wait();
      const requestId = tx.requestId || parsedQuote?.requestId;
      let finalStatus: SwapHistoryRow["status"] = "success";
      if (requestId) {
        try {
          const status = await getRangoStatus(requestId, sent.hash);
          finalStatus = status.status === "failed" ? "failed" : status.status === "success" ? "success" : "running";
        } catch {
          finalStatus = "success";
        }
      }
      setModal({
        status: finalStatus === "failed" ? "failed" : "success",
        title: finalStatus === "failed" ? "Swap status needs attention" : "Swap complete!",
        detail: finalStatus === "failed" ? "Rango reported this route as failed. Please check your wallet and explorer." : "Your swap transaction has been confirmed.",
        txHash: sent.hash,
        explorerUrl
      });
      updateHistory({
        id: sent.hash,
        fromChain,
        toChain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amount,
        outputAmount: outputAmount || "Confirmed",
        status: finalStatus,
        txHash: sent.hash,
        timestamp: Date.now()
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Swap failed.";
      setError(message);
      setModal({
        status: "failed",
        title: "Swap failed",
        detail: message
      });
    } finally {
      setSwapLoading(false);
    }
  };

  const actionLabel = !wallet
    ? "Connect Wallet"
    : !amount || amountNumber <= 0
    ? "Enter Amount"
    : quoteLoading
    ? "Getting Quote..."
    : insufficientBalance
    ? "Insufficient Balance"
    : canSwap
    ? "Swap"
    : "Getting Quote...";
  const actionDisabled = Boolean(wallet) && (!canSwap || insufficientBalance);

  return (
    <div style={S.page}>
      <style>{`
        @keyframes mgx-spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .mgx-rango-grid { grid-template-columns: 1fr !important; }
        }
        select option { background: #0f172a; color: #f1f5f9; }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.headerIcon}>&#x21C4;</div>
          <h1 style={S.h1}>Cross-Chain Hub</h1>
          <p style={S.subtitle}>Swap tokens across chains. Non-custodial. No MGX required.</p>
          <div style={S.badges}>
            {["Multi-Chain", "Non-Custodial", "Wallet Connect", "OPBNB Ready"].map((badge) => (
              <span key={badge} style={S.badge}>
                &#10003; {badge}
              </span>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div className="mgx-rango-grid" style={{ display: "grid", gap: 14 }}>
            <TokenSelector
              label="From"
              chain={fromChain}
              chains={chains}
              tokens={tokens}
              value={fromToken}
              search={fromSearch}
              onSearch={setFromSearch}
              onChainChange={(chain) => {
                setFromChain(chain);
                setFromToken(pickDefaultToken(tokens, chain, chain === "BSC" ? BSC_USDT : "", "USDT"));
                setQuote(null);
              }}
              onTokenChange={(token) => {
                setFromToken(token);
                setQuote(null);
              }}
              amount={amount}
              onAmountChange={setAmount}
              usdValue={tokenUsdValue(fromToken, amount)}
            />

            <div style={S.reverseWrap}>
              <button type="button" style={S.reverseBtn} onClick={reverseRoute} title="Reverse route">
                &#8645;
              </button>
            </div>

            <TokenSelector
              label="To"
              chain={toChain}
              chains={chains}
              tokens={tokens}
              value={toToken}
              search={toSearch}
              onSearch={setToSearch}
              onChainChange={(chain) => {
                setToChain(chain);
                setToToken(pickDefaultToken(tokens, chain, chain === "OPBNB" ? OPBNB_USDT : "", "USDT"));
                setQuote(null);
              }}
              onTokenChange={(token) => {
                setToToken(token);
                setQuote(null);
              }}
              outputAmount={quoteLoading ? "Loading..." : outputAmount}
              usdValue={tokenUsdValue(toToken, outputAmount)}
            />
          </div>

          {parsedQuote ? (
            <div style={S.quoteBox}>
              <div style={S.qrow}><span style={S.qlabel}>Route</span><strong>{parsedQuote.routeName}</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Platform fee</span><strong>{RANGO_REFERRER_FEE}%</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Estimated time</span><strong>{parsedQuote.estimatedTimeInSeconds ? `~${Math.ceil(parsedQuote.estimatedTimeInSeconds / 60)} min` : "Route dependent"}</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Price impact</span><strong>{parsedQuote.priceImpact ?? "N/A"}</strong></div>
              {parsedQuote.feeLabel ? <div style={S.qrow}><span style={S.qlabel}>Route fee</span><strong>{parsedQuote.feeLabel}</strong></div> : null}
            </div>
          ) : null}

          {error ? <div style={S.error}>{error}</div> : null}

          <button
            type="button"
            style={S.actionBtn(actionDisabled)}
            disabled={actionDisabled}
            onClick={() => {
              if (!wallet) {
                void connectWallet();
              } else {
                void executeSwap();
              }
            }}
          >
            {actionLabel}
          </button>

          <div style={S.helper}>
            {fromChainMeta ? chainLabel(fromChainMeta) : "Loading chains"} &rarr; {toChainMeta ? chainLabel(toChainMeta) : "Loading destination"}
            {balance !== null && fromToken ? ` · Balance: ${balance.toFixed(4)} ${fromToken.symbol}` : ""}
          </div>
        </div>

        <div style={S.history}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent swaps</h3>
          {history.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>No recent swaps yet.</div>
          ) : history.map((row) => (
            <div key={row.id} style={S.historyRow}>
              <div>
                <div style={{ fontWeight: 800 }}>
                  {row.amount} {row.fromToken} &rarr; {row.outputAmount} {row.toToken}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  {row.fromChain} &rarr; {row.toChain} - {new Date(row.timestamp).toLocaleString()}
                </div>
                {row.txHash ? (
                  <a href={getExplorerUrl(row.fromChain, row.txHash)} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 12 }}>
                    View transaction
                  </a>
                ) : null}
              </div>
              <span style={S.pill(row.status)}>{row.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {modal ? (
        <div style={S.overlay}>
          <div style={S.modal}>
            {modal.status === "pending" ? (
              <div style={S.spinner} />
            ) : (
              <div style={{ fontSize: 42, marginBottom: 10 }}>
                {modal.status === "success" ? "✓" : "×"}
              </div>
            )}
            <h3 style={{ margin: "0 0 8px" }}>{modal.title}</h3>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.55 }}>{modal.detail}</p>
            {modal.explorerUrl ? (
              <a href={modal.explorerUrl} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 13 }}>
                View on explorer
              </a>
            ) : null}
            <button type="button" style={{ ...S.actionBtn(false), marginTop: 18 }} onClick={() => setModal(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
