import React from "react";

const LIFI_WIDGET_URL =
  "https://widget.li.fi/home?fromChain=56&toChain=204" +
  "&fromToken=0x55d398326f99059fF775485246999027B3197955" +
  "&toToken=0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3" +
  "&integrator=metaguildx" +
  "&theme=dark";

export default function CrossChainHubPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid #1e293b" }}>
        <h2 style={{ color: "#38bdf8", fontWeight: 700, fontSize: 20, margin: 0 }}>
          Cross-Chain Hub
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 8px" }}>
          Swap tokens across chains. Non-custodial. No MGX required.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["✓ Multi-Chain", "✓ Non-Custodial", "✓ Wallet Connect", "✓ OPBNB Ready"].map((b) => (
            <span key={b} style={{
              background: "#0f172a", border: "1px solid #334155",
              borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#94a3b8"
            }}>{b}</span>
          ))}
        </div>
      </div>
      <iframe
        src={LIFI_WIDGET_URL}
        title="LI.FI Cross-Chain Swap"
        style={{
          flex: 1,
          width: "100%",
          minHeight: 600,
          border: "none",
          background: "#0f172a"
        }}
        allow="clipboard-write"
      />
    </div>
  );
}
