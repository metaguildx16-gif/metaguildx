import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SUPPORTED_CHAINS, SUPPORTED_TOKENS, PLATFORM_FEE_BPS,
  getQuote, getTxHistory, saveTxRecord,
  formatDuration, formatTokenAmount, getTokenAddress,
  type SwapQuote, type TxRecord, type ChainKey, type TokenSymbol,
} from "../lib/crosschain";

const S = {
  page: { minHeight:"100vh", background:"linear-gradient(135deg,#0a0f1e 0%,#0d1528 50%,#0a0f1e 100%)", color:"#e2e8f0", fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", padding:"24px 16px 48px" } as React.CSSProperties,
  container: { maxWidth:520, margin:"0 auto" } as React.CSSProperties,
  header: { textAlign:"center" as const, marginBottom:32 } as React.CSSProperties,
  headerIcon: { width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:24, boxShadow:"0 0 32px rgba(59,130,246,0.4)" } as React.CSSProperties,
  h1: { fontSize:26, fontWeight:700, margin:"0 0 6px", background:"linear-gradient(90deg,#60a5fa,#a78bfa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" } as React.CSSProperties,
  subtitle: { fontSize:13, color:"#64748b", margin:"0 0 16px" } as React.CSSProperties,
  badges: { display:"flex", flexWrap:"wrap" as const, gap:8, justifyContent:"center", marginBottom:8 } as React.CSSProperties,
  badge: { fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:20, border:"1px solid rgba(99,102,241,0.4)", color:"#a5b4fc", background:"rgba(99,102,241,0.1)", letterSpacing:"0.3px" } as React.CSSProperties,
  tabs: { display:"flex", gap:4, marginBottom:20, background:"rgba(15,23,42,0.8)", borderRadius:12, padding:4, border:"1px solid rgba(51,65,85,0.5)" } as React.CSSProperties,
  tab: (a:boolean):React.CSSProperties => ({ flex:1, padding:"10px 0", borderRadius:9, border:"none", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.2s", background:a?"linear-gradient(135deg,#3b82f6,#8b5cf6)":"transparent", color:a?"#fff":"#64748b" }),
  card: { background:"rgba(15,23,42,0.9)", border:"1px solid rgba(51,65,85,0.6)", borderRadius:20, padding:24, marginBottom:16, backdropFilter:"blur(12px)" } as React.CSSProperties,
  label: { fontSize:11, fontWeight:700, color:"#475569", letterSpacing:"1px", textTransform:"uppercase" as const, marginBottom:10 } as React.CSSProperties,
  row: { display:"flex", gap:8, marginBottom:12 } as React.CSSProperties,
  sel: { flex:1, background:"rgba(30,41,59,0.8)", border:"1px solid rgba(51,65,85,0.6)", borderRadius:10, color:"#e2e8f0", fontSize:13, fontWeight:500, padding:"10px 12px", outline:"none", cursor:"pointer", appearance:"none" as const } as React.CSSProperties,
  inp: { width:"100%", background:"rgba(30,41,59,0.8)", border:"1px solid rgba(51,65,85,0.6)", borderRadius:10, color:"#f1f5f9", fontSize:22, fontWeight:600, padding:"14px 16px", outline:"none", boxSizing:"border-box" as const } as React.CSSProperties,
  arrow: { display:"flex", justifyContent:"center", margin:"12px 0" } as React.CSSProperties,
  arrowBtn: { width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#1e3a5f,#2d1b69)", border:"2px solid rgba(59,130,246,0.4)", color:"#60a5fa", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform 0.3s" } as React.CSSProperties,
  qbox: { background:"rgba(30,41,59,0.5)", borderRadius:12, padding:"14px 16px", marginBottom:16, border:"1px solid rgba(51,65,85,0.4)" } as React.CSSProperties,
  bridgeInfo: { background:"rgba(59,130,246,0.12)", border:"1px solid rgba(96,165,250,0.35)", borderRadius:16, padding:"18px", marginBottom:16, color:"#dbeafe" } as React.CSSProperties,
  bridgeTitle: { margin:"0 0 8px", color:"#93c5fd", fontSize:16, fontWeight:700 } as React.CSSProperties,
  bridgeMsg: { margin:"0 0 14px", color:"#bfdbfe", fontSize:13, lineHeight:1.55 } as React.CSSProperties,
  bridgeBtn: { width:"100%", padding:"13px 16px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#2563eb,#0ea5e9)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(37,99,235,0.28)" } as React.CSSProperties,
  qrow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", fontSize:13 } as React.CSSProperties,
  qlabel: { color:"#64748b" } as React.CSSProperties,
  qval: { color:"#cbd5e1", fontWeight:500 } as React.CSSProperties,
  qhi: { color:"#34d399", fontWeight:600 } as React.CSSProperties,
  div: { height:1, background:"rgba(51,65,85,0.4)", margin:"8px 0" } as React.CSSProperties,
  btn: (d:boolean):React.CSSProperties => ({ width:"100%", padding:"16px", borderRadius:14, border:"none", cursor:d?"not-allowed":"pointer", fontSize:16, fontWeight:700, background:d?"rgba(30,41,59,0.6)":"linear-gradient(135deg,#3b82f6,#8b5cf6)", color:d?"#475569":"#fff", transition:"all 0.2s", boxShadow:d?"none":"0 4px 24px rgba(59,130,246,0.3)" }),
  pill: (s:string):React.CSSProperties => ({ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:s==="success"?"rgba(52,211,153,0.15)":s==="failed"?"rgba(248,113,113,0.15)":"rgba(251,191,36,0.15)", color:s==="success"?"#34d399":s==="failed"?"#f87171":"#fbbf24" }),
  txrow: { padding:"14px 0", borderBottom:"1px solid rgba(51,65,85,0.3)" } as React.CSSProperties,
  txmain: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 } as React.CSSProperties,
  txtok: { fontSize:14, fontWeight:600, color:"#e2e8f0" } as React.CSSProperties,
  txmeta: { fontSize:12, color:"#475569", display:"flex", gap:12, alignItems:"center" } as React.CSSProperties,
  lnk: { color:"#60a5fa", fontSize:12, textDecoration:"none" } as React.CSSProperties,
  empty: { textAlign:"center" as const, padding:"48px 0", color:"#334155", fontSize:14 } as React.CSSProperties,
  err: { background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 16px", color:"#fca5a5", fontSize:13, marginBottom:12 } as React.CSSProperties,
  spin: { display:"inline-block", width:16, height:16, border:"2px solid rgba(255,255,255,0.2)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.8s linear infinite", marginRight:8, verticalAlign:"middle" } as React.CSSProperties,
  note: { fontSize:12, color:"#475569", textAlign:"center" as const, marginTop:12 } as React.CSSProperties,
} as const;

export default function CrossChainHubPage() {
  const [tab, setTab]           = useState<"swap"|"history">("swap");
  const [fromChain, setFC]      = useState<ChainKey>("bsc");
  const [toChain, setTC]        = useState<ChainKey>("opbnb");
  const [fromToken, setFT]      = useState<TokenSymbol>("USDT");
  const [toToken, setTT]        = useState<TokenSymbol>("USDT");
  const [amount, setAmount]     = useState("");
  const [quote, setQuote]       = useState<SwapQuote|null>(null);
  const [qLoading, setQL]       = useState(false);
  const [sLoading, setSL]       = useState(false);
  const [error, setError]       = useState("");
  const [txHist, setTxHist]     = useState<TxRecord[]>([]);
  const [wallet, setWallet]     = useState<string|null>(null);
  const [flipped, setFlipped]   = useState(false);
  const timer                   = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    const win = window as unknown as { ethereum?: { selectedAddress?: string } };
    if (win.ethereum?.selectedAddress) setWallet(win.ethereum.selectedAddress);
    setTxHist(getTxHistory());
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (toChain === "opbnb") { setQuote(null); setError(""); return; }
    if (!amount || parseFloat(amount) <= 0 || !wallet) { setQuote(null); return; }
    timer.current = setTimeout(() => { void doQuote(); }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromChain, toChain, fromToken, toToken, wallet]);

  const doQuote = useCallback(async () => {
    if (!wallet || toChain === "opbnb") return;
    setQL(true); setError("");
    try {
      const fc = SUPPORTED_CHAINS.find(c => c.key === fromChain);
      const tc = SUPPORTED_CHAINS.find(c => c.key === toChain);
      const ft = SUPPORTED_TOKENS.find(t => t.symbol === fromToken);
      if (!fc||!tc||!ft) throw new Error("Invalid selection");
      const fa = getTokenAddress(fromToken, fromChain);
      const ta = getTokenAddress(toToken, toChain);
      if (!fa||!ta||fa==="0x"||ta==="0x") throw new Error("Token not available on selected chain");
      const wei = (parseFloat(amount) * Math.pow(10, ft.decimals)).toFixed(0);
      const q = await getQuote({ fromChainId:fc.id, toChainId:tc.id, fromTokenAddress:fa, toTokenAddress:ta, fromAmount:wei, fromAddress:wallet });
      setQuote(q);
    } catch(e) { setError(e instanceof Error ? e.message : "Quote failed"); setQuote(null); }
    finally { setQL(false); }
  }, [wallet, fromChain, toChain, fromToken, toToken, amount]);

  const connectWallet = async () => {
    const win = window as unknown as { ethereum?: { request:(a:{method:string;params?:unknown[]})=>Promise<string[]> } };
    if (!win.ethereum) { setError("No wallet found. Install MetaMask."); return; }
    try { const acc = await win.ethereum.request({ method:"eth_requestAccounts" }); setWallet(acc[0]??null); }
    catch { setError("Connection rejected."); }
  };

  const doSwap = async () => {
    if (!quote||!wallet) return;
    setSL(true); setError("");
    try {
      const fc = SUPPORTED_CHAINS.find(c => c.key === fromChain);
      const tc = SUPPORTED_CHAINS.find(c => c.key === toChain);
      const url = `https://jumper.exchange/?fromChain=${fc?.id}&toChain=${tc?.id}&fromToken=${getTokenAddress(fromToken,fromChain)}&toToken=${getTokenAddress(toToken,toChain)}&fromAmount=${amount}`;
      window.open(url, "_blank");
      const tt = SUPPORTED_TOKENS.find(t => t.symbol === toToken);
      saveTxRecord({ txHash:"pending_"+Date.now(), fromChain:fromChain.toUpperCase(), toChain:toChain.toUpperCase(), fromToken, toToken, fromAmount:amount, toAmount:formatTokenAmount(quote.toAmount, tt?.decimals??18), status:"pending", timestamp:Date.now(), explorerUrl:"" });
      setTxHist(getTxHistory());
    } catch(e) { setError(e instanceof Error ? e.message : "Swap failed"); }
    finally { setSL(false); }
  };

  const flip = () => {
    setFlipped(f=>!f); setFC(toChain); setTC(fromChain);
    setFT(toToken); setTT(fromToken); setQuote(null); setAmount("");
  };

  const isOpbnbBridge = toChain === "opbnb";
  const ttObj   = SUPPORTED_TOKENS.find(t => t.symbol === toToken);
  const toAmt   = quote ? formatTokenAmount(quote.toAmount, ttObj?.decimals??18) : "";
  const btnDis  = isOpbnbBridge ? false : qLoading || sLoading || !amount || parseFloat(amount)<=0 || (!quote && !!wallet);
  const btnLbl  = isOpbnbBridge ? "Open BNB Bridge ->" : !wallet ? "Connect Wallet" : qLoading ? "Getting Quote..." : sLoading ? "Opening Swap..." : !amount||parseFloat(amount)<=0 ? "Enter Amount" : !quote ? "Fetching Route..." : "Swap Now";

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} select option{background:#0f172a;color:#e2e8f0} input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0} input[type=number]{-moz-appearance:textfield} a:hover{text-decoration:underline!important}`}</style>
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.headerIcon}>&#x21C4;</div>
          <h1 style={S.h1}>Cross-Chain Hub</h1>
          <p style={S.subtitle}>Swap tokens across chains. Non-custodial. No MGX required.</p>
          <div style={S.badges}>
            {["Multi-Chain","Non-Custodial","Wallet Connect","OPBNB Ready"].map(b=>(
              <span key={b} style={S.badge}>&#10003; {b}</span>
            ))}
          </div>
        </div>
        <div style={S.tabs}>
          <button style={S.tab(tab==="swap")} onClick={()=>setTab("swap")}>Swap</button>
          <button style={S.tab(tab==="history")} onClick={()=>setTab("history")}>History {txHist.length>0?`(${txHist.length})`:""}</button>
        </div>
        {error && !isOpbnbBridge && <div style={S.err}>&#9888; {error}</div>}
        {tab==="swap" && (
          <>
            <div style={S.card}>
              <div style={S.label}>From</div>
              <div style={S.row}>
                <select style={S.sel} value={fromChain} onChange={e=>{setFC(e.target.value as ChainKey);setQuote(null);}}>
                  {SUPPORTED_CHAINS.map(c=><option key={c.key} value={c.key}>{c.shortName} - {c.name}</option>)}
                </select>
                <select style={S.sel} value={fromToken} onChange={e=>{setFT(e.target.value as TokenSymbol);setQuote(null);}}>
                  {SUPPORTED_TOKENS.map(t=><option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} style={S.inp} min="0" />
              <div style={S.arrow}>
                <button style={{...S.arrowBtn, transform:flipped?"rotate(180deg)":"rotate(0deg)"}} onClick={flip} title="Flip">&#8645;</button>
              </div>
              <div style={S.label}>To</div>
              <div style={S.row}>
                <select style={S.sel} value={toChain} onChange={e=>{setTC(e.target.value as ChainKey);setQuote(null);}}>
                  {SUPPORTED_CHAINS.map(c=><option key={c.key} value={c.key}>{c.shortName} - {c.name}</option>)}
                </select>
                <select style={S.sel} value={toToken} onChange={e=>{setTT(e.target.value as TokenSymbol);setQuote(null);}}>
                  {SUPPORTED_TOKENS.map(t=><option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
              </div>
              <input type="text" readOnly value={isOpbnbBridge?"Use official bridge":qLoading?"Fetching...":toAmt?`~ ${toAmt}`:""} placeholder="Estimated output" style={{...S.inp,color:isOpbnbBridge?"#93c5fd":"#34d399",cursor:"default",fontSize:20}} />
            </div>
            {isOpbnbBridge ? (
              <div style={S.bridgeInfo}>
                <h3 style={S.bridgeTitle}>Bridge to opBNB</h3>
                <p style={S.bridgeMsg}>To bridge tokens to opBNB Mainnet, use the official BNB Chain Bridge. It supports USDT, BNB and other tokens from BSC to opBNB.</p>
                <button type="button" style={S.bridgeBtn} onClick={() => window.open("https://opbnb-bridge.bnbchain.org/deposit", "_blank", "noopener,noreferrer")}>Open BNB Bridge -&gt;</button>
              </div>
            ) : quote && !qLoading && (
              <div style={S.qbox}>
                <div style={S.qrow}><span style={S.qlabel}>Route</span><span style={S.qval}>{quote.route}</span></div>
                <div style={S.qrow}><span style={S.qlabel}>Est. Time</span><span style={S.qval}>{formatDuration(quote.executionDuration)}</span></div>
                <div style={S.qrow}><span style={S.qlabel}>Price Impact</span><span style={{...S.qval,color:parseFloat(quote.priceImpact)>2?"#f87171":"#34d399"}}>{quote.priceImpact}%</span></div>
                <div style={S.div}/>
                <div style={S.qrow}><span style={S.qlabel}>Platform Fee</span><span style={S.qval}>{PLATFORM_FEE_BPS/100}% (Treasury)</span></div>
                <div style={S.qrow}><span style={S.qlabel}>Min. Received</span><span style={S.qhi}>~ {formatTokenAmount(quote.toAmountMin,ttObj?.decimals??18)} {toToken}</span></div>
              </div>
            )}
            <button style={S.btn(btnDis&&!!wallet)} onClick={isOpbnbBridge ? () => window.open("https://opbnb-bridge.bnbchain.org/deposit", "_blank", "noopener,noreferrer") : wallet ? doSwap : connectWallet} disabled={btnDis&&!!wallet}>
              {(qLoading||sLoading)&&<span style={S.spin}/>}{btnLbl}
            </button>
            <p style={S.note}>{isOpbnbBridge ? "Official BNB Chain Bridge opens in a new tab - Non-custodial - You control your keys" : "Powered by LI.FI aggregator - Non-custodial - You control your keys"}</p>
          </>
        )}
        {tab==="history" && (
          <div style={S.card}>
            {txHist.length===0 ? (
              <div style={S.empty}><div style={{fontSize:36,marginBottom:12}}>&#128203;</div><div>No swap history yet.</div></div>
            ) : txHist.map((tx,i)=>(
              <div key={i} style={S.txrow}>
                <div style={S.txmain}>
                  <span style={S.txtok}>{tx.fromAmount} {tx.fromToken} &rarr; ~{tx.toAmount} {tx.toToken}</span>
                  <span style={S.pill(tx.status)}>{tx.status.toUpperCase()}</span>
                </div>
                <div style={S.txmeta}>
                  <span>{tx.fromChain!==tx.toChain?`${tx.fromChain} -> ${tx.toChain}`:tx.fromChain}</span>
                  <span>{new Date(tx.timestamp).toLocaleString()}</span>
                  {tx.explorerUrl&&<a href={tx.explorerUrl} target="_blank" rel="noreferrer" style={S.lnk}>View &#8599;</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

