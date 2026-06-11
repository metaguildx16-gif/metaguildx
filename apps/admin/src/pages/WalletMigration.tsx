import { useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACTS, ABIS } from "../config/contracts";

const GNOSIS_SAFE = "0x6D01d1E9771193467B5fae47Ce8463d7060098eA";

export function WalletMigration() {
  const [oldWallet, setOldWallet] = useState("");
  const [newWallet, setNewWallet] = useState("");
  const [rebirthIds, setRebirthIds] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState("");

  async function handleMigrate() {
    if (!oldWallet || !newWallet) { setStatus("error"); setMessage("Both wallets required."); return; }
    if (oldWallet.toLowerCase() === newWallet.toLowerCase()) { setStatus("error"); setMessage("Wallets cannot be same."); return; }
    try {
      setStatus("loading"); setMessage("Connecting wallet...");
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== GNOSIS_SAFE.toLowerCase()) {
        setStatus("error"); setMessage("Must connect Gnosis Safe owner wallet. Got: " + signerAddress); return;
      }
      const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);
      const ids = rebirthIds.split(",").map(s => s.trim()).filter(Boolean).map(s => BigInt(s));
      setMessage("Submitting transaction...");
      const tx = await core.adminMigrateWallet(oldWallet, newWallet, ids);
      setMessage("Waiting for confirmation...");
      const receipt = await tx.wait();
      setTxHash(receipt.hash);
      setStatus("success");
      setMessage("Migration successful! TX: " + receipt.hash);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.reason ?? err?.message ?? "Unknown error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: "8px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#f1f5f9", fontSize: "0.875rem", boxSizing: "border-box"
  };

  const statusColor = status === "success" ? "#86efac" : status === "error" ? "#fca5a5" : "#93c5fd";
  const statusBg = status === "success" ? "rgba(34,197,94,0.1)" : status === "error" ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)";
  const statusBorder = status === "success" ? "rgba(34,197,94,0.3)" : status === "error" ? "rgba(239,68,68,0.3)" : "rgba(59,130,246,0.3)";

  return (
    <div style={{ padding: "24px", maxWidth: "600px" }}>
      <h2 style={{ marginBottom: "8px", fontSize: "1.25rem", fontWeight: 700 }}>Wallet Migration</h2>
      <p style={{ marginBottom: "24px", color: "#94a3b8", fontSize: "0.875rem" }}>
        Migrate a compromised wallet to a new address. Requires Gnosis Safe owner connection.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 600 }}>Old (Compromised) Wallet</label>
          <input type="text" value={oldWallet} onChange={e => setOldWallet(e.target.value)} placeholder="0x..." style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 600 }}>New (Safe) Wallet</label>
          <input type="text" value={newWallet} onChange={e => setNewWallet(e.target.value)} placeholder="0x..." style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem", fontWeight: 600 }}>
            Rebirth User IDs <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional, comma separated)</span>
          </label>
          <input type="text" value={rebirthIds} onChange={e => setRebirthIds(e.target.value)} placeholder="e.g. 44, 75" style={inputStyle} />
        </div>
        {status !== "idle" && (
          <div style={{ padding: "12px 16px", borderRadius: "8px", background: statusBg, border: "1px solid " + statusBorder, color: statusColor, fontSize: "0.875rem", wordBreak: "break-all" }}>
            {message}
            {txHash && (
              <div style={{ marginTop: "8px" }}>
                <a href={"https://opbnbscan.com/tx/" + txHash} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>View on Explorer</a>
              </div>
            )}
          </div>
        )}
        <button onClick={handleMigrate} disabled={status === "loading"} style={{ padding: "12px 24px", borderRadius: "8px", fontWeight: 700, background: status === "loading" ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.9)", color: "#0a0a0a", border: "none", cursor: status === "loading" ? "not-allowed" : "pointer", fontSize: "0.95rem" }}>
          {status === "loading" ? "Processing..." : "Migrate Wallet"}
        </button>
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "0.8rem", color: "#fca5a5" }}>
          This action is irreversible. Double-check both wallet addresses. Gnosis Safe 2/3 signatures required.
        </div>
      </div>
    </div>
  );
}