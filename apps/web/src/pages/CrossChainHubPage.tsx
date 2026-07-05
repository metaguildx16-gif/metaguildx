import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  TREASURY_WALLET,
  formatDuration,
  formatTokenAmount,
  getLifiChains,
  getLifiQuote,
  getLifiTokens,
  type LifiChain,
  type LifiQuote,
  type LifiToken
} from "../lib/bridge";

const HISTORY_KEY = "mgx_crosschain_history";
const DEFAULT_FROM_CHAIN = 56;
const DEFAULT_TO_CHAIN = 1;
const OPBNB_CHAIN_ID = 204;
const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const ETH_USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const BNB_BRIDGE_URL = "https://opbnb-bridge.bnbchain.org/deposit";
const NATIVE_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

type SwapHistoryRow = {
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  status: "pending" | "success" | "failed";
  timestamp: number;
  explorerUrl: string;
};

type ModalState = {
  status: "pending" | "success" | "failed";
  title: string;
  message: string;
  txHash?: string;
  explorerUrl?: string;
};

const POPULAR_CHAIN_IDS = new Set([1, 56, 137, 204, 42161, 43114]);
const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
  204: "https://opbnbscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  43114: "https://snowtrace.io/tx/"
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
  bridgeBox: {
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    background: "rgba(56,189,248,.12)",
    border: "1px solid rgba(56,189,248,.32)",
    color: "#dbeafe"
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
  linkBtn: {
    display: "inline-flex",
    justifyContent: "center",
    width: "100%",
    marginTop: 14,
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    cursor: "pointer",
    color: "#06111f",
    background: "linear-gradient(135deg,#38bdf8,#60a5fa)",
    fontSize: 15,
    fontWeight: 800,
    textDecoration: "none",
    boxSizing: "border-box"
  } as CSSProperties,
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

function chainLabel(chain?: LifiChain) {
  return chain?.name || `Chain ${chain?.id ?? ""}`;
}

function normalizeAddress(address?: string | null) {
  return (address || "").toLowerCase();
}

function isNativeToken(token?: LifiToken | null) {
  return normalizeAddress(token?.address) === NATIVE_TOKEN_ADDRESS;
}

function tokenUsdValue(token: LifiToken | null, amount: string) {
  const usdPrice = Number(token?.priceUSD ?? 0);
  const parsedAmount = Number(amount || "0");
  if (!Number.isFinite(usdPrice) || !Number.isFinite(parsedAmount) || usdPrice <= 0 || parsedAmount <= 0) {
    return "";
  }
  return `~ $${(usdPrice * parsedAmount).toFixed(2)}`;
}

function getExplorerUrl(chainId: number, txHash: string) {
  const base = EXPLORERS[chainId];
  return base ? `${base}${txHash}` : "";
}

function getQuoteOutput(quote: LifiQuote | null, toToken: LifiToken | null) {
  if (!quote?.estimate?.toAmount || !toToken) {
    return "";
  }
  return formatTokenAmount(quote.estimate.toAmount, toToken.decimals, 6);
}

function getRouteName(quote: LifiQuote | null) {
  return quote?.includedSteps?.map((step) => step.toolDetails?.name || step.tool).filter(Boolean).join(" -> ") || quote?.tool || "LI.FI best route";
}

function getPriceImpact(quote: LifiQuote | null) {
  const fromUsd = Number(quote?.estimate?.fromAmountUSD ?? 0);
  const toUsd = Number(quote?.estimate?.toAmountUSD ?? 0);
  if (!fromUsd || !toUsd) {
    return "N/A";
  }
  return `${(((fromUsd - toUsd) / fromUsd) * 100).toFixed(2)}%`;
}

function TokenPanel(props: {
  label: string;
  chains: LifiChain[];
  chainId: number;
  token: LifiToken | null;
  tokens: LifiToken[];
  amount?: string;
  outputAmount?: string;
  usdValue?: string;
  onChainChange: (chainId: number) => void;
  onTokenChange: (token: LifiToken | null) => void;
  onAmountChange?: (amount: string) => void;
}) {
  return (
    <div style={S.section}>
      <div style={S.label}>{props.label}</div>
      <div style={S.grid}>
        <select style={S.input} value={props.chainId} onChange={(event) => props.onChainChange(Number(event.target.value))}>
          {props.chains.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chainLabel(chain)}
            </option>
          ))}
        </select>
        <select
          style={S.input}
          value={props.token?.address ?? ""}
          onChange={(event) => props.onTokenChange(props.tokens.find((token) => token.address === event.target.value) ?? null)}
        >
          {props.tokens.map((token) => (
            <option key={`${token.chainId}:${token.address}`} value={token.address}>
              {token.symbol} - {token.name}
            </option>
          ))}
        </select>
      </div>
      <div style={S.selectedToken}>
        {props.token?.logoURI ? <img src={props.token.logoURI} alt="" style={S.logo} /> : null}
        <span>{props.token ? `${props.token.symbol} · ${props.token.name}` : "Loading token list..."}</span>
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
  const [chains, setChains] = useState<LifiChain[]>([]);
  const [fromChainId, setFromChainId] = useState(DEFAULT_FROM_CHAIN);
  const [toChainId, setToChainId] = useState(DEFAULT_TO_CHAIN);
  const [fromTokens, setFromTokens] = useState<LifiToken[]>([]);
  const [toTokens, setToTokens] = useState<LifiToken[]>([]);
  const [fromToken, setFromToken] = useState<LifiToken | null>(null);
  const [toToken, setToToken] = useState<LifiToken | null>(null);
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<string | null>(null);
  const [quote, setQuote] = useState<LifiQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SwapHistoryRow[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromChain = chains.find((chain) => chain.id === fromChainId);
  const toChain = chains.find((chain) => chain.id === toChainId);
  const outputAmount = useMemo(() => getQuoteOutput(quote, toToken), [quote, toToken]);
  const amountNumber = Number(amount || "0");
  const isOpbnbDestination = toChainId === OPBNB_CHAIN_ID;
  const insufficientBalance = balance !== null && amountNumber > balance;
  const canQuote = Boolean(wallet && fromToken && toToken && amountNumber > 0 && !isOpbnbDestination);
  const canSwap = Boolean(quote?.transactionRequest && canQuote && !quoteLoading && !swapLoading && !insufficientBalance);

  useEffect(() => {
    let isActive = true;
    getLifiChains()
      .then((items) => {
        if (!isActive) return;
        const filtered = items.filter((chain) => POPULAR_CHAIN_IDS.has(chain.id));
        setChains(filtered);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load LI.FI chains."));
    setHistory(readHistory());
    const selectedAddress = (window.ethereum as unknown as { selectedAddress?: string } | undefined)?.selectedAddress;
    if (selectedAddress) setWallet(selectedAddress);
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    getLifiTokens(fromChainId)
      .then((tokens) => {
        if (!isActive) return;
        setFromTokens(tokens);
        setFromToken(
          tokens.find((token) => normalizeAddress(token.address) === normalizeAddress(BSC_USDT)) ||
          tokens.find((token) => token.symbol === "USDT") ||
          tokens[0] ||
          null
        );
      })
      .catch(() => setFromTokens([]));
    return () => {
      isActive = false;
    };
  }, [fromChainId]);

  useEffect(() => {
    let isActive = true;
    getLifiTokens(toChainId)
      .then((tokens) => {
        if (!isActive) return;
        setToTokens(tokens);
        setToToken(
          tokens.find((token) => normalizeAddress(token.address) === normalizeAddress(ETH_USDT)) ||
          tokens.find((token) => token.symbol === "USDT") ||
          tokens[0] ||
          null
        );
      })
      .catch(() => setToTokens([]));
    return () => {
      isActive = false;
    };
  }, [toChainId]);

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
          if (isActive) setBalance(Number(formatUnits(nativeBalance, fromToken.decimals)));
          return;
        }
        const token = new Contract(fromToken.address, ERC20_ABI, provider);
        const [rawBalance, decimals] = await Promise.all([token.balanceOf(wallet), token.decimals()]);
        if (isActive) setBalance(Number(formatUnits(rawBalance, Number(decimals))));
      } catch {
        if (isActive) setBalance(null);
      }
    };
    void loadBalance();
    return () => {
      isActive = false;
    };
  }, [fromToken, wallet]);

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuote(null);
    if (!canQuote || !fromToken || !toToken || !wallet) return;
    quoteTimer.current = setTimeout(() => {
      void fetchQuote();
    }, 500);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromChainId, toChainId, fromToken, toToken, wallet]);

  async function fetchQuote() {
    if (!fromToken || !toToken || !wallet || !amount || Number(amount) <= 0) return;
    setQuoteLoading(true);
    setError("");
    try {
      const fromAmount = parseUnits(amount, fromToken.decimals).toString();
      const nextQuote = await getLifiQuote({
        fromChainId,
        toChainId,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromAmount,
        fromAddress: wallet
      });
      setQuote(nextQuote);
    } catch (err) {
      setQuote(null);
      setError(err instanceof Error ? err.message : "No LI.FI route found for this swap.");
    } finally {
      setQuoteLoading(false);
    }
  }

  async function connectWallet() {
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
  }

  function reverseRoute() {
    setFromChainId(toChainId);
    setToChainId(fromChainId);
    setFromToken(toToken);
    setToToken(fromToken);
    setQuote(null);
    setError("");
  }

  function updateHistory(row: SwapHistoryRow) {
    const nextHistory = [row, ...readHistory().filter((item) => item.txHash !== row.txHash)].slice(0, 5);
    writeHistory(nextHistory);
    setHistory(nextHistory);
  }

  async function executeSwap() {
    const activeWallet = wallet || await connectWallet();
    if (!activeWallet || !quote?.transactionRequest || !window.ethereum || !fromToken || !toToken) return;
    setSwapLoading(true);
    setError("");
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tx = quote.transactionRequest;
      const sent = await signer.sendTransaction({
        to: tx.to,
        data: tx.data ?? "0x",
        value: tx.value ? BigInt(tx.value) : 0n,
        gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined
      });
      const explorerUrl = getExplorerUrl(fromChainId, sent.hash);
      setModal({
        status: "pending",
        title: "Transaction submitted",
        message: "Your LI.FI swap is being processed.",
        txHash: sent.hash,
        explorerUrl
      });
      updateHistory({
        txHash: sent.hash,
        fromChain: chainLabel(fromChain),
        toChain: chainLabel(toChain),
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: amount,
        toAmount: outputAmount || "Pending",
        status: "pending",
        timestamp: Date.now(),
        explorerUrl
      });
      const receipt = await sent.wait();
      const status: SwapHistoryRow["status"] = receipt?.status === 1 ? "success" : "failed";
      setModal({
        status,
        title: status === "success" ? "Swap complete!" : "Swap failed",
        message: status === "success" ? "Your transaction has been confirmed." : "The transaction was mined but did not succeed.",
        txHash: sent.hash,
        explorerUrl
      });
      updateHistory({
        txHash: sent.hash,
        fromChain: chainLabel(fromChain),
        toChain: chainLabel(toChain),
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        fromAmount: amount,
        toAmount: outputAmount || "Confirmed",
        status,
        timestamp: Date.now(),
        explorerUrl
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Swap failed.";
      setError(message);
      setModal({ status: "failed", title: "Swap failed", message });
    } finally {
      setSwapLoading(false);
    }
  }

  const actionLabel = !wallet
    ? "Connect Wallet"
    : isOpbnbDestination
    ? "Use BNB Bridge"
    : !amount || amountNumber <= 0
    ? "Enter Amount"
    : quoteLoading
    ? "Getting Quote..."
    : insufficientBalance
    ? "Insufficient Balance"
    : canSwap
    ? "Swap"
    : "Getting Quote...";
  const actionDisabled = Boolean(wallet) && !isOpbnbDestination && (!canSwap || insufficientBalance);

  return (
    <div style={S.page}>
      <style>{`
        @keyframes mgx-spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .mgx-lifi-grid { grid-template-columns: 1fr !important; }
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
              <span key={badge} style={S.badge}>&#10003; {badge}</span>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div className="mgx-lifi-grid" style={{ display: "grid", gap: 14 }}>
            <TokenPanel
              label="From"
              chains={chains}
              chainId={fromChainId}
              token={fromToken}
              tokens={fromTokens}
              amount={amount}
              usdValue={tokenUsdValue(fromToken, amount)}
              onAmountChange={setAmount}
              onChainChange={(chainId) => {
                setFromChainId(chainId);
                setQuote(null);
              }}
              onTokenChange={(token) => {
                setFromToken(token);
                setQuote(null);
              }}
            />

            <div style={S.reverseWrap}>
              <button type="button" style={S.reverseBtn} onClick={reverseRoute} title="Reverse route">&#8645;</button>
            </div>

            <TokenPanel
              label="To"
              chains={chains}
              chainId={toChainId}
              token={toToken}
              tokens={toTokens}
              outputAmount={quoteLoading ? "Loading..." : outputAmount}
              usdValue={tokenUsdValue(toToken, outputAmount)}
              onChainChange={(chainId) => {
                setToChainId(chainId);
                setQuote(null);
              }}
              onTokenChange={(token) => {
                setToToken(token);
                setQuote(null);
              }}
            />
          </div>

          {isOpbnbDestination ? (
            <div style={S.bridgeBox}>
              <h3 style={{ margin: "0 0 8px", color: "#bae6fd" }}>Bridge to opBNB via BNB Chain Bridge</h3>
              <p style={{ margin: 0, color: "#bfdbfe", fontSize: 13, lineHeight: 1.55 }}>
                LI.FI currently has no opBNB routes. Use the official BNB Chain Bridge to bring USDT or BNB to opBNB, then return to MetaGuildX.
              </p>
              <a href={BNB_BRIDGE_URL} target="_blank" rel="noreferrer" style={S.linkBtn}>Open BNB Bridge</a>
            </div>
          ) : quote ? (
            <div style={S.quoteBox}>
              <div style={S.qrow}><span style={S.qlabel}>Route</span><strong>{getRouteName(quote)}</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Platform fee</span><strong>0.15%</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Estimated time</span><strong>{formatDuration(quote.estimate?.executionDuration ?? 0)}</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Price impact</span><strong>{getPriceImpact(quote)}</strong></div>
              <div style={S.qrow}><span style={S.qlabel}>Treasury</span><strong>{TREASURY_WALLET.slice(0, 6)}...{TREASURY_WALLET.slice(-4)}</strong></div>
            </div>
          ) : null}

          {error && !isOpbnbDestination ? <div style={S.error}>{error}</div> : null}

          <button
            type="button"
            style={S.actionBtn(actionDisabled)}
            disabled={actionDisabled}
            onClick={() => {
              if (!wallet) {
                void connectWallet();
              } else if (isOpbnbDestination) {
                window.open(BNB_BRIDGE_URL, "_blank", "noopener,noreferrer");
              } else {
                void executeSwap();
              }
            }}
          >
            {actionLabel}
          </button>

          <div style={S.helper}>
            {chainLabel(fromChain)} &rarr; {chainLabel(toChain)}
            {balance !== null && fromToken ? ` · Balance: ${balance.toFixed(4)} ${fromToken.symbol}` : ""}
          </div>
        </div>

        <div style={S.history}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Recent swaps</h3>
          {history.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>No recent swaps yet.</div>
          ) : history.map((row) => (
            <div key={row.txHash} style={S.historyRow}>
              <div>
                <div style={{ fontWeight: 800 }}>{row.fromAmount} {row.fromToken} &rarr; {row.toAmount} {row.toToken}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{row.fromChain} &rarr; {row.toChain} · {new Date(row.timestamp).toLocaleString()}</div>
                {row.explorerUrl ? <a href={row.explorerUrl} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 12 }}>View transaction</a> : null}
              </div>
              <span style={S.pill(row.status)}>{row.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {modal ? (
        <div style={S.overlay}>
          <div style={S.modal}>
            {modal.status === "pending" ? <div style={S.spinner} /> : <div style={{ fontSize: 42, marginBottom: 10 }}>{modal.status === "success" ? "✓" : "×"}</div>}
            <h3 style={{ margin: "0 0 8px" }}>{modal.title}</h3>
            <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.55 }}>{modal.message}</p>
            {modal.explorerUrl ? <a href={modal.explorerUrl} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontSize: 13 }}>View on explorer</a> : null}
            <button type="button" style={{ ...S.actionBtn(false), marginTop: 18 }} onClick={() => setModal(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
