import { LiFiWidget, type WidgetConfig } from "@lifi/widget";
import type { CSSProperties } from "react";
import { ENABLE_MGX_SWAP, TREASURY_WALLET } from "../lib/crosschain";

const BSC_CHAIN_ID = 56;
const OPBNB_CHAIN_ID = 204;
const BSC_USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const OPBNB_USDT_ADDRESS = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";
const MGX_TOKEN_ADDRESS = import.meta.env.VITE_MGX_TOKEN_ADDRESS?.trim();

const S = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(46,111,216,0.22), transparent 34%), linear-gradient(135deg,#07101f 0%,#0d1528 48%,#060b16 100%)",
    color: "#e2e8f0",
    fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
    padding: "24px 16px 48px",
    boxSizing: "border-box"
  } as CSSProperties,
  container: { width: "100%", maxWidth: 620, margin: "0 auto" } as CSSProperties,
  header: { textAlign: "center", marginBottom: 28 } as CSSProperties,
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
    fontSize: 24,
    boxShadow: "0 0 32px rgba(46,111,216,0.38)"
  } as CSSProperties,
  h1: {
    fontSize: 28,
    fontWeight: 800,
    margin: "0 0 6px",
    background: "linear-gradient(90deg,#7EB3FF,#C9A84C)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  } as CSSProperties,
  subtitle: { fontSize: 13, color: "#8aa0c6", margin: "0 0 16px" } as CSSProperties,
  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 8
  } as CSSProperties,
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "5px 11px",
    borderRadius: 20,
    border: "1px solid rgba(126,179,255,0.32)",
    color: "#A8CAFF",
    background: "rgba(46,111,216,0.12)",
    letterSpacing: "0.3px"
  } as CSSProperties,
  widgetShell: {
    width: "100%",
    borderRadius: 24,
    padding: 10,
    background: "linear-gradient(145deg, rgba(46,111,216,0.18), rgba(201,168,76,0.08))",
    border: "1px solid rgba(126,179,255,0.18)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
    boxSizing: "border-box"
  } as CSSProperties,
  note: {
    margin: "16px auto 0",
    maxWidth: 520,
    textAlign: "center",
    color: "#6f83a8",
    fontSize: 12,
    lineHeight: 1.55
  } as CSSProperties
} as const;

const mgxTokenDenyList =
  !ENABLE_MGX_SWAP && MGX_TOKEN_ADDRESS
    ? [{ chainId: OPBNB_CHAIN_ID, address: MGX_TOKEN_ADDRESS }]
    : [];

const widgetConfig: WidgetConfig = {
  integrator: "metaguildx",
  apiKey: import.meta.env.VITE_LIFI_API_KEY,
  fromChain: BSC_CHAIN_ID,
  toChain: OPBNB_CHAIN_ID,
  fromToken: BSC_USDT_ADDRESS,
  toToken: OPBNB_USDT_ADDRESS,
  referrer: TREASURY_WALLET,
  feeConfig: {
    name: "MetaGuildX",
    fee: 0.0015,
    showFeePercentage: true
  },
  appearance: "dark",
  variant: "wide",
  buildUrl: true,
  hiddenUI: {
    poweredBy: true
  },
  tokens: {
    deny: mgxTokenDenyList,
    popular: [
      {
        chainId: BSC_CHAIN_ID,
        address: BSC_USDT_ADDRESS,
        symbol: "USDT",
        name: "Tether USD",
        decimals: 18
      },
      {
        chainId: OPBNB_CHAIN_ID,
        address: OPBNB_USDT_ADDRESS,
        symbol: "USDT",
        name: "Tether USD",
        decimals: 18
      }
    ]
  },
  theme: {
    colorSchemes: {
      dark: {
        palette: {
          primary: { main: "#2E6FD8" },
          secondary: { main: "#C9A84C" },
          background: {
            default: "#07101f",
            paper: "#0f1b31"
          }
        }
      }
    },
    shape: {
      borderRadius: 16
    },
    container: {
      width: "100%",
      maxWidth: "100%",
      borderRadius: "20px",
      boxShadow: "none",
      border: "1px solid rgba(126,179,255,0.18)"
    }
  }
};

export default function CrossChainHubPage() {
  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.header}>
          <div style={S.headerIcon}>&#x21C4;</div>
          <h1 style={S.h1}>Cross-Chain Hub</h1>
          <p style={S.subtitle}>Bridge and swap tokens without leaving MetaGuildX.</p>
          <div style={S.badges}>
            {["Multi-Chain", "Non-Custodial", "Wallet Connect", "OPBNB Ready"].map((badge) => (
              <span key={badge} style={S.badge}>
                &#10003; {badge}
              </span>
            ))}
          </div>
        </div>

        <div style={S.widgetShell}>
          <LiFiWidget integrator="metaguildx" config={widgetConfig} />
        </div>

        <p style={S.note}>
          Powered by LI.FI routing. Default route is BSC USDT to opBNB USDT for MetaGuildX registration funding.
        </p>
      </div>
    </div>
  );
}
