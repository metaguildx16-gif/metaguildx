import { Contract, JsonRpcProvider, ethers, formatUnits } from "ethers";
import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from "react";
import logoMark from "./assets/mgx logo.png";
import { fallbackSnapshot } from "./appFallback";
import { CashbackPage } from "./pages/CashbackPage";
import { IncomePage } from "./pages/IncomePage";
import { LevelsPage } from "./pages/LevelsPage";
import { NetworkPage } from "./pages/NetworkPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RebirthPage } from "./pages/RebirthPage";
import { ReferralsPage } from "./pages/ReferralsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SupportPage } from "./pages/Support";
import { TeamPage } from "./pages/TeamPage";
import { UpgradePage } from "./pages/UpgradePage";
import { UserSearchPage } from "./pages/UserSearchPage";
import { WalletPage } from "./pages/WalletPage";
import CrossChainHubPage from "./pages/CrossChainHubPage";
import { activeNetworkConfig } from "./config/networks";
import * as metaguildx from "./lib/metaguildx";
import type { ConnectedWalletHistoryRow, DashboardSnapshot, LiveWalletStakeState, RegistrationResult, TreeNodeDetails, TreePreviewNode } from "./lib/metaguildx";

const LazyTreePanel = lazy(() => import("./components/TreePanel"));

const landingStatsCoreAbi = [
  "function nextUserId() view returns (uint256)",
  "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
  "event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount)"
] as const;
type Screen = "landing" | "dashboard";
type DashboardView =
  | "register"
  | "overview"
  | "profile"
  | "users"
  | "team"
  | "usersearch"
  | "activity"
  | "settings"
  | "tree"
  | "income"
  | "network"
  | "referrals"
  | "levels"
  | "rebirth"
  | "upgrade"
  | "cashback"
  | "wallet"
  | "support"
  | "crosschain";
type WalletSubView = "main" | "transfer" | "mgxboxes" | "stakingclaim" | "stake" | "myStake" | "cashback";
type StakeDurationKey = "30D" | "90D" | "180D" | "1Y" | "2Y";
type DashboardLoadPhase =
  | "idle"
  | "connecting wallet"
  | "reading core config"
  | "loading user profile"
  | "loading analytics"
  | "loading tree"
  | "loading earnings"
  | "complete"
  | "error";
type StartupDiagnostics = {
  deployBlock: number;
  currentBlock: number | null;
  rpcUrl: string;
  coreAddress: string;
  scanRange: string;
  walletConnected: boolean;
  registeredUserId: number | null;
};
const TESTNET_ADMIN_WALLET = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
const DEFAULT_ADMIN_PANEL_PORT = "4174";
const AUTH_EXPIRY_MS = 24 * 60 * 60 * 1000;
const lockPeriods: { label: string; days: number; bonus: string; multiplier: number; key: StakeDurationKey }[] = [
  { label: "30d", days: 30, bonus: "+0%", multiplier: 100, key: "30D" },
  { label: "90d", days: 90, bonus: "+5%", multiplier: 105, key: "90D" },
  { label: "180d", days: 180, bonus: "+10%", multiplier: 110, key: "180D" },
  { label: "1Y", days: 365, bonus: "+12%", multiplier: 112, key: "1Y" },
  { label: "2Y", days: 730, bonus: "+15%", multiplier: 115, key: "2Y" }
];
const WALLET_STORAGE_KEY = "mgx_wallet";
const WALLET_CONNECTED_KEY = "mgx_connected";
const WALLET_AUTH_TIMESTAMP_KEY = "mgx_auth_timestamp";
const PRIVACY_STORAGE_KEY = "mgx_privacy_v1";
const PROFILE_STORAGE_KEY = "mgx_profile_v1";
const defaultPrivacy = {
  earnings: "all" as "all" | "only_me",
  referralTree: "all" as "all" | "only_me",
  packageLevel: "all" as "all" | "only_me",
  walletAddress: "all" as "all" | "only_me"
};
const DASHBOARD_LOAD_TIMEOUT_MS = 90_000;
const SHOW_DIAGNOSTICS = false;
const PUBLIC_TESTNET_RPC =
  import.meta.env.VITE_TESTNET_RPC ||
  import.meta.env.VITE_TESTNET_RPC_URL ||
  "https://opbnb-testnet-rpc.bnbchain.org";
const PUBLIC_TESTNET_CORE_ADDRESS =
  import.meta.env.VITE_CORE_ADDRESS ||
  import.meta.env.VITE_SYSTEM_ADDRESS ||
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "";

function resolveAdminPanelUrl() {
  const configuredUrl = import.meta.env.VITE_ADMIN_PANEL_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${DEFAULT_ADMIN_PANEL_PORT}`;
  }

  return "";
}

function replaceAppPath(path: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname !== path) {
    window.history.replaceState({}, "", path);
  }
}

function saveWalletSession(walletAddress: string) {
  localStorage.setItem(WALLET_STORAGE_KEY, walletAddress.toLowerCase());
  localStorage.setItem(WALLET_CONNECTED_KEY, "true");
  localStorage.setItem(WALLET_AUTH_TIMESTAMP_KEY, Date.now().toString());
}

function clearWalletSession() {
  localStorage.removeItem(WALLET_STORAGE_KEY);
  localStorage.removeItem(WALLET_CONNECTED_KEY);
  localStorage.removeItem(WALLET_AUTH_TIMESTAMP_KEY);
}

function hasValidWalletSession() {
  const savedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
  const wasConnected = localStorage.getItem(WALLET_CONNECTED_KEY) === "true";
  const timestampRaw = localStorage.getItem(WALLET_AUTH_TIMESTAMP_KEY);
  const timestamp = timestampRaw ? Number.parseInt(timestampRaw, 10) : Number.NaN;
  const isExpired = !Number.isFinite(timestamp) || Date.now() - timestamp > AUTH_EXPIRY_MS;

  return {
    savedWallet,
    wasConnected,
    isExpired
  };
}

// ═══════════════════════════════════════════════════
// LEVEL INCOME CALCULATOR
// ═══════════════════════════════════════════════════
const MGX_CALC_PACKAGES = [10,20,40,80,160,320,640,1280,2560,5120];
const MGX_DIRECT_PCT = 46;
const MGX_LEVEL_PCT  = 4;
const MGX_TOTAL_LEVELS = 10;

function LevelIncomeCalculator() {
  const [selPkg, setSelPkg] = useState(160);
  const [refs, setRefs] = useState(5);
  const cumPkg = useMemo(() => {
    const idx = MGX_CALC_PACKAGES.indexOf(selPkg);
    return MGX_CALC_PACKAGES.slice(0, idx + 1).reduce((a: number, b: number) => a + b, 0);
  }, [selPkg]);

  const directIncome = (cumPkg * MGX_DIRECT_PCT / 100) * refs;

  const levelRows = useMemo(() => Array.from({ length: MGX_TOTAL_LEVELS }, (_, i) => {
    const lvl = i + 1;
    const members = Math.pow(refs, lvl);
    const income  = cumPkg * (MGX_LEVEL_PCT / 100) * members;
    return { lvl, members, income };
  }), [selPkg, refs]);

  const totalLevel  = levelRows.reduce((s: number, r: {lvl:number,members:number,income:number}) => s + r.income, 0);
  const totalReward = directIncome + totalLevel;

  const fmt = (n: number): string => {
    if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
    if (n >= 1e3)  return `$${(n/1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };
  const fmtM = (n: number): string => {
    if (n >= 1e12) return `${Math.round(n/1e12)}T`;
    if (n >= 1e9)  return `${Math.round(n/1e9)}B`;
    if (n >= 1e6)  return `${Math.round(n/1e6)}M`;
    if (n >= 1e3)  return `${Math.round(n/1e3)}K`;
    return n.toLocaleString();
  };

  const G = '#C9A84C', C = '#38BDF8';
  const glass: React.CSSProperties = {
    background:'rgba(255,255,255,0.04)',
    border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:16,
  };
  const sliderPct = `${((refs-1)/9)*100}%`;

  return (
    <section id="lp-calculator" style={{background:'linear-gradient(180deg,#0a0f1e 0%,#0d1526 100%)',padding:'88px 0',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:'8%',left:'50%',transform:'translateX(-50%)',width:700,height:350,borderRadius:'50%',background:'radial-gradient(ellipse,rgba(201,168,76,0.05) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <div style={{maxWidth:1080,margin:'0 auto',padding:'0 22px'}}>
        <div style={{textAlign:'center',marginBottom:52}}>
          <span style={{display:'inline-block',padding:'5px 16px',borderRadius:100,background:'rgba(201,168,76,0.12)',border:'1px solid rgba(201,168,76,0.3)',color:G,fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',marginBottom:18}}>Interactive Tool</span>
          <h2 style={{fontSize:'clamp(26px,4.5vw,42px)',fontWeight:800,color:'#eef4ff',margin:'0 0 14px',lineHeight:1.2}}>Level Income Calculator</h2>
          <p style={{fontSize:16,color:'#94a3b8',maxWidth:520,margin:'0 auto',lineHeight:1.7}}>See how your community can grow based on the official MetaGuildX reward structure.</p>
        </div>
        <div style={{...glass,padding:'26px 28px',marginBottom:18}}>
          <div style={{color:'#64748b',fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>Step 01</div>
          <h3 style={{color:'#eef4ff',fontSize:17,fontWeight:700,margin:'5px 0 18px'}}>Select Your Package</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(88px,1fr))',gap:8}}>
            {MGX_CALC_PACKAGES.map(p => {
              const active = p === selPkg;
              return (
                <button key={p} onClick={() => setSelPkg(p)} style={{padding:'11px 6px',borderRadius:10,cursor:'pointer',textAlign:'center',border:active?`1.5px solid ${G}`:'1px solid rgba(255,255,255,0.08)',background:active?'rgba(201,168,76,0.15)':'rgba(255,255,255,0.03)',color:active?G:'#94a3b8',fontWeight:active?700:500,fontSize:13,transition:'all 0.2s',transform:active?'scale(1.04)':'scale(1)',boxShadow:active?'0 0 12px rgba(201,168,76,0.2)':'none'}}>
                  <div style={{fontSize:15,fontWeight:800}}>${p}</div>
                  <div style={{fontSize:10,marginTop:2,opacity:0.8}}>USDT</div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{...glass,padding:'26px 28px',marginBottom:18}}>
          <div style={{color:'#64748b',fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>Step 02</div>
          <h3 style={{color:'#eef4ff',fontSize:17,fontWeight:700,margin:'5px 0 18px'}}>Your Direct Referrals</h3>
          <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:74,height:74,borderRadius:14,flexShrink:0,background:'linear-gradient(135deg,rgba(56,189,248,0.14),rgba(56,189,248,0.04))',border:'1.5px solid rgba(56,189,248,0.3)'}}>
              <span style={{fontSize:28,fontWeight:800,color:C}}>{refs}</span>
            </div>
            <div style={{flex:1,minWidth:180}}>
              <input type="range" min={1} max={10} value={refs} onChange={e=>setRefs(Number(e.target.value))} style={{width:'100%',height:5,appearance:'none',WebkitAppearance:'none',borderRadius:3,outline:'none',cursor:'pointer',background:`linear-gradient(to right,${C} 0%,${C} ${sliderPct},rgba(255,255,255,0.1) ${sliderPct},rgba(255,255,255,0.1) 100%)`}}/>
              <div style={{display:'flex',justifyContent:'space-between',color:'#64748b',fontSize:11,marginTop:7}}>
                {[1,2,3,4,5,6,7,8,9,10].map(n=><span key={n} style={{color:n===refs?C:undefined}}>{n}</span>)}
              </div>
            </div>
            <div style={{color:'#64748b',fontSize:12,flexShrink:0}}>Direct Referrals</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,2fr)',gap:18,marginBottom:18,alignItems:'start'}} className="lp-calc-grid">
          <div style={{...glass,padding:'26px 22px',borderTop:`2px solid ${G}`}}>
            <div style={{color:'#64748b',fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',marginBottom:16}}>Step 03 — Direct Income</div>
            <div style={{marginBottom:16}}><div style={{color:'#94a3b8',fontSize:12,marginBottom:5}}>Selected Package</div><div style={{color:G,fontSize:22,fontWeight:800}}>${selPkg} <span style={{fontSize:12,fontWeight:500}}>USDT</span></div></div>
            <div style={{marginBottom:16}}><div style={{color:'#94a3b8',fontSize:12,marginBottom:5}}>Direct Referrals</div><div style={{color:C,fontSize:22,fontWeight:800}}>{refs} <span style={{fontSize:12,fontWeight:500}}>members</span></div></div>
            <div style={{borderTop:'1px solid rgba(255,255,255,0.08)',paddingTop:18}}>
              <div style={{color:'#94a3b8',fontSize:12,marginBottom:7}}>Your Direct Income</div>
              <div style={{color:'#eef4ff',fontSize:26,fontWeight:800,letterSpacing:-0.5}}>{fmt(directIncome)}</div>
              <div style={{color:'#64748b',fontSize:11,marginTop:4}}>${selPkg} × {MGX_DIRECT_PCT}% × {refs}</div>
            </div>
          </div>
          <div style={{...glass,padding:'26px 24px',borderTop:'2px solid rgba(56,189,248,0.55)'}}>
            <div style={{color:'#64748b',fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',marginBottom:18}}>Step 04 — Level Income Breakdown</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead><tr>{['Level','Members','Level %','Level Income'].map(h=><th key={h} style={{textAlign:'left',padding:'7px 10px',color:'#64748b',fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {levelRows.map(({lvl,members,income}:{lvl:number,members:number,income:number},idx:number)=>(
                    <tr key={lvl} style={{background:idx%2===0?'transparent':'rgba(255,255,255,0.02)'}}>
                      <td style={{padding:'8px 10px'}}><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:26,height:26,borderRadius:6,background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.2)',color:G,fontSize:10,fontWeight:700}}>L{lvl}</span></td>
                      <td style={{padding:'8px 10px',color:'#eef4ff',fontWeight:600}}>{fmtM(members)}</td>
                      <td style={{padding:'8px 10px',color:C}}>{MGX_LEVEL_PCT}%</td>
                      <td style={{padding:'8px 10px',color:'#eef4ff',fontWeight:700}}>{fmt(income)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{borderTop:'1px solid rgba(255,255,255,0.08)'}}><td colSpan={3} style={{padding:'11px 10px',color:'#94a3b8',fontSize:13,fontWeight:700}}>Total Level Income</td><td style={{padding:'11px 10px',color:G,fontSize:15,fontWeight:800}}>{fmt(totalLevel)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(201,168,76,0.11) 0%,rgba(56,189,248,0.07) 100%)',border:'1.5px solid rgba(201,168,76,0.28)',borderRadius:20,padding:'32px 36px',marginBottom:24,position:'relative',overflow:'hidden',boxShadow:'0 0 50px rgba(201,168,76,0.07)'}}>
          <div style={{position:'absolute',top:-40,right:-40,width:180,height:180,borderRadius:'50%',background:'radial-gradient(circle,rgba(201,168,76,0.14) 0%,transparent 70%)',pointerEvents:'none'}}/>
          <div style={{color:'#64748b',fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',marginBottom:22}}>Step 05 — Total Eligible Reward</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:18,alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
              <div style={{textAlign:'center'}}><div style={{color:'#94a3b8',fontSize:12,marginBottom:4}}>Direct Income</div><div style={{color:'#eef4ff',fontSize:20,fontWeight:700}}>{fmt(directIncome)}</div></div>
              <div style={{color:'#64748b',fontSize:22,fontWeight:300}}>+</div>
              <div style={{textAlign:'center'}}><div style={{color:'#94a3b8',fontSize:12,marginBottom:4}}>Total Level Income</div><div style={{color:C,fontSize:20,fontWeight:700}}>{fmt(totalLevel)}</div></div>
              <div style={{color:'#64748b',fontSize:22,fontWeight:300}}>=</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{color:G,fontSize:12,fontWeight:700,letterSpacing:1,textTransform:'uppercase',marginBottom:7}}>Total Eligible Reward</div>
              <div style={{fontSize:'clamp(28px,4.5vw,48px)',fontWeight:900,color:'#eef4ff',letterSpacing:-1,lineHeight:1}}>{fmt(totalReward)}</div>
              <div style={{color:'#64748b',fontSize:11,marginTop:5}}>USDT — Based on ${selPkg} Package × {refs} Referrals</div>
            </div>
          </div>
        </div>
        <p style={{textAlign:'center',color:'#475569',fontSize:12,lineHeight:1.7,maxWidth:620,margin:'0 auto'}}>⚠ This calculator is for illustration based on the official MetaGuildX reward structure. Actual rewards depend on valid registrations and smart contract conditions.</p>
      </div>
      <style>{`.lp-calc-grid{} @media(max-width:720px){.lp-calc-grid{grid-template-columns:1fr!important}} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:#38BDF8;border:2px solid #0a0f1e;cursor:pointer} input[type=range]::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:#38BDF8;border:2px solid #0a0f1e;cursor:pointer}`}</style>
    </section>
  );
}
// ═══════════════════════════════════════════════════
// END LevelIncomeCalculator
// ═══════════════════════════════════════════════════

function App() {
  const loadingShellStyle = { background: "#0a0a1a", borderRadius: 16, width: "100%" };
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isAdminRoute = pathname.startsWith("/admin");
  const isCommunityDashboardRoute = pathname.startsWith("/dashboard");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(fallbackSnapshot);
  const [status, setStatus] = useState("Ready");
  const [actionFeedback, setActionFeedback] = useState<{ title: string; detail: string } | null>(null);
  const [registrationSummary, setRegistrationSummary] = useState<RegistrationResult | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadStage, setLoadStage] = useState<"profile" | "income" | "complete">("profile");
  const [loadPhase, setLoadPhase] = useState<DashboardLoadPhase>("reading core config");
  const [loadStartedAt, setLoadStartedAt] = useState<number>(() => Date.now());
  const [loadElapsedSeconds, setLoadElapsedSeconds] = useState(0);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [startupDiagnostics, setStartupDiagnostics] = useState<StartupDiagnostics>({
    deployBlock: metaguildx.getDeploymentAnalyticsStartBlock(),
    currentBlock: null,
    rpcUrl: activeNetworkConfig.rpcUrl || "Not configured",
    coreAddress: activeNetworkConfig.contractAddress || "Not configured",
    scanRange: `${metaguildx.getDeploymentAnalyticsStartBlock()} -> pending`,
    walletConnected: false,
    registeredUserId: null
  });
  const [screen, setScreen] = useState<Screen>(isAdminRoute || isCommunityDashboardRoute ? "dashboard" : "landing");
  const [dashboardView, setDashboardView] = useState<DashboardView>("overview");
  const [treeMode, setTreeMode] = useState<"personal" | "level">("personal");
  const [selectedTreeUserId, setSelectedTreeUserId] = useState<number | null>(null);
  const [treeViewUserId, setTreeViewUserId] = useState<number | null>(null);
  const [selectedTreeDetails, setSelectedTreeDetails] = useState<TreeNodeDetails | null>(null);
  const [isLoadingTreeDetails, setIsLoadingTreeDetails] = useState(false);
  const [levelTreePreview, setLevelTreePreview] = useState<TreePreviewNode[]>([]);
  const [levelBreakdown, setLevelBreakdown] = useState<{ level: number; amount: string; members: number }[]>([]);
  const [personalTreePreview, setPersonalTreePreview] = useState<TreePreviewNode[]>([]);
  const [isLoadingLevelTree, setIsLoadingLevelTree] = useState(false);
  const [isBoxEarningsSyncing, setIsBoxEarningsSyncing] = useState(false);
  const [selectedRebirthId, setSelectedRebirthId] = useState<number | null>(null);
  const [rebirthNavStack, setRebirthNavStack] = useState<number[]>([]);
  const [rebirthNodeDetails, setRebirthNodeDetails] = useState<TreeNodeDetails | null>(null);
  const [isLoadingRebirthDetails, setIsLoadingRebirthDetails] = useState(false);
  const [rebirthBoxEarningsByPkg, setRebirthBoxEarningsByPkg] = useState<Record<number, string>>({});
  const [rebirthIncomeByUserId, setRebirthIncomeByUserId] = useState<
    Record<number, { directIncome: string; levelIncome: string; totalEarnings: string; walletAddress: string }>
  >({});
  const [rebirthDashView, setRebirthDashView] = useState<"earnings" | "tree" | "referral">("earnings");
  const [earningsDashTab, setEarningsDashTab] = useState<"overview" | "levels" | "boxcross" | "activity">("overview");
  const [networkDashTab, setNetworkDashTab] = useState<"referrals" | "tree" | "incomelog">("referrals");
  const [rebirthTreePreview, setRebirthTreePreview] = useState<TreePreviewNode[]>([]);
  const [referralCopyStatus, setReferralCopyStatus] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hasRef = params.has("ref");
      if (hasRef) return false;
      return localStorage.getItem("mgx_disclaimer_v1") === "true";
    } catch { return false; }
  });
  const [referralSponsorId, setReferralSponsorId] = useState<number | null>(null);
  const [referralSponsorProfile, setReferralSponsorProfile] = useState<{
    userId: number;
    account: string;
    packageLevel: number;
    directReferrals: number;
  } | null>(null);
  const [registerForm, setRegisterForm] = useState({ sponsorId: "0" });
  const [walletMoveAmount, setWalletMoveAmount] = useState("10");
  const [stakeForm, setStakeForm] = useState({ amount: "10", durationKey: "30D" as StakeDurationKey, autoCompound: true });
  const [walletSubView, setWalletSubView] = useState<WalletSubView>("main");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [onChainSearchResult, setOnChainSearchResult] = useState<any>(null);
  const [onChainSearchLoading, setOnChainSearchLoading] = useState(false);

  useEffect(() => {
    const q = userSearchQuery.trim();
    const isWallet = q.startsWith("0x") && q.length >= 10;
    const isEncoded = !isWallet && q.length >= 2 && /^[A-Za-z0-9]+$/.test(q);
    if (!isWallet && !isEncoded) {
      setOnChainSearchResult(null);
      return;
    }
    setOnChainSearchLoading(true);
    setOnChainSearchResult(null);
    const run = async () => {
      try {
        const { ethers } = await import("ethers");
        const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL, undefined, { staticNetwork: true });
        provider.pollingInterval = 15000;
        const core = new ethers.Contract(
          import.meta.env.VITE_CORE_ADDRESS,
          ["function userIdByAddress(address) view returns (uint256)",
           "function usersById(uint256) view returns (uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered)"],
          provider
        );
        let userId = 0;
        if (isWallet) {
          userId = Number(await core.userIdByAddress(q));
        } else {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
          let n = 0;
          for (const ch of q) { n = n * 62 + chars.indexOf(ch); }
          const decoded = n - 100000;
          if (decoded > 0 && decoded < 100000) { userId = decoded; }
          if (!userId) {
            const qUpper = q.charAt(0).toUpperCase() + q.slice(1);
            let n2 = 0;
            for (const ch of qUpper) { n2 = n2 * 62 + chars.indexOf(ch); }
            const decoded2 = n2 - 100000;
            if (decoded2 > 0 && decoded2 < 100000) userId = decoded2;
          }
        }
        if (userId > 0) {
          const u = await core.usersById(BigInt(userId));
          setOnChainSearchResult({ userId, account: u[1], packageLevel: Number(u[3]), directReferrals: Number(u[7]) });
        } else {
          setOnChainSearchResult({ notFound: true });
        }
      } catch {
        setOnChainSearchResult({ notFound: true });
      } finally {
        setOnChainSearchLoading(false);
      }
    };
    const timer = setTimeout(run, 600);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);
  const [privacySettings, setPrivacySettings] = useState<typeof defaultPrivacy>(() => {
    try {
      const saved = localStorage.getItem(PRIVACY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultPrivacy;
    } catch {
      return defaultPrivacy;
    }
  });
  const savePrivacy = (updated: typeof defaultPrivacy) => {
    setPrivacySettings(updated);
    localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(updated));
  };
  const defaultProfile = { nickname: "", displayName: "" };
  const [profileMeta, setProfileMeta] = useState(defaultProfile);
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});
  const getDisplayName = (wallet: string | undefined, userId: number): string => {
    if (!wallet) return `User #${encodeUserId(userId)}`;
    if (snapshot?.walletAddress && wallet.toLowerCase() === snapshot.walletAddress.toLowerCase()) {
      return profileMeta.displayName || profileMeta.nickname || `User #${encodeUserId(userId)}`;
    }
    const name = userDisplayNames[wallet.toLowerCase()];
    return name || `User #${encodeUserId(userId)}`;
  };
  const saveProfileMeta = (updated: typeof defaultProfile) => {
    setProfileMeta(updated);
    const walletKey = snapshot?.walletAddress
      ? `mgx_profile_v1_${snapshot.walletAddress.toLowerCase()}`
      : PROFILE_STORAGE_KEY;
    localStorage.setItem(walletKey, JSON.stringify(updated));
    // Also save to backend
    if (snapshot?.walletAddress) {
      fetch(`${import.meta.env.VITE_PLACEMENT_SIGNER_URL}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": snapshot.walletAddress.toLowerCase(),
        },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
  };
  const [profileSaved, setProfileSaved] = useState(false);

  const navigateToRebirth = (id: number) => {
    setRebirthNavStack(prev => selectedRebirthId ? [...prev, selectedRebirthId] : prev);
    setSelectedRebirthId(id);
    setRebirthDashView("earnings");
  };

  const rebirthGoBack = () => {
    if (rebirthNavStack.length > 0) {
      const prev = [...rebirthNavStack];
      const last = prev.pop()!;
      setRebirthNavStack(prev);
      setSelectedRebirthId(last);
      setRebirthDashView("earnings");
    } else {
      setSelectedRebirthId(null);
      setRebirthNavStack([]);
      setRebirthDashView("earnings");
    }
  };

  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [stakingContractMGXBalance, setStakingContractMGXBalance] = useState<bigint>(0n);
  const [stakingDataLoading, setStakingDataLoading] = useState(true);
  const [stakingRewardCountdown, setStakingRewardCountdown] = useState("--:--:--");
  const [regStep, setRegStep] = useState(0);
  const [registrationConsent, setRegistrationConsent] = useState({ terms: false, restrictedCountry: false });
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [showActivationConfirm, setShowActivationConfirm] = useState(false);
  const [selectedWalletOption, setSelectedWalletOption] = useState<"metamask" | "walletconnect" | null>(null);
  const [isJustConnected, setIsJustConnected] = useState(false);
  const adminPanelUrl = resolveAdminPanelUrl();
  const [adminOwnerAddress, setAdminOwnerAddress] = useState<string | null>(null);
  const [isCheckingAdminAccess, setIsCheckingAdminAccess] = useState(false);
  const [currentWalletChainId, setCurrentWalletChainId] = useState<number | null>(null);
  const [liveWalletStakeState, setLiveWalletStakeState] = useState<LiveWalletStakeState | null>(null);
  const isDashboardPolling = useRef(false);
  const isStakePending = useRef(false);
  const deferredDashboardAnalyticsInFlight = useRef<string | null>(null);

  function beginLoadPhase(phase: DashboardLoadPhase, nextStatus?: string) {
    setLoadPhase(phase);
    if (phase !== "complete" && phase !== "error") {
      setIsLoading(true);
    }
    if (nextStatus) {
      setStatus(nextStatus);
    }
  }

  function startLoadingSession(phase: DashboardLoadPhase, nextStatus?: string) {
    setLoadStartedAt(Date.now());
    setLoadElapsedSeconds(0);
    setLoadFailure(null);
    beginLoadPhase(phase, nextStatus);
  }

  function finishLoadingSession(phase: DashboardLoadPhase = "complete") {
    setLoadPhase(phase);
    setIsLoading(false);
  }

  function markLoadFailure(message: string) {
    setLoadFailure(message);
    setLoadPhase("error");
    setStatus(message);
    setIsLoading(false);
  }

  async function withDashboardTimeout<T>(promise: Promise<T>, label: string) {
    // timing disabled
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) =>
          window.setTimeout(() => reject(new Error(`${label} timed out after 90s`)), DASHBOARD_LOAD_TIMEOUT_MS)
        )
      ]);
    } finally {
      // timing disabled
    }
  }

  async function refreshStartupDiagnostics(walletConnected: boolean, registeredUserId: number | null) {
    const deployBlock = metaguildx.getDeploymentAnalyticsStartBlock();
    let currentBlock: number | null = null;

    if (activeNetworkConfig.rpcUrl) {
      try {
        // timing disabled
        const provider = new JsonRpcProvider(activeNetworkConfig.rpcUrl, undefined, { staticNetwork: true });
        provider.pollingInterval = 15000;
        currentBlock = await Promise.race<number>([
          provider.getBlockNumber(),
          new Promise<number>((_, reject) =>
            window.setTimeout(() => reject(new Error("provider.getBlockNumber timed out after 90s")), DASHBOARD_LOAD_TIMEOUT_MS)
          )
        ]);
      } catch (error) {
        console.warn("Startup diagnostics block read failed", error);
      } finally {
        // timing disabled
      }
    }

    setStartupDiagnostics({
      deployBlock,
      currentBlock,
      rpcUrl: activeNetworkConfig.rpcUrl || "Not configured",
      coreAddress: activeNetworkConfig.contractAddress || "Not configured",
      scanRange: `${deployBlock} -> ${currentBlock ?? "pending"}`,
      walletConnected,
      registeredUserId
    });
  }

  function getFriendlyErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "Transaction failed");
    const normalized = message.toLowerCase();

    if (
      normalized.includes("action_rejected") ||
      normalized.includes("user denied") ||
      normalized.includes("ethers-user-denied") ||
      normalized.includes("close window") ||
      normalized.includes("rejected")
    ) {
      return "MetaMask request was cancelled. Open MetaMask and approve the request to continue.";
    }

    if (normalized.includes("insufficient usdt")) {
      return "Not enough USDT in the connected wallet. Check your balance and try again.";
    }

    if (normalized.includes("approval is too low")) {
      return "USDT approval is not complete yet. Approve the transaction in MetaMask and try again.";
    }

    if (normalized.includes("insufficient funds")) {
      return "Not enough balance for gas fees. Add some native token to the wallet and try again.";
    }

    if (normalized.includes("wallet connection failed")) {
      return "Wallet connection failed. Open MetaMask, select the correct network, approve the connection request, and try again.";
    }

    if (normalized.includes("user_not_active") || normalized.includes("please complete registration first")) {
      return "Please complete registration first.";
    }

    if (normalized.includes("stake locked")) {
      return "This stake is still locked. Wait until the unlock date shown in your staking position.";
    }

    if (normalized.includes("not registered")) {
      return "This wallet is not registered yet. Complete Package 1 registration first.";
    }

    if (normalized.includes("call_exception") || normalized.includes("missing revert data") || normalized.includes("execution reverted")) {
      return "Network error, please retry.";
    }

    return message;
  }
  const asMgx = (value: string | number) => `${value} MGX`;
  const expectedChainId = Number(activeNetworkConfig.chainId ?? 31337);
  const isWrongAdminNetwork =
    isAdminRoute &&
    Boolean(snapshot.walletAddress) &&
    currentWalletChainId !== null &&
    currentWalletChainId !== expectedChainId;
  const isAdminAuthorized =
    isAdminRoute &&
    Boolean(snapshot.walletAddress) &&
    Boolean(adminOwnerAddress) &&
    !isWrongAdminNetwork &&
    snapshot.walletAddress!.toLowerCase() === adminOwnerAddress!.toLowerCase();

  useEffect(() => {
    let isActive = true;

    async function checkAdminAccess() {
      if (!isAdminRoute) {
        setAdminOwnerAddress(null);
        setCurrentWalletChainId(null);
        setIsCheckingAdminAccess(false);
        return;
      }

      const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
      if (!snapshot.walletAddress || !ethereum) {
        setAdminOwnerAddress(null);
        setCurrentWalletChainId(null);
        setIsCheckingAdminAccess(false);
        return;
      }

      setIsCheckingAdminAccess(true);

      try {
        const provider = new ethers.BrowserProvider(ethereum);
        const network = await provider.getNetwork();
        if (!isActive) {
          return;
        }

        const nextChainId = Number(network.chainId);
        setCurrentWalletChainId(nextChainId);

        if (nextChainId !== expectedChainId) {
          setAdminOwnerAddress(null);
          return;
        }

        if (isActive) {
          setAdminOwnerAddress(TESTNET_ADMIN_WALLET);
        }
      } catch {
        if (isActive) {
          setAdminOwnerAddress(null);
        }
      } finally {
        if (isActive) {
          setIsCheckingAdminAccess(false);
        }
      }
    }

    void checkAdminAccess();

    return () => {
      isActive = false;
    };
  }, [expectedChainId, isAdminRoute, snapshot.walletAddress]);

  useEffect(() => {
    let isActive = true;

    async function loadLiveWalletState() {
      if (!snapshot.walletAddress) {
        setLiveWalletStakeState(null);
        return;
      }

      try {
        const nextState = await metaguildx.loadLiveWalletStakeState(snapshot.walletAddress);
        if (isActive) {
          setLiveWalletStakeState(nextState);
        }
      } catch {
        if (isActive) {
          setLiveWalletStakeState(null);
        }
      }
    }

    void loadLiveWalletState();

    return () => {
      isActive = false;
    };
  }, [snapshot.walletAddress, snapshot.userId, snapshot.isRegistered]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadElapsedSeconds(Math.max(0, Math.floor((Date.now() - loadStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isLoading, loadStartedAt]);

  useEffect(() => {
    void refreshStartupDiagnostics(Boolean(snapshot.walletAddress), snapshot.userId ?? null);
  }, [snapshot.walletAddress, snapshot.userId]);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadStage("profile");
    startLoadingSession("reading core config", "Reading core config...");
    startTransition(() => {
      const { savedWallet, wasConnected, isExpired } = hasValidWalletSession();
      const boot = async () => {
        if (savedWallet && wasConnected && !isExpired) {
          try {
            beginLoadPhase("connecting wallet", "Connecting wallet...");
            const restoredAddress = await withDashboardTimeout(
              metaguildx.connectWalletSilently(savedWallet),
              "wallet reconnect"
            );
            beginLoadPhase("loading user profile", "Loading user profile...");
            const restoredSnapshot = await withDashboardTimeout(
              metaguildx.loadDashboardSnapshot(restoredAddress),
              "fetchDashboardData"
            );
            if (!isActive) {
              return;
            }
            replaceAppPath("/dashboard");
            setScreen("dashboard");
            setDashboardView(restoredSnapshot.isRegistered ? "overview" : "register");
            setSelectedTreeUserId(restoredSnapshot.userId ?? restoredSnapshot.rootUserId ?? null);
            setStatus("Wallet restored. Loading your dashboard now.");
            setLoadStage("income");
            beginLoadPhase("loading analytics", "Loading analytics...");
            setSnapshot(restoredSnapshot);
            if (restoredSnapshot.isRegistered && restoredSnapshot.userId) {
              const _boxProvider = new JsonRpcProvider(activeNetworkConfig.rpcUrl || PUBLIC_TESTNET_RPC);
              metaguildx.loadBoxEarningsForUser({
                userId: restoredSnapshot.userId,
                provider: _boxProvider,
                incomeAddress: metaguildx.getConfiguredIncomeAddress
              }).then((boxResult) => {
                applyDeferredBoxEarnings(restoredSnapshot.walletAddress, restoredSnapshot.userId!, boxResult);
              }).catch(() => {});
            }
            beginLoadPhase("loading tree", "Loading tree...");
            beginLoadPhase("loading earnings", "Loading earnings...");
            setLoadStage("complete");
            finishLoadingSession("complete");
            return;
          } catch (bootError) {
            console.warn('boot restore failed, retrying silent load', bootError);
            try {
              const retrySnapshot = await withDashboardTimeout(metaguildx.loadDashboardSnapshot(savedWallet), 'fetchDashboardData');
              if (isActive) {
                replaceAppPath('/dashboard');
                setScreen('dashboard');
                setDashboardView(retrySnapshot.isRegistered ? 'overview' : 'register');
                setSelectedTreeUserId(retrySnapshot.userId ?? retrySnapshot.rootUserId ?? null);
                setSnapshot(retrySnapshot);
                if (retrySnapshot.isRegistered && retrySnapshot.userId) {
                  const _boxProvider = new JsonRpcProvider(activeNetworkConfig.rpcUrl || PUBLIC_TESTNET_RPC);
                  metaguildx.loadBoxEarningsForUser({
                    userId: retrySnapshot.userId,
                    provider: _boxProvider,
                    incomeAddress: metaguildx.getConfiguredIncomeAddress
                  }).then((boxResult) => {
                    if (isActive) {
                      applyDeferredBoxEarnings(retrySnapshot.walletAddress, retrySnapshot.userId!, boxResult);
                    }
                  }).catch(() => {});
                }
                setLoadStage('complete');
                finishLoadingSession('complete');
                return;
              }
            } catch {
              clearWalletSession();
            }
          }
        }

        if (savedWallet && wasConnected && isExpired) {
          clearWalletSession();
          if (isActive) {
            setStatus("Wallet session expired. Please reconnect and sign the login message again.");
          }
        }

        beginLoadPhase("loading user profile", "Loading user profile...");
        const nextSnapshot = await withDashboardTimeout(
          metaguildx.loadDashboardSnapshot(null),
          "fetchDashboardData"
        );
        if (!isActive) {
          return;
        }
        setLoadStage("income");
        beginLoadPhase("loading analytics", "Loading analytics...");
        setSnapshot(nextSnapshot);
        if (nextSnapshot.isRegistered && nextSnapshot.userId) {
          const _boxProvider = new JsonRpcProvider(activeNetworkConfig.rpcUrl || PUBLIC_TESTNET_RPC);
          metaguildx.loadBoxEarningsForUser({
            userId: nextSnapshot.userId,
            provider: _boxProvider,
            incomeAddress: metaguildx.getConfiguredIncomeAddress
          }).then((boxResult) => {
            if (isActive) {
              applyDeferredBoxEarnings(nextSnapshot.walletAddress, nextSnapshot.userId!, boxResult);
            }
          }).catch(() => {});
        }
        beginLoadPhase("loading tree", "Loading tree...");
        beginLoadPhase("loading earnings", "Loading earnings...");
        setLoadStage("complete");
        finishLoadingSession("complete");
      };

      Promise.resolve(boot())
        .catch((error) => {
          if (isActive) {
            setSnapshot(fallbackSnapshot);
            markLoadFailure(getFriendlyErrorMessage(error));
          }
        })
        .finally(() => {
          if (isActive) {
            if (!loadFailure) {
              setIsLoading(false);
            }
          }
        });
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (isAdminRoute || typeof window === "undefined" || !window.ethereum) {
      return;
    }

    const ethereum = window.ethereum as {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!ethereum.on || !ethereum.removeListener) {
      return;
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccount = Array.isArray(accounts) && typeof accounts[0] === "string"
        ? accounts[0].toLowerCase()
        : "";
      const currentAccount = (snapshot.walletAddress ?? localStorage.getItem(WALLET_STORAGE_KEY) ?? "").toLowerCase();
      if (nextAccount !== currentAccount) {
        clearWalletSession();
        window.location.reload();
      }
    };
    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [isAdminRoute, snapshot.walletAddress]);

  useEffect(() => {
    if (screen !== "landing" || !window.ethereum) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.ethereum?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }]
      }).catch(() => undefined);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [screen]);

  useEffect(() => {
    let isActive = true;

    async function fetchLandingStats() {
      const rpcUrl = PUBLIC_TESTNET_RPC || activeNetworkConfig.rpcUrl;
      const contractAddress =
        activeNetworkConfig.chainId === 5611
          ? PUBLIC_TESTNET_CORE_ADDRESS || activeNetworkConfig.contractAddress
          : PUBLIC_TESTNET_CORE_ADDRESS || activeNetworkConfig.contractAddress;
      if (!contractAddress || !rpcUrl) {
        return;
      }

      try {
        const provider = new JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
        provider.pollingInterval = 15000;
        const core = new Contract(contractAddress, landingStatsCoreAbi, provider);
        const [nextId, latestBlock] = await Promise.all([
          core.nextUserId(),
          provider.getBlockNumber()
        ]);
        const deploymentStartBlock = metaguildx.getDeploymentAnalyticsStartBlock(latestBlock);
        const [registrations, upgrades] = await Promise.all([
          core.queryFilter(core.filters.UserRegistered(), deploymentStartBlock, latestBlock),
          core.queryFilter(core.filters.PackageUpgraded(), deploymentStartBlock, latestBlock)
        ]);
        const aggregateVolume =
          registrations.reduce((sum, event) => {
            if (!("args" in event)) {
              return sum;
            }
            const rawAmount = event.args?.amount;
            return typeof rawAmount === "bigint" ? sum + metaguildx.formatPlatformAmountNumber(rawAmount) : sum;
          }, 0) +
          upgrades.reduce((sum, event) => {
            if (!("args" in event)) {
              return sum;
            }
            const rawAmount = event.args?.amount;
            return typeof rawAmount === "bigint" ? sum + metaguildx.formatPlatformAmountNumber(rawAmount) : sum;
          }, 0);

        if (isActive) {
          setTotalUsers(Math.max(0, Number(nextId) - 1));
          setTotalVolume(aggregateVolume);
        }
      } catch {
        if (isActive) {
          setTotalUsers(0);
          setTotalVolume(0);
        }
      }
    }

    void fetchLandingStats();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const refValue = new URLSearchParams(window.location.search).get("ref");
    if (!refValue) {
      return;
    }

    function decodeUserId(encoded: string): number {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let n = 0;
      for (const c of encoded) {
        n = n * 62 + chars.indexOf(c);
      }
      return n - 100000;
    }
    const isNumeric = /^\d+$/.test(refValue);
    const parsedRef = isNumeric ? Number(refValue) : decodeUserId(refValue);
    if (!Number.isFinite(parsedRef) || parsedRef <= 0) {
      return;
    }

    setReferralSponsorId(parsedRef);
    setRegisterForm((current) => ({ ...current, sponsorId: String(parsedRef) }));
  }, []);

  useEffect(() => {
    if (referralSponsorId !== null || snapshot.isRegistered) {
      return;
    }

    const defaultSponsorId = snapshot.rootUserId && snapshot.rootUserId > 0 ? String(snapshot.rootUserId) : "0";
    setRegisterForm((current) => (current.sponsorId === defaultSponsorId ? current : { ...current, sponsorId: defaultSponsorId }));
  }, [referralSponsorId, snapshot.isRegistered, snapshot.rootUserId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isDashboardPolling.current) {
        return;
      }

      isDashboardPolling.current = true;
      Promise.resolve(metaguildx.loadDashboardSnapshot(snapshot.walletAddress))
        .then((newSnap) => setSnapshot((prev) => mergeSnapshotPreservingDeferredAnalytics(prev, newSnap)))
        .catch(() => undefined)
        .finally(() => {
          isDashboardPolling.current = false;
        });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
      isDashboardPolling.current = false;
    };
  }, [snapshot.walletAddress]);

  useEffect(() => {
    const handleSnapshotRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ snapshot?: DashboardSnapshot; walletAddress?: string | null }>).detail;
      const nextSnapshot = detail?.snapshot;
      if (!nextSnapshot) {
        return;
      }

      setSnapshot((prev) => {
        const currentWallet = (prev.walletAddress ?? "").toLowerCase();
        const nextWallet = (detail.walletAddress ?? nextSnapshot.walletAddress ?? "").toLowerCase();
        if (currentWallet && nextWallet && currentWallet !== nextWallet) {
          return prev;
        }
        return mergeSnapshotPreservingDeferredAnalytics(prev, nextSnapshot);
      });
    };

    window.addEventListener(metaguildx.DASHBOARD_SNAPSHOT_REFRESH_EVENT, handleSnapshotRefresh);
    return () => window.removeEventListener(metaguildx.DASHBOARD_SNAPSHOT_REFRESH_EVENT, handleSnapshotRefresh);
  }, []);

  useEffect(() => {
    if (!snapshot.isRegistered || !snapshot.userId) {
      return;
    }

    const key = `${(snapshot.walletAddress ?? "").toLowerCase()}-${snapshot.userId}`;
    if (deferredDashboardAnalyticsInFlight.current === key) {
      return;
    }

    let isActive = true;
    deferredDashboardAnalyticsInFlight.current = key;
    const timeoutId = window.setTimeout(() => {
      metaguildx.loadDeferredDashboardAnalytics({
        userId: snapshot.userId!,
        walletAddress: snapshot.walletAddress
      })
        .then((analytics) => {
          if (isActive) {
            applyDeferredDashboardAnalytics(snapshot.userId!, analytics);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (deferredDashboardAnalyticsInFlight.current === key) {
            deferredDashboardAnalyticsInFlight.current = null;
          }
        });
    }, 300);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      if (deferredDashboardAnalyticsInFlight.current === key) {
        deferredDashboardAnalyticsInFlight.current = null;
      }
    };
  }, [snapshot.isRegistered, snapshot.userId, snapshot.walletAddress]);

  useEffect(() => {
    if (!snapshot?.walletAddress) {
      setProfileMeta(defaultProfile);
      return;
    }
    const walletKey = `mgx_profile_v1_${snapshot.walletAddress.toLowerCase()}`;
    // First load from localStorage (instant)
    try {
      const saved = localStorage.getItem(walletKey);
      if (saved) setProfileMeta(JSON.parse(saved));
    } catch {}
    // Then fetch from backend (authoritative)
    fetch(`${import.meta.env.VITE_PLACEMENT_SIGNER_URL}/profile?wallet=${snapshot.walletAddress.toLowerCase()}`)
      .then(r => r.json())
      .then((data: { displayName?: string; nickname?: string }) => {
        if (data.displayName || data.nickname) {
          const merged = {
            displayName: data.displayName ?? "",
            nickname: data.nickname ?? "",
          };
          setProfileMeta(merged);
          localStorage.setItem(walletKey, JSON.stringify(merged));
        }
      })
      .catch(() => {});
  }, [snapshot?.walletAddress]);

  useEffect(() => {
    let isActive = true;

    if (referralSponsorId === null) {
      setReferralSponsorProfile(null);
      return () => {
        isActive = false;
      };
    }

    Promise.resolve(metaguildx.loadReferralSponsorPreview(referralSponsorId))
      .then((profile) => {
        if (isActive) {
          setReferralSponsorProfile(profile);
        }
      })
      .catch(() => {
        if (isActive) {
          setReferralSponsorProfile(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [referralSponsorId]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [dashboardView]);

  useEffect(() => {
    if (!actionFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [actionFeedback]);

  useEffect(() => {
    if (!selectedTreeUserId || !["tree", "network"].includes(dashboardView) || treeMode !== "personal") {
      return;
    }

    let isActive = true;
    setIsLoadingTreeDetails(true);

    Promise.resolve(metaguildx.loadTreeNodeDetails(selectedTreeUserId))
      .then((details) => {
        if (isActive) {
          setSelectedTreeDetails(details);
        }
      })
      .catch(() => {
        if (isActive) {
          setSelectedTreeDetails(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingTreeDetails(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [dashboardView, selectedTreeUserId, treeMode]);

  useEffect(() => {
    if (dashboardView !== "rebirth") {
      return;
    }

    if (!selectedRebirthId) {
      setRebirthNodeDetails(null);
      return;
    }

    let isActive = true;
    setIsLoadingRebirthDetails(true);

    Promise.resolve(metaguildx.loadTreeNodeDetails(selectedRebirthId))
      .then((details) => {
        if (isActive) {
          setRebirthNodeDetails(details);
        }
      })
      .catch(() => {
        if (isActive) {
          setRebirthNodeDetails(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingRebirthDetails(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [dashboardView, selectedRebirthId]);

  useEffect(() => {
    if (!selectedRebirthId || dashboardView !== "rebirth") {
      setRebirthBoxEarningsByPkg({});
      return;
    }

    let isActive = true;

    Promise.resolve(metaguildx.loadUserBoxEarnings(selectedRebirthId))
      .then((boxEarnings) => {
        if (isActive) {
          setRebirthBoxEarningsByPkg(boxEarnings);
        }
      })
      .catch(() => {
        if (isActive) {
          setRebirthBoxEarningsByPkg({});
        }
      });

    return () => {
      isActive = false;
    };
  }, [dashboardView, selectedRebirthId]);

  useEffect(() => {
    if (dashboardView !== "rebirth") {
      return;
    }

    if (snapshot.rebirthIds.length === 0) {
      setRebirthIncomeByUserId({});
      return;
    }

    let isActive = true;

    Promise.all(
      snapshot.rebirthIds.map(async (rebirthId) => {
        const details = await metaguildx.loadTreeNodeDetails(rebirthId);
        return [
          rebirthId,
          {
            directIncome: details?.directIncome ?? "0",
            levelIncome: details?.levelIncome ?? "0",
            totalEarnings:
              details?.totalEarnings ??
              (parseFloat(details?.directIncome ?? "0") + parseFloat(details?.levelIncome ?? "0")).toFixed(2),
            walletAddress: details?.walletAddress ?? snapshot.walletAddress ?? ""
          }
        ] as const;
      })
    )
      .then((entries) => {
        if (isActive) {
          setRebirthIncomeByUserId(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (isActive) {
          setRebirthIncomeByUserId({});
        }
      });

    return () => {
      isActive = false;
    };
  }, [dashboardView, snapshot.rebirthIds.join(","), snapshot.walletAddress]);

  useEffect(() => {
    if (!selectedRebirthId || dashboardView !== "rebirth") {
      setRebirthTreePreview([]);
      return;
    }

    let isActive = true;

    async function loadRebirthTree(rebirthId: number) {
      const preview: TreePreviewNode[] = [];
      const queue: number[] = [rebirthId];
      const visited = new Set<number>();
      const maxNodes = 30;

      while (queue.length > 0 && preview.length < maxNodes) {
        const uid = queue.shift();
        if (!uid || visited.has(uid)) {
          continue;
        }
        visited.add(uid);

        try {
          const details = await metaguildx.loadTreeNodeDetails(uid);
          if (!details) {
            continue;
          }

          const fallbackNode = snapshot.treePreview.find((node) => node.userId === uid) ?? null;

          preview.push({
            userId: details.userId,
            parentId: uid === rebirthId ? 0 : details.parentId,
            leftChildId: details.leftChildId,
            rightChildId: details.rightChildId,
            depth: uid === rebirthId ? 0 : fallbackNode?.depth ?? details.depth,
            packageLevel: details.packageLevel,
            account: details.walletAddress,
            directReferrals: details.directReferrals,
            totalTeamBusiness: details.totalTeamBusiness,
            totalEarnings: details.totalEarnings,
            mgxAllocated: details.mgxAllocated,
            userActiveBoxId: details.userActiveBoxId
          });

          if (details.leftChildId > 0) {
            queue.push(details.leftChildId);
          }
          if (details.rightChildId > 0) {
            queue.push(details.rightChildId);
          }
        } catch {
          // Skip individual nodes so one failed child does not blank the subtree.
        }
      }

      if (isActive) {
        setRebirthTreePreview(preview);
      }
    }

    void loadRebirthTree(selectedRebirthId);

    return () => {
      isActive = false;
    };
  }, [dashboardView, selectedRebirthId, snapshot.treePreview]);

  useEffect(() => {
    const mgxAddress = import.meta.env.VITE_MGX_TOKEN_ADDRESS?.trim();
    const stakingAddress = import.meta.env.VITE_MGX_STAKING_ADDRESS?.trim();
    const rpcUrl = activeNetworkConfig.rpcUrl;

    if (!snapshot.walletAddress || !mgxAddress || !stakingAddress || !rpcUrl) {
      setStakingContractMGXBalance(0n);
      setStakingRewardCountdown("--:--:--");
      setStakingDataLoading(false);
      return;
    }

    let isActive = true;

    async function loadStakingContractBalance() {
      try {
        if (isActive) {
          setStakingDataLoading(true);
        }
        const provider = new JsonRpcProvider(rpcUrl);
        const mgx = new ethers.Contract(
          mgxAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );

        const contractMGXBal = await mgx.balanceOf(stakingAddress);
        if (isActive) {
          setStakingContractMGXBalance(BigInt(contractMGXBal));
          setStakingDataLoading(false);
        }
      } catch {
        if (isActive) {
          setStakingContractMGXBalance(0n);
          setStakingDataLoading(false);
        }
      }
    }

    void loadStakingContractBalance();

    return () => {
      isActive = false;
    };
  }, [snapshot.walletAddress, snapshot.totalStaked]);

  useEffect(() => {
    if (!["tree", "network"].includes(dashboardView) || treeMode !== "level") {
      return;
    }

    let isActive = true;
    setIsLoadingLevelTree(true);

    Promise.resolve(metaguildx.loadLevelTreePreview(snapshot.userId))
      .then((nextTree) => {
        if (!isActive) {
          return;
        }

        setLevelTreePreview(nextTree);
        if (nextTree.length === 0) {
          setSelectedTreeUserId(null);
          return;
        }

        const selectedStillExists = nextTree.some((node) => node.userId === selectedTreeUserId);
        if (!selectedStillExists) {
          const nextRoot = nextTree.find((node) => node.parentId === 0) ?? nextTree[0];
          setSelectedTreeUserId(nextRoot?.userId ?? null);
        }
      })
      .catch(() => {
        if (isActive) {
          setLevelTreePreview([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingLevelTree(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [dashboardView, treeMode, snapshot.userId, snapshot.levelIncome]);

  useEffect(() => {
    if (!snapshot.userId || snapshot.userId <= 0) {
      setLevelBreakdown([]);
      return;
    }
    if (dashboardView !== "income" || earningsDashTab !== "levels") {
      return;
    }
    let isActive = true;
    const currentTotalLevelIncomeValue = parseDisplayNumber(snapshot.levelIncome);

    metaguildx.loadLevelIncomeBreakdown(
      snapshot.userId,
      currentTotalLevelIncomeValue
    ).then((rows) => {
      if (!isActive) return;
      setLevelBreakdown(rows);
    }).catch(() => {
      if (isActive) setLevelBreakdown([]);
    });

    return () => { isActive = false; };
  }, [dashboardView, earningsDashTab, snapshot.userId, snapshot.levelIncome]);

  useEffect(() => {
    if (
      dashboardView !== "income" ||
      earningsDashTab !== "boxcross" ||
      !snapshot.isRegistered ||
      !snapshot.userId ||
      Object.keys(snapshot.boxEarningsByPackage ?? {}).length > 0
    ) {
      return;
    }

    let isActive = true;
    setIsBoxEarningsSyncing(true);
    const _boxProvider = new JsonRpcProvider(activeNetworkConfig.rpcUrl || PUBLIC_TESTNET_RPC);
    metaguildx.loadBoxEarningsForUser({
      userId: snapshot.userId,
      provider: _boxProvider,
      incomeAddress: metaguildx.getConfiguredIncomeAddress
    }).then((boxResult) => {
      if (isActive) {
        applyDeferredBoxEarnings(snapshot.walletAddress, snapshot.userId!, boxResult);
      }
    }).catch(() => {}).finally(() => {
      if (isActive) {
        setIsBoxEarningsSyncing(false);
      }
    });

    return () => {
      isActive = false;
    };
  }, [dashboardView, earningsDashTab, snapshot.isRegistered, snapshot.userId, snapshot.walletAddress, snapshot.boxEarningsByPackage]);

  useEffect(() => {
    if (["tree", "network"].includes(dashboardView)) {
      return;
    }

    setTreeViewUserId(null);
  }, [dashboardView]);

  useEffect(() => {
    if (dashboardView === "income") {
      setEarningsDashTab("overview");
    }
    if (dashboardView === "network" || dashboardView === "tree") {
      setNetworkDashTab("referrals");
    }
  }, [dashboardView]);

  useEffect(() => {
    if (!["tree", "network"].includes(dashboardView) || treeMode !== "personal") {
      return;
    }

    let isActive = true;
    const targetUserId = treeViewUserId ?? snapshot.userId;

    if (!targetUserId || targetUserId <= 0) {
      setPersonalTreePreview([]);
      return;
    }

    Promise.resolve(
      metaguildx.loadPersonalTreePreview(targetUserId)
    ).then((nodes) => {
      if (!isActive) {
        return;
      }
      if (nodes.length > 0) {
        setPersonalTreePreview(nodes);
      } else {
        setPersonalTreePreview([]);
      }
    }).catch(() => {
      if (isActive) {
        setPersonalTreePreview([]);
      }
    });

    return () => {
      isActive = false;
    };
  }, [dashboardView, treeMode, snapshot.userId, treeViewUserId]);

  useEffect(() => {
    if (!["network", "tree"].includes(dashboardView)) return;
    const wallets = snapshot.treePreview
      .map(n => n.account)
      .filter((w): w is string => !!w && w !== "0x0000000000000000000000000000000000000000")
      .slice(0, 30);
    if (wallets.length === 0) return;
    const url = `${import.meta.env.VITE_PLACEMENT_SIGNER_URL}/profiles/batch?wallets=${wallets.join(",")}`;
    fetch(url)
      .then(r => r.json())
      .then((data: { wallet: string; displayName: string; nickname: string }[]) => {
        const map: Record<string, string> = {};
        for (const p of data) {
          if (p.displayName || p.nickname) {
            map[p.wallet.toLowerCase()] = p.displayName || p.nickname;
          }
        }
        setUserDisplayNames(map);
      })
      .catch(() => {});
  }, [dashboardView, snapshot.treePreview]);

  function mergeQuickSnapshot(current: DashboardSnapshot, quick: DashboardSnapshot): DashboardSnapshot {
    return {
      ...current,
      ...quick,
      packagePrices: quick.packagePrices.length ? quick.packagePrices : current.packagePrices,
      boxPrices: quick.boxPrices.length ? quick.boxPrices : current.boxPrices,
      rootUserId: quick.rootUserId ?? current.rootUserId,
      featuredUsers: quick.featuredUsers.length ? quick.featuredUsers : current.featuredUsers,
      treePreview: quick.treePreview.length ? quick.treePreview : current.treePreview,
      activityFeed: quick.activityFeed.length ? quick.activityFeed : current.activityFeed,
      currentBoxId: quick.currentBoxId || current.currentBoxId,
      currentBoxPrice: quick.currentBoxPrice !== "1.00" ? quick.currentBoxPrice : current.currentBoxPrice,
      currentBoxDistributed: quick.currentBoxDistributed !== "0" ? quick.currentBoxDistributed : current.currentBoxDistributed,
      currentBoxCap: quick.currentBoxCap !== "0" ? quick.currentBoxCap : current.currentBoxCap,
      currentBoxRemaining: quick.currentBoxRemaining !== "0" ? quick.currentBoxRemaining : current.currentBoxRemaining,
      packageOneBucketEarnings: quick.packageOneBucketEarnings !== "0" ? quick.packageOneBucketEarnings : current.packageOneBucketEarnings,
      currentPackageBucketEarnings: quick.currentPackageBucketEarnings !== "0" ? quick.currentPackageBucketEarnings : current.currentPackageBucketEarnings,
      boxEarningsByPackage: Object.keys(quick.boxEarningsByPackage ?? {}).length
        ? quick.boxEarningsByPackage
        : current.boxEarningsByPackage
    };
  }

  function numericDisplayValue(value: string | number | null | undefined) {
    return Number(String(value ?? "0").replace(/[$,]/g, ""));
  }

  function mergeSnapshotPreservingDeferredAnalytics(prev: DashboardSnapshot, next: DashboardSnapshot): DashboardSnapshot {
    const hasBranchStats =
      next.leftBranchNodes > 0 ||
      next.rightBranchNodes > 0 ||
      next.levelTreeLeft > 0 ||
      next.levelTreeRight > 0 ||
      numericDisplayValue(next.totalTeamBusiness) > 0;
    const hasDeferredIncome =
      numericDisplayValue(next.spilloverIncome) > 0 ||
      numericDisplayValue(next.crossLineIncome) > 0 ||
      Object.keys(next.directReferralIncomeByUserId ?? {}).length > 0 ||
      (next.networkBonusHistory?.length ?? 0) > 0;

    return {
      ...next,
      packageOneBucketEarnings: next.packageOneBucketEarnings !== "0" ? next.packageOneBucketEarnings : prev.packageOneBucketEarnings,
      currentPackageBucketEarnings: next.currentPackageBucketEarnings !== "0" ? next.currentPackageBucketEarnings : prev.currentPackageBucketEarnings,
      boxEarningsByPackage: Object.keys(next.boxEarningsByPackage ?? {}).length ? next.boxEarningsByPackage : prev.boxEarningsByPackage,
      totalTeamBusiness: hasBranchStats ? next.totalTeamBusiness : prev.totalTeamBusiness,
      leftBranchNodes: hasBranchStats ? next.leftBranchNodes : prev.leftBranchNodes,
      rightBranchNodes: hasBranchStats ? next.rightBranchNodes : prev.rightBranchNodes,
      leftBranchBusiness: hasBranchStats ? next.leftBranchBusiness : prev.leftBranchBusiness,
      rightBranchBusiness: hasBranchStats ? next.rightBranchBusiness : prev.rightBranchBusiness,
      levelTreeLeft: hasBranchStats ? next.levelTreeLeft : prev.levelTreeLeft,
      levelTreeRight: hasBranchStats ? next.levelTreeRight : prev.levelTreeRight,
      spilloverIncome: hasDeferredIncome ? next.spilloverIncome : prev.spilloverIncome,
      crossLineIncome: hasDeferredIncome ? next.crossLineIncome : prev.crossLineIncome,
      directReferralIncomeByUserId:
        Object.keys(next.directReferralIncomeByUserId ?? {}).length > 0
          ? next.directReferralIncomeByUserId
          : prev.directReferralIncomeByUserId,
      networkBonusHistory:
        (next.networkBonusHistory?.length ?? 0) > 0
          ? next.networkBonusHistory
          : prev.networkBonusHistory
    };
  }

  function hasPositiveBoxEarnings(boxResult: {
    packageOneBucketEarnings: string;
    currentPackageBucketEarnings: string;
    boxEarningsByPackage?: Record<number, string>;
  }) {
    const values = [
      boxResult.packageOneBucketEarnings,
      boxResult.currentPackageBucketEarnings,
      ...Object.values(boxResult.boxEarningsByPackage ?? {})
    ];
    return values.some((value) => Number(String(value).replace(/,/g, "")) > 0);
  }

  function applyDeferredBoxEarnings(
    walletAddress: string | null | undefined,
    userId: number,
    boxResult: {
      packageOneBucketEarnings: string;
      currentPackageBucketEarnings: string;
      boxEarningsByPackage: Record<number, string>;
    }
  ) {
    const hasPositive = hasPositiveBoxEarnings(boxResult);
    setSnapshot((prev) => {
      if (!prev || prev.userId !== userId || !prev.isRegistered) {
        return prev;
      }
      if (!hasPositive) {
        return prev;
      }
      const next = {
        ...prev,
        packageOneBucketEarnings: boxResult.packageOneBucketEarnings,
        currentPackageBucketEarnings: boxResult.currentPackageBucketEarnings,
        boxEarningsByPackage: boxResult.boxEarningsByPackage
      };
      metaguildx.updatePersistentDashboardSnapshotBoxEarnings(walletAddress ?? prev.walletAddress, boxResult);
      return next;
    });
  }

  function applyDeferredDashboardAnalytics(userId: number, analytics: Partial<DashboardSnapshot>) {
    setSnapshot((prev) => {
      if (!prev || prev.userId !== userId || !prev.isRegistered) {
        return prev;
      }
      return {
        ...prev,
        ...analytics
      };
    });
  }

  async function refreshSnapshot(walletAddress?: string | null) {
    startLoadingSession("loading user profile", "Loading user profile...");
    setLoadStage("profile");
    const nextSnapshot = await withDashboardTimeout(
      metaguildx.loadDashboardSnapshot(walletAddress ?? snapshot.walletAddress, { forceRefresh: true }),
      "fetchDashboardData"
    );
    setLoadStage("income");
    beginLoadPhase("loading analytics", "Loading analytics...");
    setSnapshot((current) => mergeSnapshotPreservingDeferredAnalytics(current, nextSnapshot));
    beginLoadPhase("loading tree", "Loading tree...");
    beginLoadPhase("loading earnings", "Loading earnings...");
    setLoadStage("complete");
    finishLoadingSession("complete");
    return nextSnapshot;
  }

  async function refreshPostTransactionSnapshot(walletAddress?: string | null) {
    const targetWallet = walletAddress ?? snapshot.walletAddress;
    metaguildx.invalidateDashboardSnapshotCache(targetWallet);
    const quickSnapshot = await withDashboardTimeout(
      metaguildx.loadPostTransactionQuickSnapshot(targetWallet),
      "fetchDashboardData"
    );
    setSnapshot((current) => mergeQuickSnapshot(current, quickSnapshot));
    metaguildx.queueDashboardSnapshotRefresh(quickSnapshot.walletAddress ?? targetWallet);
    return quickSnapshot;
  }

  async function refreshLiveStakeState(walletAddress?: string | null) {
    const targetWallet = walletAddress ?? snapshot.walletAddress;
    if (!targetWallet) {
      setLiveWalletStakeState(null);
      return;
    }

    try {
      const nextLiveState = await metaguildx.loadLiveWalletStakeState(targetWallet);
      setLiveWalletStakeState(nextLiveState);
    } catch {
      // Keep the confirmed action feedback visible; dashboard polling/manual refresh can retry this read.
    }
  }

  async function handleConnectWallet(targetView: DashboardView = "overview") {
    startLoadingSession("connecting wallet", "Connecting wallet. Please approve the wallet connection in MetaMask, then sign the authentication message. No gas fee is charged for the signature.");
    setConnectError(null);

    try {
      const address = await withDashboardTimeout(
        metaguildx.connectWallet(),
        "connect wallet"
      );
      if (!address) {
        throw new Error("Wallet address was not returned");
      }
      saveWalletSession(address);
      replaceAppPath("/dashboard");
      setScreen("dashboard");
        setDashboardView("overview");
        setSelectedTreeUserId(null);
        setActionFeedback(null);
        setRegistrationSummary(null);
        setIsJustConnected(false);
        beginLoadPhase("loading user profile", "Wallet ownership verified. Loading your dashboard now.");

      const nextSnapshot = await withDashboardTimeout(
        metaguildx.loadDashboardSnapshot(address),
        "fetchDashboardData"
      );
      setSnapshot(nextSnapshot);
      setIsJustConnected(!nextSnapshot.isRegistered);
      setDashboardView(nextSnapshot.isRegistered ? "overview" : targetView);
      setSelectedTreeUserId(nextSnapshot.userId ?? nextSnapshot.rootUserId ?? null);
      beginLoadPhase("loading analytics", "Loading analytics...");
      beginLoadPhase("loading tree", "Loading tree...");
      beginLoadPhase("loading earnings", "Loading earnings...");
      setStatus(
        !nextSnapshot.contractReady
          ? nextSnapshot.contractWarning ?? "Contract not ready"
          : nextSnapshot.hasContractConfig
          ? nextSnapshot.isRegistered
            ? `Dashboard ready. User ${nextSnapshot.userId} | Package ${nextSnapshot.packageLevel} | Total earned $${nextSnapshot.totalEarnings}`
            : referralSponsorId
            ? `Wallet connected. Ready to register under Sponsor ID ${referralSponsorId}.`
            : "Wallet connected. This wallet is not registered yet. No USDT was spent. Continue to activation when ready."
          : "Wallet connected, but contract setup is missing. Check deployment and env settings."
      );
      if (referralSponsorId && !nextSnapshot.isRegistered) {
        setActionFeedback({
          title: `👤 Sponsor detected: #${referralSponsorId}`,
          detail: "Wallet connected only. No USDT approval has happened yet. Review the dashboard, then tap Activate Now for Package 1."
        });
      }
      finishLoadingSession("complete");
      return nextSnapshot;
    } catch (error) {
      clearWalletSession();
      setIsJustConnected(false);
      replaceAppPath("/");
      setScreen("landing");
      const message = getFriendlyErrorMessage(error);
      markLoadFailure(message);
      setConnectError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoading(true);
    setStatus("Disconnecting wallet...");
    setActionFeedback(null);
    setRegistrationSummary(null);

    try {
      await metaguildx.disconnectWallet();
      clearWalletSession();
      setSnapshot((current) => ({
        ...fallbackSnapshot,
        packagePrices: current.packagePrices,
        boxPrices: current.boxPrices,
        rootUserId: current.rootUserId,
        treePreview: current.treePreview,
        featuredUsers: current.featuredUsers,
        activityFeed: current.activityFeed,
        cashbackPoolBalance: current.cashbackPoolBalance,
        stakingRewardPool: current.stakingRewardPool,
        totalStaked: current.totalStaked,
        totalTokenDistributed: current.totalTokenDistributed,
        currentBoxId: current.currentBoxId,
        currentBoxPrice: current.currentBoxPrice,
        currentBoxDistributed: current.currentBoxDistributed,
        currentBoxCap: current.currentBoxCap,
        currentBoxRemaining: current.currentBoxRemaining,
        hasContractConfig: current.hasContractConfig,
        contractReady: current.contractReady,
        contractWarning: current.contractWarning
      }));
      replaceAppPath("/");
      setScreen("landing");
      setDashboardView("overview");
      setIsJustConnected(false);
      setSelectedTreeUserId(null);
      setSelectedTreeDetails(null);
      if (referralSponsorId) {
        setRegisterForm({ sponsorId: String(referralSponsorId) });
        setActionFeedback({
          title: `Logged out. Sponsor ID ${referralSponsorId} is still selected.`,
          detail: "Connect another wallet to continue registration under this sponsor."
        });
      }
      setStatus(referralSponsorId ? "Wallet disconnected. Connect a wallet to continue registration." : "Wallet disconnected successfully.");
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBeginRegistrationFlow() {
    if (!snapshot.walletAddress) {
      if (!canStartSignUp) {
        setStatus("Please confirm the terms and country checkboxes before signing up.");
        return;
      }

      setSelectedWalletOption(null);
      setShowWalletSelection(true);
      setStatus("Select a wallet to continue.");
      return;
    }

    if (snapshot.isRegistered) {
      setDashboardView("overview");
      setStatus(`Dashboard ready. User ${snapshot.userId} | Package ${snapshot.packageLevel} | Total earned $${snapshot.totalEarnings}`);
      return;
    }

    replaceAppPath("/dashboard");
    setScreen("dashboard");
    setDashboardView("overview");
    setIsJustConnected(true);
    setStatus("Wallet connected. No USDT approval has happened yet. Review your dashboard and tap Activate Now to continue.");
    setActionFeedback({
      title: "Activation pending",
      detail: "Package 1 is ready. Use Activate Now to open package selection and start USDT approval."
    });
  }

  async function handleSelectWalletOption(option: "metamask" | "walletconnect") {
    setSelectedWalletOption(option);

    if (option === "walletconnect") {
      setStatus("WalletConnect UI is listed, but MetaMask is the active registration path right now.");
      setActionFeedback({
        title: "MetaMask required",
        detail: "Please choose MetaMask to continue with the current registration flow."
      });
      return;
    }

    setShowWalletSelection(false);
    const connectedSnapshot = await handleConnectWallet("overview");
    if (!connectedSnapshot) {
      return;
    }

    if (!connectedSnapshot.isRegistered) {
      setIsJustConnected(true);
      setActionFeedback({
        title: "Wallet connected",
        detail: "Your dashboard is open in Not active mode. Tap Activate to continue with Package 1."
      });
    }
  }

  async function handleActivate() {
    setShowActivationConfirm(false);
    await handleRegisterUser();
  }

  async function runWalletAction<T>(
    action: () => Promise<T>,
    pendingLabel: string,
    successLabel: string,
    onSuccess?: (nextSnapshot: DashboardSnapshot, actionResult: T) => { title: string; detail: string } | null
  ) {
    setIsLoading(true);
    setStatus(pendingLabel);
    setActionFeedback(null);

    try {
      const actionResult = await action();
      const nextSnapshot = await refreshPostTransactionSnapshot();
      await refreshLiveStakeState(nextSnapshot.walletAddress);
      setStatus(successLabel);
      setActionFeedback(onSuccess ? onSuccess(nextSnapshot, actionResult) : null);
  } catch (error) {
    const message = getFriendlyErrorMessage(error);
    setStatus(message);
    setActionFeedback({
      title: "Action failed",
      detail: message
    });
  } finally {
      setIsLoading(false);
    }
  }

  async function handleRetryDashboardLoad() {
    setConnectError(null);
    setActionFeedback(null);
    try {
      await refreshSnapshot(snapshot.walletAddress);
    } catch (error) {
      markLoadFailure(getFriendlyErrorMessage(error));
    }
  }

  async function handleCopyReferralLink() {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      setReferralCopyStatus("Copied!");
      window.setTimeout(() => {
        setReferralCopyStatus((current) => (current === "Copied!" ? "" : current));
      }, 2000);
    } catch {
      setReferralCopyStatus("Copy failed");
    }
  }

  const activeTreePreview = treeMode === "level" ? levelTreePreview : treeMode === "personal" ? personalTreePreview : snapshot.treePreview;
  const rootNode = activeTreePreview.find((node) => node.parentId === 0) ?? activeTreePreview[0] ?? null;
  const selectedTreeNode =
    activeTreePreview.find((node) => node.userId === selectedTreeUserId) ??
    rootNode ??
    null;
  const selectedFeaturedUser = selectedTreeNode
    ? snapshot.featuredUsers.find((user) => user.userId === selectedTreeNode.userId) ?? null
    : null;
  const selectedTreeParent = selectedTreeNode
    ? activeTreePreview.find((node) => node.userId === selectedTreeNode.parentId) ?? null
    : null;
  const treeNodeMap = new Map(activeTreePreview.map((node) => [node.userId, node] as const));
  const selectedTreeChildren = selectedTreeNode
    ? ([
        selectedTreeNode.leftChildId
          ? {
              side: "Left",
              node: treeNodeMap.get(selectedTreeNode.leftChildId) ?? null
            }
          : null,
        selectedTreeNode.rightChildId
          ? {
              side: "Right",
              node: treeNodeMap.get(selectedTreeNode.rightChildId) ?? null
            }
          : null
      ].filter(
        (
          child
        ): child is {
          side: "Left" | "Right";
          node: (typeof activeTreePreview)[number];
        } => child !== null && child.node !== null
      ))
    : [];
  const selectedTreePath = (() => {
    if (!selectedTreeNode) {
      return [] as Array<number>;
    }

    const nodeMap = new Map(snapshot.treePreview.map((node) => [node.userId, node] as const));
    const path: number[] = [];
    let cursor: typeof selectedTreeNode | null = selectedTreeNode;

    while (cursor) {
      path.unshift(cursor.userId);
      cursor = cursor.parentId ? nodeMap.get(cursor.parentId) ?? null : null;
    }

    return path;
  })();

  function collectBranchNodes(startUserId: number) {
    const collected: Array<(typeof activeTreePreview)[number]> = [];
    const queue: number[] = startUserId > 0 ? [startUserId] : [];

    while (queue.length > 0) {
      const currentUserId = queue.shift()!;
      const node = treeNodeMap.get(currentUserId);
      if (!node) {
        continue;
      }

      collected.push(node);
      if (node.leftChildId) {
        queue.push(node.leftChildId);
      }
      if (node.rightChildId) {
        queue.push(node.rightChildId);
      }
    }

    return collected;
  }

  const leftBranchNodes = selectedTreeNode ? collectBranchNodes(selectedTreeNode.leftChildId) : [];
  const rightBranchNodes = selectedTreeNode ? collectBranchNodes(selectedTreeNode.rightChildId) : [];
  const directReferralNodes = snapshot.directReferralIds
    .map((userId) => snapshot.treePreview.find((node) => node.userId === userId) ?? null)
    .filter((node): node is NonNullable<typeof node> => node !== null);
  const incomeHistory = snapshot.activityFeed.filter((item) =>
    ["Income", "Claim", "Compound", "Upgrade", "Staking"].includes(item.kind)
  );
  const userActionHistory = snapshot.activityFeed.filter((item) => {
    if (!snapshot.userId && !snapshot.walletAddress) {
      return false;
    }

    const userNeedle = snapshot.userId ? `user ${snapshot.userId}` : "";
    const walletNeedle = snapshot.walletAddress ? `${snapshot.walletAddress.slice(0, 6)}...${snapshot.walletAddress.slice(-4)}` : "";
    const haystack = `${item.primary} ${item.secondary}`.toLowerCase();

    return (
      (userNeedle && haystack.includes(userNeedle.toLowerCase())) ||
      (walletNeedle && haystack.includes(walletNeedle.toLowerCase()))
    );
  });
  const spilloverHistoryRows = snapshot.spilloverHistory.slice(0, 5);
  const networkBonusHistoryRows = snapshot.networkBonusHistory.slice(0, 5);
  function encodeUserId(id: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    let n = id + 100000;
    while (n > 0) {
      result = chars[n % 62] + result;
      n = Math.floor(n / 62);
    }
    return result;
  }
  const referralLink =
    snapshot.userId && typeof window !== "undefined" ? `${window.location.origin}/?ref=${encodeUserId(snapshot.userId)}` : null;
  const userDisplayCode = snapshot.userId ? encodeUserId(snapshot.userId) : null;
  const compactDisplayAddress = (value?: string | null) => {
    if (!value || value.length < 10) {
      return value ?? "Not configured";
    }
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  };
  const adminUserRows = snapshot.treePreview.map((node) => ({
    userId: node.userId,
    wallet: compactDisplayAddress(node.account),
    packageLevel: node.packageLevel,
    joinedLabel:
      snapshot.activityFeed.find((item) => item.kind === "Registration" && `${item.primary} ${item.secondary}`.toLowerCase().includes(`user ${node.userId}`))
        ?.timestampLabel ?? "Live",
    totalEarnings: snapshot.featuredUsers.find((user) => user.userId === node.userId)?.totalEarnings ?? node.totalEarnings
  }));
  const isDebugMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const referredSponsorPreview =
    referralSponsorId !== null
      ? snapshot.treePreview.find((node) => node.userId === referralSponsorId) ??
        snapshot.featuredUsers.find((user) => user.userId === referralSponsorId) ??
        null
      : null;
  const sponsorRegistrationLabel =
    referralSponsorId !== null
      ? snapshot.activityFeed.find((item) => {
          const haystack = `${item.primary} ${item.secondary}`.toLowerCase();
          return item.kind === "Registration" && haystack.includes(`user ${referralSponsorId}`);
        })?.timestampLabel ?? "Live on-chain"
      : "Live on-chain";
  const sponsorPartnerCount = referralSponsorProfile?.directReferrals ?? referredSponsorPreview?.directReferrals ?? 0;
  const LAUNCH_DATE = new Date("2026-06-26T00:00:00+05:30");
  const isLaunched = new Date() >= LAUNCH_DATE;
  const hasReferral = referralSponsorId !== null && referralSponsorId > 0;
  const canStartSignUp = (isLaunched || hasReferral) && registrationConsent.terms && registrationConsent.restrictedCountry;
  const shouldShowActivationPrompt = !isAdminRoute && Boolean(snapshot.walletAddress) && !snapshot.isRegistered && (isJustConnected || dashboardView === "overview");
  const nextUpgradeLevel = snapshot.packageLevel && snapshot.packageLevel < 10 ? snapshot.packageLevel + 1 : null;

  function splitDisplayAmount(value: string) {
    const normalized = value.replace(/,/g, "");
    const asNumber = Number(normalized || "0");
    const fixed = Number.isFinite(asNumber) ? asNumber.toFixed(2) : "0.00";
    const [integer, decimal] = fixed.split(".");

    return {
      integer,
      decimal: `.${decimal}`
    };
  }

  function parseDisplayNumber(value: string) {
    const numericValue = Number(value.replace(/,/g, "").trim() || "0");
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  function formatDashboardDate(timestampSeconds: number | null) {
    if (!timestampSeconds) {
      return "Pending";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(new Date(timestampSeconds * 1000));
  }

  function renderStartupDiagnosticsPanel() {
    return (
      <div className="info-card" style={{ marginTop: 16, textAlign: "left", maxWidth: 680 }}>
        <strong>Startup Diagnostics</strong>
        <ul className="metric-list" style={{ marginTop: 12 }}>
          <li>Phase: {loadPhase}</li>
          <li>Elapsed: {loadElapsedSeconds}s</li>
          <li>Deploy block: {startupDiagnostics.deployBlock}</li>
          <li>Current block: {startupDiagnostics.currentBlock ?? "Loading..."}</li>
          <li>RPC URL: {startupDiagnostics.rpcUrl || "Not configured"}</li>
          <li>Core address: {startupDiagnostics.coreAddress || "Not configured"}</li>
          <li>Scan range: {startupDiagnostics.scanRange}</li>
          <li>Wallet connected: {startupDiagnostics.walletConnected ? "Yes" : "No"}</li>
          <li>Registered user id: {startupDiagnostics.registeredUserId ?? "Not registered"}</li>
        </ul>
      </div>
    );
  }

  function extractActivityAmount(activitySecondary: string) {
    const match = activitySecondary.match(/amount\s+(\d+)/i);
    if (!match) {
      return null;
    }

    return (Number(match[1]) / 10).toFixed(1);
  }

  function splitTokenAmount(value: string) {
    const trimmed = value.trim();
    const numericMatch = trimmed.match(/^(\$?[0-9]+)(\.[0-9]+)?(?:\s.*)?$/);

    if (!numericMatch) {
      return {
        integer: trimmed,
        decimal: ""
      };
    }

    return {
      integer: numericMatch[1],
      decimal: numericMatch[2] ?? ""
    };
  }

  function buildTreeLevels() {
    if (!rootNode) {
      return [];
    }

    const nodeMap = new Map(activeTreePreview.map((node) => [node.userId, node] as const));
    const levels: Array<Array<typeof activeTreePreview[number] | null>> = [];
    let currentLevel: Array<typeof activeTreePreview[number] | null> = [rootNode];

    for (let depth = 0; depth < 4 && currentLevel.some(Boolean); depth += 1) {
      levels.push(currentLevel);
      const nextLevel: Array<typeof snapshot.treePreview[number] | null> = [];

      currentLevel.forEach((node) => {
        if (!node) {
          nextLevel.push(null, null);
          return;
        }

        nextLevel.push(nodeMap.get(node.leftChildId) ?? null);
        nextLevel.push(nodeMap.get(node.rightChildId) ?? null);
      });

      currentLevel = nextLevel;
    }

    return levels;
  }

  const treeLevels = buildTreeLevels();
  const walletTokenRows = snapshot.connectedWalletAssets.length > 0
    ? snapshot.connectedWalletAssets
      .filter((asset) => asset.name.toUpperCase().includes("USDT"))
      .map((asset) => ({
        ...asset,
        usdValue: asset.value
      }))
    : [
        {
          id: "settlement",
          name: snapshot.settlementAssetLabel,
          subtitle: "Connected wallet asset",
          amount: snapshot.externalWalletBalance,
          usdValue: `Value ${snapshot.connectedWalletValue}`,
          tone: "wallet-token-blue",
          logo: null
        }
      ];
  const displayedTotalMgxAllocated = snapshot.mgxAllocated;
  const displayedMgxAllocated = isStakePending.current
    ? "0"
    : liveWalletStakeState?.mgxAllocated ?? snapshot.mgxAllocated;
  const stakeableMgxAllocated = displayedMgxAllocated;
  const displayedPendingStakingReward =
    snapshot.walletAddress
      ? liveWalletStakeState?.pendingStakingReward ?? snapshot.pendingStakingReward
      : snapshot.pendingStakingReward;
  const displayedPersonalStaked =
    parseDisplayNumber(snapshot.personalStaked) > 0 || !liveWalletStakeState
      ? snapshot.personalStaked
      : liveWalletStakeState.personalStaked;
  const displayedStakeLockDurationLabel =
    (snapshot.stakeLockDurationLabel && snapshot.stakeLockDurationLabel !== "No active stake") || !liveWalletStakeState
      ? snapshot.stakeLockDurationLabel
      : liveWalletStakeState.stakeLockDurationLabel;
  const displayedStakeAutoCompound =
    snapshot.stakeAutoCompound || !liveWalletStakeState ? snapshot.stakeAutoCompound : liveWalletStakeState.stakeAutoCompound;
  const displayedStakePositions =
    snapshot.stakePositions.length > 0 || !liveWalletStakeState ? snapshot.stakePositions : liveWalletStakeState.stakePositions;
  const displayedTotalStaked =
    parseDisplayNumber(snapshot.totalStaked) > 0 || !liveWalletStakeState ? snapshot.totalStaked : liveWalletStakeState.totalStaked;
  const escrowBalance =
    parseDisplayNumber(snapshot.internalWalletBalance) > 0 || !liveWalletStakeState
      ? snapshot.internalWalletBalance
      : liveWalletStakeState.escrowBalance;
  const walletBalanceRows = [
    {
      id: "wallet-asset",
      name: "MGX",
      subtitle: displayedMgxAllocated !== "0" ? "Available MGX allocation" : "No MGX allocation available",
      amount: displayedMgxAllocated,
      amountSuffix: "MGX",
      usdValue: displayedPendingStakingReward !== "0" ? `${displayedPendingStakingReward} MGX pending reward` : "Daily staking reward will appear here",
      tone: "wallet-token-gold",
      canWithdraw: displayedMgxAllocated !== "0"
    },
    {
      id: "wallet-escrow",
      name: "Escrow",
      subtitle: snapshot.surrenderStatus,
      amount: `$${escrowBalance}`,
      usdValue: snapshot.pendingCashback !== "0" ? "Frozen values remain contract-managed until released" : `$${snapshot.cashbackIncome} earned so far`,
      tone: "wallet-token-slate",
      canWithdraw: false
    }
  ];
  const walletTokenDisplayRows = walletTokenRows.map((token) => ({
    ...token,
    amountDisplay: splitTokenAmount(token.amount)
  }));
  const totalWalletValue = (
      parseDisplayNumber(displayedMgxAllocated) +
      parseDisplayNumber(escrowBalance) +
      parseDisplayNumber(snapshot.withdrawableSettlementBalance) +
      parseDisplayNumber(snapshot.connectedWalletValue)
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const shortWalletAddress = snapshot.walletAddress
    ? `${snapshot.walletAddress.slice(0, 6)}...${snapshot.walletAddress.slice(-4)}`
    : "Wallet pending";
  const usdtWalletRow =
    walletTokenDisplayRows.find(
      (token) => token.name.toUpperCase().includes("USDT") || token.id === "settlement"
    ) ??
    walletTokenDisplayRows[0] ??
    null;
  const nativeWalletRow =
    walletTokenDisplayRows.find(
      (token) => token.name.toUpperCase().includes("BNB") || token.name.toUpperCase().includes("NATIVE")
    ) ??
    null;
  const mgxWalletRow =
    walletTokenDisplayRows.find(
      (token) => token.name.toUpperCase().includes("MGX")
    ) ??
    null;
  const hasEscrowBalance = parseDisplayNumber(escrowBalance) > 0;
  const availableStakeAmount = parseDisplayNumber(stakeableMgxAllocated);
  const requestedStakeAmount = Number(stakeForm.amount || "0");
  const canSubmitStake = requestedStakeAmount > 0 && requestedStakeAmount <= availableStakeAmount;
  const hasWithdrawableStake = parseDisplayNumber(displayedPersonalStaked) > 0;
  const canUseIndexedStakingActions = displayedStakePositions.length <= 1;
  const primaryStakePosition = displayedStakePositions[0] ?? null;
  const pendingStakingRewardValue = parseDisplayNumber(displayedPendingStakingReward);
  const rewardWindowReady = (() => {
    const rewardDebt = primaryStakePosition?.rewardDebt ?? 0n;
    if (!rewardDebt) return false;
    const now = Math.floor(Date.now() / 1000);
    const elapsedDays = Math.floor((now - Number(rewardDebt)) / 28800);
    return elapsedDays >= 1 && pendingStakingRewardValue > 0;
  })();
  const hasClaimableReward =
    pendingStakingRewardValue > 0
    && rewardWindowReady;
  const hasStakingPosition = hasWithdrawableStake || hasClaimableReward;
  const isConnectedWalletLoading = isLoading && Boolean(snapshot.walletAddress);
  const isConnectedWalletHistoryLoading = isConnectedWalletLoading || isLoadingMoreHistory;
  const walletBalanceDisplayRows = walletBalanceRows.map((token) => ({
    ...token,
    amountDisplay: splitTokenAmount(token.amount)
  }));
    const directIncome = `$${snapshot.directIncome}`;
    const levelIncome = `$${snapshot.levelIncome}`;
  const cashback = `$${snapshot.cashbackIncome}`;
    const stakingReward = asMgx(displayedPendingStakingReward);
    const hasError = Boolean(connectError || snapshot.connectedWalletAssetsError || snapshot.connectedWalletHistoryError);
    const safeContractWarning =
      snapshot.contractWarning &&
      !/call_exception|missing revert data|execution reverted|stack/i.test(snapshot.contractWarning)
        ? snapshot.contractWarning
        : null;
    const connectedWalletHistoryRows: ConnectedWalletHistoryRow[] = snapshot.connectedWalletHistory;
  const walletQuickActions = [
    { id: "move", label: "Transfer", symbol: "TR" },
    { id: "swap", label: "MGX-DEX", symbol: "DX" },
    { id: "stake", label: "Staking", symbol: "ST", comingSoon: true },
    { id: "myStake", label: "My Stake", symbol: "MS", comingSoon: true },
  ];

  const transferFromLabel = "MGX Allocated (Free)";
  const transferToLabel = "MetaMask wallet";
  const transferFromBalance = displayedMgxAllocated;
  const totalTeamMembers =
  snapshot.leftBranchNodes + snapshot.rightBranchNodes > 0
    ? snapshot.leftBranchNodes + snapshot.rightBranchNodes
    : snapshot.userId === 1 && totalUsers > 0
    ? Math.max(totalUsers - 1, 0)
    : 0;
  const totalTeamLabel = `${totalTeamMembers} ${totalTeamMembers === 1 ? "member" : "members"}`;
  const currentPackagePrice =
    snapshot.packageLevel && snapshot.packagePrices[snapshot.packageLevel - 1]
      ? snapshot.packagePrices[snapshot.packageLevel - 1]
      : null;
  const nextUpgradeNeed =
    nextUpgradeLevel && snapshot.packagePrices[nextUpgradeLevel - 1]
      ? snapshot.packagePrices[nextUpgradeLevel - 1]
      : 0;
  const upgradeProgressPercent = nextUpgradeNeed > 0 ? Math.min((parseDisplayNumber(escrowBalance) / nextUpgradeNeed) * 100, 100) : 0;
  const currentBucketEarnings = parseDisplayNumber(snapshot.currentPackageBucketEarnings);
  const packageOneBucketEarnings = parseDisplayNumber(snapshot.packageOneBucketEarnings);
  const currentPackageEscrow = parseDisplayNumber(snapshot.currentPackageEscrow);
  const pkg1UnitsToRebirth = Math.max(((snapshot.packagePrices?.[0] ?? 10) * 5) - packageOneBucketEarnings, 0);
  const boxEarningsDisplay = (() => {
    const result: Record<number, string> = { ...(snapshot.boxEarningsByPackage ?? {}) };

    if (!result[1] && packageOneBucketEarnings > 0) {
      result[1] = packageOneBucketEarnings.toFixed(2);
    }

    const currentPackageLevel = snapshot.packageLevel ?? 0;
    if (currentPackageLevel > 1 && !result[currentPackageLevel] && currentBucketEarnings > 0) {
      result[currentPackageLevel] = currentBucketEarnings.toFixed(2);
    }

    return result;
  })();
  const memberSinceLabel = formatDashboardDate(snapshot.joinedAt);
  const sponsorLabel = snapshot.sponsorId ? `User #${encodeUserId(snapshot.sponsorId)}` : "Root";
  const currentUserTreeNode = snapshot.userId ? snapshot.treePreview.find((node) => node.userId === snapshot.userId) ?? null : null;
  const allNodes = [...snapshot.treePreview, ...snapshot.featuredUsers];
  const directLeftNode =
    currentUserTreeNode && currentUserTreeNode.leftChildId
      ? (allNodes.find((node) => node.userId === currentUserTreeNode.leftChildId) ??
        { userId: currentUserTreeNode.leftChildId, account: "", packageLevel: 0, depth: 0, parentId: 0, leftChildId: 0, rightChildId: 0, directReferrals: 0 })
      : null;
  const directRightNode =
    currentUserTreeNode && currentUserTreeNode.rightChildId
      ? (allNodes.find((node) => node.userId === currentUserTreeNode.rightChildId) ??
        { userId: currentUserTreeNode.rightChildId, account: "", packageLevel: 0, depth: 0, parentId: 0, leftChildId: 0, rightChildId: 0, directReferrals: 0 })
      : null;
  const totalReceivedValue =
    parseDisplayNumber(snapshot.directIncome) +
    parseDisplayNumber(snapshot.levelIncome);

  const totalEarnedDisplay = totalReceivedValue.toFixed(2);
  const directIncomeDisplay = parseDisplayNumber(snapshot.directIncome).toFixed(2);
  const levelIncomeDisplay = parseDisplayNumber(snapshot.levelIncome).toFixed(2);
  const spilloverIncomeDisplay = parseDisplayNumber(snapshot.spilloverIncome).toFixed(2);
  const networkBonusDisplay = parseDisplayNumber(snapshot.crossLineIncome).toFixed(2);
  const totalReceivedDisplay = totalReceivedValue.toFixed(2);
  const walletBalanceDisplay = parseDisplayNumber(snapshot.withdrawableSettlementBalance).toFixed(2);
  const platformWalletBalanceDisplay = parseDisplayNumber(snapshot.withdrawablePlatformBalance).toFixed(2);
  const outerUsdtBalanceDisplay = parseDisplayNumber(usdtWalletRow?.amount ?? "0").toFixed(2);
  const outerUsdtBalanceValue = parseDisplayNumber(usdtWalletRow?.amount ?? "0");
  const opBnbGasDisplay = parseDisplayNumber(nativeWalletRow?.amount ?? snapshot.externalWalletBalance).toFixed(4);
  const mgxAvailableDisplay = isStakePending.current
    ? "0.00"
    : parseDisplayNumber(snapshot.mgxAllocated ?? "0").toFixed(2);
  const totalMgxAllocatedDisplay = parseDisplayNumber(displayedMgxAllocated).toFixed(2);
  const connectedWalletTotalDisplay = outerUsdtBalanceValue.toFixed(2);
  const frozenEscrowDisplay = Math.max(parseDisplayNumber(escrowBalance) - parseDisplayNumber(snapshot.rebirthEscrowBalance ?? "0"), 0).toFixed(2);
  const rebirthEscrowDisplay = parseDisplayNumber(snapshot.rebirthEscrowBalance ?? "0").toFixed(2);
  const currentPackageEscrowDisplay = currentPackageEscrow.toFixed(2);
  const teamBusinessDisplay = parseDisplayNumber(snapshot.totalTeamBusiness).toFixed(2);
  const currentPackageBucketDisplay = currentBucketEarnings.toFixed(2);
  const currentPackagePriceDisplay = (currentPackagePrice ?? 0).toFixed(2);
  const upgradeNeedDisplay = nextUpgradeNeed.toFixed(2);
  const upgradeRemainingDisplay = Math.max(nextUpgradeNeed - parseDisplayNumber(escrowBalance), 0).toFixed(2);
  const userPackageLevel = snapshot.packageLevel ?? 0;
  const upgradeMilestones = [
    { fromPkg: 1, toPkg: 2, cost: 20 },
    { fromPkg: 2, toPkg: 3, cost: 40 },
    { fromPkg: 3, toPkg: 4, cost: 80 },
    { fromPkg: 4, toPkg: 5, cost: 160 },
    { fromPkg: 5, toPkg: 6, cost: 320 },
    { fromPkg: 6, toPkg: 7, cost: 640 },
    { fromPkg: 7, toPkg: 8, cost: 1280 },
    { fromPkg: 8, toPkg: 9, cost: 2560 },
    { fromPkg: 9, toPkg: 10, cost: 5120 },
    { fromPkg: 10, toPkg: "MAX" as const, cost: 0 }
  ];
  const canUpgradeCurrentPackage =
    !snapshot.isRebirthUser &&
    !!snapshot.walletAddress &&
    !!snapshot.userId &&
    !!nextUpgradeLevel &&
    outerUsdtBalanceValue >= Math.max(nextUpgradeNeed - parseDisplayNumber(escrowBalance), 0);
  const stakingRewardPoolValue = parseDisplayNumber(snapshot.stakingRewardPool);
  const stakingTotalStakedValue = parseDisplayNumber(displayedTotalStaked);
  const stakingUserAmountValue = parseDisplayNumber(displayedPersonalStaked);
  const primaryStakeLockLabel = primaryStakePosition?.lockDurationLabel ?? displayedStakeLockDurationLabel ?? "";
  const stakingLockDays =
    /1095|3\s*year/i.test(primaryStakeLockLabel)
      ? 1095
      : /730|2\s*year/i.test(primaryStakeLockLabel)
        ? 730
        : /365|1\s*year/i.test(primaryStakeLockLabel)
        ? 365
        : 0;
  const hasActiveStake = stakingUserAmountValue > 0;
  const getCountdown = (rewardDebt?: bigint | null) => {
    if (!rewardDebt || rewardDebt <= 0n) {
      return "Ready to claim";
    }

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - Number(rewardDebt);
    const elapsedCycles = Math.floor(elapsed / 28800);
    const nextCycleBoundary = Number(rewardDebt) + ((elapsedCycles + 1) * 28800);
    const nextCycleRemaining = nextCycleBoundary - now;

    const h = Math.floor(nextCycleRemaining / 3600);
    const m = Math.floor((nextCycleRemaining % 3600) / 60);
    const s = nextCycleRemaining % 60;
    if (elapsedCycles >= 1) {
      return `Ready to claim · Next cycle in ${h}h ${m}m ${s}s`;
    }
    return `Next reward in ${h}h ${m}m ${s}s`;
  };
  const StatCard = ({
    title,
    value,
    icon,
    accent = "cyan",
    badge
  }: {
    title: string;
    value: string;
    icon: string;
    accent?: "cyan" | "gold" | "success";
    badge?: string;
  }) => (
    <div className={`staking-hero-card staking-hero-card-${accent}`}>
      <div className="staking-hero-top">
        <span className="staking-hero-icon" aria-hidden="true">{icon}</span>
        {badge ? <span className="staking-hero-badge">{badge}</span> : null}
      </div>
      <div className="staking-hero-label">{title}</div>
      <div className="staking-hero-value">{value}</div>
    </div>
  );
  const StatRow = ({ label, value }: { label: string; value: string }) => (
    <div className="staking-detail-card">
      <span className="staking-detail-label">{label}</span>
      <span className="staking-detail-value">{value}</span>
    </div>
  );
  const StakingSummary = () => (
    <div className="staking-summary-shell">
      <div className="staking-summary-hero-grid">
        <StatCard title="Staked Amount" value={`${displayedPersonalStaked} MGX`} icon="🔙" accent="cyan" />
        <StatCard title="Pending Reward" value={`${displayedPendingStakingReward} MGX`} icon="⭐" accent="gold" />
        <StatCard
          title="Daily Earnings"
          value={stakingDataLoading ? "Loading..." : `${calcDailyEarnings().toFixed(4)} MGX`}
          icon="📆"
          accent="success"
        />
        <StatCard title="Your Share" value={`${stakingSharePercent}%`} icon="🥧" accent="cyan" badge="LIVE" />
      </div>

      <div className="staking-countdown-card">
        <div>
          <span className="staking-countdown-label">Next Reward Window</span>
          <strong className="staking-countdown-value">
            {stakingDataLoading ? "Loading..." : hasActiveStake ? stakingRewardCountdown : "--:--:--"}
          </strong>
        </div>
        <span className="staking-countdown-glow" aria-hidden="true" />
      </div>

      <div className="staking-detail-grid">
        <StatRow label="Your Share" value={`${stakingSharePercent}%`} />
        <StatRow
          label="Lock Bonus"
          value={
            stakingLockDays >= 1095
              ? "+30%"
              : stakingLockDays >= 730
                ? "+15%"
                : "0%"
          }
        />
        <StatRow
          label="Contract Balance"
          value={`${Number(ethers.formatEther(stakingContractMGXBalance)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })} MGX`}
        />
        <StatRow label="Total Staked" value={`${stakingTotalStakedValue.toFixed(2)} MGX`} />
      </div>
    </div>
  );
  const calcDailyEarnings = () => {
    const userStake = stakingUserAmountValue;
    const totalStaked = stakingTotalStakedValue;
    const contractBal = Number(
      stakingContractMGXBalance > 0n
        ? ethers.formatEther(stakingContractMGXBalance)
        : "0"
    );

    if (totalStaked === 0 || userStake === 0) return 0;
    if (contractBal === 0) return 0;

    const theoreticalDaily = totalStaked * 0.003;
    const safeBal = contractBal * 0.9;
    const maxDaily = contractBal / 30;
    const capped = Math.min(safeBal, maxDaily);
    const dailyPool = Math.min(theoreticalDaily, capped);

    if (userStake === 0) return 0;
    const userShare = userStake / totalStaked;
    let userDaily = dailyPool * userShare;

    if (stakingLockDays >= 1095) userDaily *= 1.30;
    else if (stakingLockDays >= 730) userDaily *= 1.15;

    return userDaily;
  };
  useEffect(() => {
    if (!hasActiveStake) {
      setStakingRewardCountdown("--:--:--");
      return;
    }

    setStakingRewardCountdown(getCountdown(primaryStakePosition?.rewardDebt));

    const interval = window.setInterval(() => {
      setStakingRewardCountdown(getCountdown(primaryStakePosition?.rewardDebt));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hasActiveStake, primaryStakePosition?.rewardDebt]);
  const stakingSharePercent =
    stakingTotalStakedValue > 0
      ? ((stakingUserAmountValue / stakingTotalStakedValue) * 100).toFixed(2)
      : "0.00";
  const hasSpilloverIncome = parseDisplayNumber(snapshot.spilloverIncome) > 0;
  const mgxAllocationRows = [
    {
      id: snapshot.userActiveBoxId && snapshot.userActiveBoxId > 0 ? snapshot.userActiveBoxId : 1,
      amount: totalMgxAllocatedDisplay,
      usdApprox: totalMgxAllocatedDisplay
    }
  ];
  const walletScreenStyles = `
    .wallet-screen {
      width: 100%;
      padding: 0 16px 24px;
      box-sizing: border-box;
    }
    .wallet-screen-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding: 12px 0;
      flex-wrap: wrap;
    }
    .wallet-screen-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .wallet-total-balance {
      text-align: center;
      padding: 24px 0;
    }
    .balance-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }
    .balance-amount-large {
      font-size: clamp(2rem, 5vw, 2.75rem);
      font-weight: 700;
      color: var(--text-primary);
      margin-top: 8px;
    }
    .balance-usd {
      color: var(--text-secondary);
      margin-top: 6px;
    }
    .inner-balance-section {
      background: rgba(139, 90, 43, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .inner-balance-header {
      background: rgba(139, 90, 43, 0.4);
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .balance-row-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .balance-row-item:last-child {
      border-bottom: none;
    }
    .token-icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f0a500, #e07000);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
      position: relative;
    }
    .token-icon-circle.green {
      background: linear-gradient(135deg, #00c853, #009624);
    }
    .token-icon-circle .box-number {
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: #333;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      font-size: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .token-amount-right {
      text-align: right;
      margin-left: auto;
    }
    .token-amount-right.green .amount-main,
    .amount-main.green {
      color: #00c853;
    }
    .wallet-action-btn-full {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      border: none;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      background: #4a7cff;
      color: white;
      margin-top: 12px;
    }
    .wallet-action-btn-full.green {
      background: #00c853;
    }
    .wallet-action-btn-full.blue {
      background: #4a7cff;
    }
    .wallet-action-btn-full:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .wallet-screen-button-stack {
      position: sticky;
      bottom: 16px;
      padding-top: 4px;
      background: linear-gradient(180deg, rgba(8, 12, 18, 0) 0%, rgba(8, 12, 18, 0.92) 28%);
    }
    @media (max-width: 640px) {
      .wallet-screen {
        padding: 0 12px 20px;
      }
      .balance-row-item {
        padding: 12px;
        gap: 12px;
      }
      .token-icon-circle {
        width: 40px;
        height: 40px;
      }
    }
    .rebirth-subdash {
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 16px;
      padding: 24px;
      width: 100%;
    }
    .rebirth-subdash-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .rebirth-back-btn {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }
    .rebirth-back-btn:hover {
      background: rgba(59, 130, 246, 0.2);
    }
    .rebirth-subdash-title {
      font-size: 20px;
      font-weight: 700;
      color: white;
    }
    .rebirth-stats-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .rebirth-stat-card {
      background: rgba(31, 41, 55, 0.8);
      border: 1px solid rgba(75, 85, 99, 0.3);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rebirth-stat-label {
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .rebirth-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: white;
    }
    .text-cyan {
      color: #22d3ee;
    }
    .text-gold {
      color: #fbbf24;
    }
    .rebirth-subdash-tabs {
      display: flex;
      gap: 4px;
      background: rgba(31, 41, 55, 0.5);
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .rebirth-tab {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #9ca3af;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .rebirth-tab.active {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .rebirth-subdash-content {
      min-height: 200px;
    }
    .rebirth-earnings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .rebirth-income-card {
      background: rgba(31, 41, 55, 0.6);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid rgba(75, 85, 99, 0.2);
      gap: 12px;
    }
    .rebirth-income-card span {
      color: #9ca3af;
      font-size: 14px;
    }
    .rebirth-income-card strong {
      font-size: 18px;
      color: white;
    }
    .rebirth-referral-section {
      padding: 16px 0;
    }
    .referral-link-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    @media (max-width: 900px) {
      .rebirth-stats-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 640px) {
      .rebirth-stats-row,
      .rebirth-earnings-grid {
        grid-template-columns: 1fr;
      }
      .rebirth-subdash {
        padding: 16px;
      }
      .referral-link-row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `;
  const allLevelsUnlocked = (snapshot.directReferrals ?? 0) >= 5;
  const referralGoalLabel = allLevelsUnlocked
    ? "All 10 levels are active"
    : `${Math.max(5 - (snapshot.directReferrals ?? 0), 0)} more referrals to unlock all 10`;
  const usdtWalletAmount = usdtWalletRow?.amount ?? "0";
  const recentActivityRows = userActionHistory.slice(0, 10);
  const recentActivityPreview = recentActivityRows.slice(0, 5);
  const userLevelSummaryRows = Array.from({ length: 10 }, (_, index) => {
    const levelNumber = index + 1;
    const isUnlocked = snapshot.unlockedLevelStatus[index] ?? false;
    return { levelNumber, isUnlocked };
  });
  const levelBreakdownByLevel = new Map(levelBreakdown.map((row) => [row.level, row]));
  const visibleLevelBreakdownRows = userLevelSummaryRows.map((row) => {
    const breakdownRow = levelBreakdownByLevel.get(row.levelNumber);
    const actualAmount = breakdownRow ? parseDisplayNumber(breakdownRow.amount) : 0;
    const displayAmount = actualAmount > 0 ? actualAmount : 0;

    return {
      level: row.levelNumber,
      amount: displayAmount.toFixed(2),
      members: breakdownRow?.members ?? 0
    };
  });
  const activeLevelsCount = snapshot.unlockedLevelStatus.filter(Boolean).length;
  const nextUnlockReferralTarget = activeLevelsCount >= 10 ? null : Math.min(5, Math.floor(activeLevelsCount / 2) + 1);
  const userReferralRows = snapshot.directReferralIds.map((userId, index) => {
    const featured = snapshot.featuredUsers.find((entry) => entry.userId === userId);
    const treeNode = snapshot.treePreview.find((entry) => entry.userId === userId);
    return {
      userId,
      displayName: getDisplayName(treeNode?.account, userId),
      packageLevel: featured?.packageLevel ?? treeNode?.packageLevel ?? 1,
      wallet: "account" in (treeNode ?? {}) && treeNode?.account ? `${treeNode.account.slice(0, 6)}...${treeNode.account.slice(-4)}` : "Wallet loading",
      totalEarnings: featured?.totalEarnings ?? "0",
        mgxAllocated: featured?.mgxAllocated ?? "0",
        userActiveBoxId: featured?.userActiveBoxId ?? null,
        joinedLabel: `Member #${encodeUserId(userId)}`,
        income: snapshot.directReferralIncomeByUserId[userId] ?? "0"
      };
    });
  const rebirthRows = snapshot.rebirthIds.map((rebirthId) => {
    const rebirthNode = snapshot.treePreview.find((node) => node.userId === rebirthId) ?? null;
    const rebirthFeature = snapshot.featuredUsers.find((user) => user.userId === rebirthId) ?? null;
    const rebirthIncome = rebirthIncomeByUserId[rebirthId];
    const isSelectedRebirth = selectedRebirthId === rebirthId;
    const directIncomeValue = isSelectedRebirth
      ? rebirthNodeDetails?.directIncome ?? rebirthIncome?.directIncome ?? "0"
      : rebirthIncome?.directIncome ?? "0";
    const levelIncomeValue = isSelectedRebirth
      ? rebirthNodeDetails?.levelIncome ?? rebirthIncome?.levelIncome ?? "0"
      : rebirthIncome?.levelIncome ?? "0";
    const totalEarningsValue = (parseFloat(directIncomeValue || "0") + parseFloat(levelIncomeValue || "0")).toFixed(2);
    return {
      userId: rebirthId,
      rebirthId,
      packageLevel: rebirthNode?.packageLevel ?? rebirthFeature?.packageLevel ?? 1,
      packageLabel: rebirthNode?.packageLevel ? `Pkg ${rebirthNode.packageLevel}` : "Pkg 1",
      wallet: rebirthNode?.account ?? rebirthIncome?.walletAddress ?? snapshot.walletAddress ?? "Same wallet",
      status: "Active",
      directIncome: directIncomeValue,
      levelIncome: levelIncomeValue,
      totalEarnings: totalEarningsValue
    };
  });
  const rebirthStatusLabel = snapshot.rebirthCount > 0 ? "Active" : "Pending";
  const rebirthProgressStep = Math.min(5, Math.max(snapshot.currentBoxId ?? 1, 1));
  const rebirthProgressPercent = (rebirthProgressStep / 5) * 100;
  const rebirthProgressLabel =
    snapshot.rebirthIds.length > 0
      ? "Rebirth triggered \u2705"
      : pkg1UnitsToRebirth <= 0
      ? "Rebirth zone reached!"
      : `Need $${pkg1UnitsToRebirth.toFixed(2)} more to reach rebirth`;
  const selectedRebirthRow = rebirthRows.find((row) => row.userId === selectedRebirthId) ?? null;
  const rebirthPkgLevel = rebirthNodeDetails?.packageLevel ?? selectedRebirthRow?.packageLevel ?? 1;
  const rebirthFrozenAmount = parseDisplayNumber(rebirthNodeDetails?.internalWalletBalance ?? "0");
  const rebirthPkgPrice = snapshot.packagePrices[rebirthPkgLevel - 1] ?? 0;
  const rebirthNeededAmount = rebirthPkgPrice * 5;
  const rebirthEscrowProgress = rebirthNeededAmount > 0 ? (rebirthFrozenAmount / rebirthNeededAmount) * 100 : 0;
  const rebirthXSlotStep = Math.min(5, Math.max((rebirthNodeDetails?.xCount ?? 0) + 1, 1));
  const showDashboardSkeleton = isLoading && loadStage !== "complete";
  const renderSkeletonRows = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <div key={`skeleton-row-${index}`} className="income-row">
        <span className="income-label">
          <span className="block h-4 w-24 animate-pulse rounded-lg bg-gray-700/50" />
        </span>
        <span className="income-amount">
          <span className="block h-4 w-20 animate-pulse rounded-lg bg-gray-700/50" />
        </span>
      </div>
    ));
  function handleWalletQuickAction(actionId: string) {
    if (actionId === "swap") {
      setActionFeedback({
        title: "MGX-DEX coming soon",
        detail: "Swap flow is not live yet in this dashboard."
      });
      return;
    }

    if (actionId === "stake") {
      setDashboardView("wallet");
      setWalletSubView("stake");
      setActionFeedback({
        title: "Stake page opened",
        detail: "Use the stake page to configure duration, auto-compound, and staking actions."
      });
      return;
    }

    if (actionId === "myStake") {
      setDashboardView("wallet");
      setWalletSubView("myStake");
      setActionFeedback({
        title: "My Stake opened",
        detail: "View your personal staked MGX, duration, auto-compound, and pending reward here."
      });
      return;
    }

    setDashboardView("wallet");
    setWalletSubView("main");
    setActionFeedback({
      title: "Wallet opened",
      detail: "Cashback and wallet details are available in the wallet tab."
    });
  }

  async function handleCopyWalletAddress() {
    if (!snapshot.walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(snapshot.walletAddress);
      setActionFeedback({
        title: "Wallet address copied",
        detail: `${snapshot.walletAddress.slice(0, 6)}...${snapshot.walletAddress.slice(-4)} copied to clipboard.`
      });
    } catch {
      setActionFeedback({
        title: "Copy failed",
        detail: "Wallet address could not be copied."
      });
    }
  }

  async function handleRefreshRewards() {
    setIsLoading(true);
    setStatus("Refreshing wallet and staking data...");
    try {
      await refreshSnapshot();
      if (snapshot.walletAddress) {
        const nextLiveState = await metaguildx.loadLiveWalletStakeState(snapshot.walletAddress);
        setLiveWalletStakeState(nextLiveState);
      }
      setStatus("Wallet and staking data refreshed.");
      setActionFeedback({
        title: "Rewards refreshed",
        detail: "Latest allocation, staked balance, and pending reward are now updated."
      });
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshSection(sectionName: string) {
    setIsLoading(true);
    setStatus(`Refreshing ${sectionName.toLowerCase()}...`);
    try {
      await refreshSnapshot();
      if (snapshot.walletAddress) {
        const nextLiveState = await metaguildx.loadLiveWalletStakeState(snapshot.walletAddress);
        setLiveWalletStakeState(nextLiveState);
      }
      setStatus(`${sectionName} updated.`);
    } catch (error) {
      setStatus(getFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function handleShareReferralLink(channel: "whatsapp" | "telegram" | "twitter") {
    if (!referralLink) {
      return;
    }

    const encodedLink = encodeURIComponent(referralLink);
    const encodedText = encodeURIComponent(`Join MetaGuildX ${referralLink}`);
    const targetUrl =
      channel === "whatsapp"
        ? `whatsapp://send?text=${encodedText}`
        : channel === "telegram"
        ? `https://t.me/share/url?url=${encodedLink}`
        : `https://twitter.com/intent/tweet?url=${encodedLink}`;

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  function openTreeForUser(userId: number) {
    setDashboardView("network");
    setTreeMode("personal");
    setSelectedTreeUserId(Number(userId));
    setTreeViewUserId(Number(userId));
  }

  async function handleCopyRebirthReferralLink(walletAddress: string) {
    const referralBase =
      typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname === "/" ? "" : window.location.pathname}` : "";
    const nextLink = `${referralBase}?ref=${encodeURIComponent(walletAddress)}`;

    try {
      await navigator.clipboard.writeText(nextLink);
      setActionFeedback({
        title: "Rebirth referral link copied",
        detail: nextLink
      });
    } catch {
      setActionFeedback({
        title: "Copy failed",
        detail: "Rebirth referral link could not be copied."
      });
    }
  }

  async function handleRegisterUser() {
    setIsLoading(true);
    setActionFeedback(null);
    setRegistrationSummary(null);
    setStatus("Starting registration. Approving USDT first.");
    setRegStep(1);

    try {
      const registrationResult = await metaguildx.registerUser(
        {
          sponsorId: referralSponsorId ?? Number(registerForm.sponsorId),
          packageLevel: 1,
          selectedBox: 1
        },
        (step) => {
          if (step === "approving") {
            setRegStep(1);
            setStatus("Approving USDT in MetaMask...");
            return;
          }
          if (step === "confirming") {
            setRegStep(2);
            setStatus("Confirm the registration in MetaMask.");
            return;
          }
          if (step === "registering") {
            setRegStep(3);
            setStatus("Registering your account on-chain...");
            return;
          }
          setRegStep(4);
          setStatus("Registration complete. Welcome to MetaGuildX.");
        }
      );

      let nextSnapshot = snapshot;

      try {
        nextSnapshot = await refreshPostTransactionSnapshot(snapshot.walletAddress);
        await refreshLiveStakeState(nextSnapshot.walletAddress);
        const registeredUserId = typeof nextSnapshot.userId === "number" ? nextSnapshot.userId : null;
        const distribution =
          registeredUserId !== null
            ? await metaguildx.getRegistrationDistribution(registeredUserId, registrationResult.txHash)
            : undefined;
        setRegistrationSummary(distribution ? { ...registrationResult, distribution } : registrationResult);
        setStatus("Registration complete. Welcome to MetaGuildX. Opening your dashboard now.");
        setActionFeedback({
          title: `Package 1 activated for User ${nextSnapshot.userId ?? "-"}`,
          detail: `Box ${nextSnapshot.currentBoxId} is active at $${nextSnapshot.currentBoxPrice}. Your current allocation is ${nextSnapshot.mgxAllocated} MGX. It is now assigned to ${nextSnapshot.userActiveBoxId ? `Box ${nextSnapshot.userActiveBoxId}` : "the active box"}.`
        });
      } catch (reloadError) {
        console.error("Dashboard reload after registration failed", reloadError);
        setRegistrationSummary(registrationResult);
        setStatus("Registration complete. Your dashboard is still syncing, so some details may appear after a refresh.");
        setActionFeedback({
          title: "Registration complete",
          detail: "Your transaction succeeded, but the dashboard reload did not finish. You can continue to the dashboard and refresh once the new account data appears."
        });
      }

      setIsJustConnected(false);
      replaceAppPath("/dashboard");
      setScreen("dashboard");
      setDashboardView("overview");
      setSelectedTreeUserId(nextSnapshot.userId ?? nextSnapshot.rootUserId ?? null);
      return nextSnapshot;
    } catch (error) {
      setRegStep(0);
      setStatus(getFriendlyErrorMessage(error));
      setActionFeedback(null);
      setRegistrationSummary(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLoadMoreHistory() {
    if (!snapshot.walletAddress || !snapshot.connectedWalletHistoryCursor) {
      return;
    }

    setIsLoadingMoreHistory(true);
    try {
      const nextPage = await metaguildx.loadConnectedWalletHistory(snapshot.walletAddress, snapshot.connectedWalletHistoryCursor);
      setSnapshot((current) => ({
        ...current,
        connectedWalletHistory: [...current.connectedWalletHistory, ...nextPage.history].filter(
          (entry, index, list) => list.findIndex((candidate) => candidate.hash === entry.hash) === index
        ),
        connectedWalletHistoryError: nextPage.error,
        connectedWalletHistoryCursor: nextPage.cursor
      }));
    } catch {
      setSnapshot((current) => ({
        ...current,
        connectedWalletHistoryError: "Failed to load history"
      }));
    } finally {
      setIsLoadingMoreHistory(false);
    }
  }

  function renderLanding() {
    return (
      <>
      {(!disclaimerAccepted || (referralSponsorId !== null && !disclaimerAccepted)) && (
        <div style={{
          position:"fixed",inset:0,zIndex:9999,
          background:"rgba(3,6,16,.97)",backdropFilter:"blur(20px)",
          display:"flex",alignItems:"center",justifyContent:"center",
          padding:"1rem",overflowY:"auto"
        }}>
          <div style={{
            maxWidth:560,width:"100%",
            background:"linear-gradient(145deg,rgba(12,22,48,.98),rgba(8,15,36,.99))",
            border:"1px solid rgba(201,168,76,.25)",borderRadius:20,
            overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,.6)"
          }}>
            {/* Header */}
            <div style={{
              padding:"2rem 2rem 1.5rem",
              background:"linear-gradient(135deg,rgba(201,168,76,.08),rgba(46,111,216,.05))",
              borderBottom:"1px solid rgba(255,255,255,.06)",textAlign:"center"
            }}>
              <img src={logoMark} alt="MGX" style={{
                width:72,height:72,objectFit:"contain",marginBottom:"1rem",
                filter:"drop-shadow(0 0 20px rgba(201,168,76,.5))"
              }}/>
              <div style={{
                fontFamily:"Syne,sans-serif",fontSize:"1.3rem",fontWeight:800,
                letterSpacing:"-.02em",marginBottom:".5rem"
              }}>MetaGuildX Platform</div>
              <div style={{fontSize:".8rem",color:"#7A93C0",lineHeight:1.5}}>
                Please read and accept the following before continuing
              </div>
            </div>

            {/* Content */}
            <div style={{padding:"1.75rem 2rem",maxHeight:"55vh",overflowY:"auto"}}>

              {/* What is MGX */}
              <div style={{marginBottom:"1.5rem"}}>
                <div style={{
                  fontFamily:"Syne,sans-serif",fontSize:".8rem",fontWeight:700,
                  color:"#C9A84C",textTransform:"uppercase",letterSpacing:".1em",marginBottom:".75rem",
                  display:"flex",alignItems:"center",gap:8
                }}>
                  <span style={{width:14,height:1,background:"#C9A84C",display:"inline-block"}}></span>
                  About MetaGuildX
                </div>
                <p style={{fontSize:".855rem",color:"#7A93C0",lineHeight:1.7,margin:0}}>
                  MetaGuildX is a decentralized income distribution platform built on the opBNB blockchain.
                  Participants register with USDT and earn income through direct referrals,
                  level income across 10 levels, cashback pool distributions, and MGX token staking rewards.
                  All transactions are executed by immutable smart contracts — no human intervention.
                </p>
              </div>

              {/* Risk */}
              <div style={{
                marginBottom:"1.5rem",padding:"1rem 1.25rem",
                background:"rgba(255,180,0,.05)",border:"1px solid rgba(255,180,0,.15)",borderRadius:10
              }}>
                <div style={{
                  fontFamily:"Syne,sans-serif",fontSize:".78rem",fontWeight:700,
                  color:"#F59E0B",textTransform:"uppercase",letterSpacing:".1em",marginBottom:".625rem"
                }}>⚡ Risk Disclaimer</div>
                <p style={{fontSize:".835rem",color:"rgba(245,158,11,.8)",lineHeight:1.7,margin:0}}>
                  Participation involves financial risk. Earnings depend entirely on network activity
                  and are not guaranteed. Past performance does not indicate future results.
                  Never invest more than you can afford to lose. This is not financial advice.
                </p>
              </div>

              {/* Terms list */}
              <div style={{marginBottom:"1.5rem"}}>
                <div style={{
                  fontFamily:"Syne,sans-serif",fontSize:".78rem",fontWeight:700,
                  color:"#C9A84C",textTransform:"uppercase",letterSpacing:".1em",marginBottom:".75rem",
                  display:"flex",alignItems:"center",gap:8
                }}>
                  <span style={{width:14,height:1,background:"#C9A84C",display:"inline-block"}}></span>
                  Terms & Conditions
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[
                    "I am at least 18 years of age and legally allowed to participate.",
                    "I am not a citizen or resident of the USA, China, or UAE.",
                    "I understand this platform is decentralized and runs on smart contracts.",
                    "I accept full responsibility for my own participation and investment decisions.",
                    "I understand that registration fees and earnings are processed on-chain and are non-refundable.",
                    "I agree to use this platform in compliance with my local laws and regulations.",
                  ].map((term,i) => (
                    <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{
                        width:20,height:20,borderRadius:5,flexShrink:0,marginTop:1,
                        background:"rgba(46,111,216,.12)",border:"1px solid rgba(46,111,216,.25)",
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:".65rem",color:"#5B9EF8",fontWeight:700
                      }}>{i+1}</div>
                      <div style={{fontSize:".82rem",color:"#7A93C0",lineHeight:1.6}}>{term}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart contract note */}
              <div style={{
                padding:".875rem 1.25rem",
                background:"rgba(46,111,216,.06)",border:"1px solid rgba(46,111,216,.15)",borderRadius:10
              }}>
                <div style={{fontSize:".8rem",color:"#5B9EF8",lineHeight:1.6}}>
                   All operations are governed by audited smart contracts on opBNB.
                  Contract addresses are publicly verifiable on-chain.
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{
              padding:"1.5rem 2rem",
              borderTop:"1px solid rgba(255,255,255,.06)",
              background:"rgba(8,15,36,.5)"
            }}>
              <button
                type="button"
                style={{
                  width:"100%",padding:"14px",borderRadius:10,
                  background:"linear-gradient(135deg,#C9A84C,#E8C96A)",
                  color:"#080604",fontWeight:700,border:"none",
                  fontFamily:"Syne,sans-serif",fontSize:"1rem",
                  cursor:"pointer",marginBottom:10,
                  letterSpacing:".01em"
                }}
                onClick={() => {
                  try { localStorage.setItem("mgx_disclaimer_v1","true"); } catch {}
                  setDisclaimerAccepted(true);
                }}
              >
                I Understand & Agree →
              </button>
              <button
                type="button"
                style={{
                  width:"100%",padding:"11px",borderRadius:10,
                  background:"transparent",
                  color:"#3D5580",fontWeight:400,
                  border:"1px solid rgba(255,255,255,.06)",
                  fontFamily:"DM Sans,sans-serif",fontSize:".875rem",
                  cursor:"pointer"
                }}
                onClick={() => { window.history.back(); }}
              >
                Decline & Go Back
              </button>
              <div style={{
                textAlign:"center",marginTop:".875rem",
                fontSize:".72rem",color:"#3D5580",lineHeight:1.5
              }}>
                Your acceptance is stored locally. You will not be shown this again on this device.
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="landing-page" style={{
        fontFamily: '"DM Sans", sans-serif',
        background: '#030610',
        color: '#EEF4FF',
        overflowX: 'hidden',
        minHeight: '100vh',
      }}>

        {/* —— STYLES —— */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
          :root{
            --gold:#C9A84C;--gold-l:#E8C96A;
            --blue:#1E5FBF;--blue-l:#2E6FD8;--cyan:#00D4FF;
            --border-b:rgba(46,111,216,.18);
            --t1:#EEF4FF;--t2:#7A93C0;--t3:#3D5580;--green:#2EC48F;
          }
          .lp-nav{position:fixed;top:0;left:0;right:0;z-index:200;
            padding:1rem 3rem;display:flex;align-items:center;justify-content:space-between;
            background:rgba(3,6,16,.92);backdrop-filter:blur(24px);
            border-bottom:1px solid rgba(46,111,216,.12)}
          .lp-logo{display:flex;align-items:center;gap:10px;text-decoration:none;
            font-family:Syne,sans-serif;font-size:1.15rem;font-weight:800;color:#EEF4FF}
          .lp-logo img{width:36px;height:36px;object-fit:contain}
          .lp-logo span{color:#C9A84C}
          .lp-navlinks{display:flex;gap:2rem;list-style:none;padding:0;margin:0}
          .lp-navlinks a{font-size:.875rem;color:rgba(238,244,255,.7);text-decoration:none;transition:color .2s}
          .lp-navlinks a:hover{color:#EEF4FF}
          .lp-btn-out{padding:8px 20px;border-radius:7px;border:1px solid rgba(255,255,255,.15);
            color:rgba(238,244,255,.8);background:rgba(255,255,255,.04);
            font-family:"DM Sans",sans-serif;font-size:.875rem;cursor:pointer;text-decoration:none;transition:all .2s}
          .lp-btn-out:hover{border-color:rgba(201,168,76,.4);color:#EEF4FF}
          .lp-btn-gold{padding:9px 22px;border-radius:7px;background:#C9A84C;
            color:#080604;font-weight:600;border:none;font-family:"DM Sans",sans-serif;
            font-size:.875rem;cursor:pointer;transition:all .2s}
          .lp-btn-gold:hover{background:#E8C96A;transform:translateY(-1px)}
          .lp-hero{position:relative;min-height:100vh;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            text-align:center;overflow:hidden;padding:5rem 1rem 3rem}
          .lp-hero-bg{position:absolute;inset:0;z-index:0;
            background:
              radial-gradient(ellipse 80% 60% at 50% 0%,rgba(30,95,191,.3) 0%,transparent 60%),
              radial-gradient(ellipse 50% 40% at 20% 80%,rgba(201,168,76,.07) 0%,transparent 50%),
              radial-gradient(ellipse 50% 40% at 80% 70%,rgba(0,212,255,.05) 0%,transparent 50%),
              linear-gradient(180deg,#05091A 0%,#030610 100%)}
          .lp-stars{position:absolute;inset:0;z-index:1;overflow:hidden}
          .lp-star{position:absolute;border-radius:50%;background:rgba(255,255,255,.8)}
          .lp-ring-wrap{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;pointer-events:none}
          .lp-ring{position:absolute;border-radius:50%;border:1px solid;top:50%;left:50%}
          .lp-r1{width:300px;height:300px;border-color:rgba(201,168,76,.12);transform:translate(-50%,-50%);animation:lp-spin 22s linear infinite}
          .lp-r2{width:440px;height:440px;border-color:rgba(46,111,216,.08);transform:translate(-50%,-50%);animation:lp-spin 32s linear infinite reverse}
          .lp-r3{width:580px;height:580px;border-color:rgba(0,212,255,.05);transform:translate(-50%,-50%);animation:lp-spin 48s linear infinite}
          .lp-r1::before{content:"";position:absolute;width:8px;height:8px;background:#C9A84C;
            border-radius:50%;top:-4px;left:50%;transform:translateX(-50%);box-shadow:0 0 12px #C9A84C}
          .lp-r2::before{content:"";position:absolute;width:6px;height:6px;background:#2E6FD8;
            border-radius:50%;top:-3px;left:50%;transform:translateX(-50%);box-shadow:0 0 10px #2E6FD8}
          @keyframes lp-spin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
          .lp-logo-wrap{position:relative;z-index:3;margin-bottom:2rem;animation:lp-float 4s ease-in-out infinite}
          @keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
          .lp-logo-img{width:180px;height:180px;object-fit:contain;
            filter:drop-shadow(0 0 35px rgba(201,168,76,.55)) drop-shadow(0 0 70px rgba(46,111,216,.3))}
          .lp-hero-content{position:relative;z-index:3;width:100%;max-width:560px;padding:0 1rem}
          .lp-badge{display:inline-flex;align-items:center;gap:8px;padding:5px 16px;
            border:1px solid rgba(201,168,76,.25);border-radius:100px;
            font-size:.7rem;color:#C9A84C;letter-spacing:.12em;text-transform:uppercase;
            margin-bottom:1.5rem;background:rgba(201,168,76,.06);backdrop-filter:blur(10px)}
          .lp-bdot{width:6px;height:6px;background:#2EC48F;border-radius:50%;animation:lp-pulse 2s infinite}
          @keyframes lp-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
          .lp-h1{font-family:Syne,sans-serif;font-size:clamp(2rem,8vw,5rem);font-weight:800;
            line-height:1.08;letter-spacing:-.03em;max-width:860px;margin:0 auto;
            word-break:break-word;overflow-wrap:break-word}
          .lp-h1-gold{background:linear-gradient(135deg,#C9A84C 0%,#E8C96A 100%);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
          .lp-h1-cyan{background:linear-gradient(135deg,#00D4FF 0%,#2E6FD8 100%);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
          .lp-sub{font-size:1.1rem;color:rgba(122,147,192,.9);max-width:500px;
            margin:1.5rem auto 2.5rem;font-weight:300;line-height:1.75}
          .lp-acts{display:flex;gap:14px;justify-content:center}
          .lp-btn-hero-gold{padding:14px 34px;border-radius:9px;background:linear-gradient(135deg,#C9A84C,#E8C96A);
            color:#080604;font-weight:600;border:none;font-size:1rem;
            font-family:"DM Sans",sans-serif;cursor:pointer;transition:all .25s}
          .lp-btn-hero-gold:hover{transform:translateY(-3px);box-shadow:0 16px 48px rgba(201,168,76,.28)}
          .lp-btn-hero-out{padding:13px 34px;border-radius:9px;
            border:1px solid rgba(255,255,255,.15);color:rgba(238,244,255,.85);
            background:rgba(255,255,255,.05);font-size:1rem;
            font-family:"DM Sans",sans-serif;cursor:pointer;transition:all .25s;text-decoration:none;display:inline-block}
          .lp-btn-hero-out:hover{border-color:rgba(201,168,76,.4);color:#EEF4FF}
          .lp-ticker{border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);
            background:rgba(5,9,26,.9);padding:1rem 0;overflow:hidden;position:relative;z-index:1}
          .lp-ticker-track{display:flex;gap:3rem;animation:lp-tick 38s linear infinite;width:max-content}
          @keyframes lp-tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
          .lp-ti{display:flex;align-items:center;gap:9px;white-space:nowrap}
          .lp-ti-l{font-size:.7rem;color:#3D5580;text-transform:uppercase;letter-spacing:.08em}
          .lp-ti-v{font-family:Syne,sans-serif;font-size:.9rem;font-weight:700;color:#C9A84C}
          .lp-sep{height:1px;background:rgba(255,255,255,.04)}
          .lp-section{padding:6rem 3rem;max-width:1200px;margin:0 auto}
          .lp-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.15em;color:#C9A84C;
            margin-bottom:1rem;display:flex;align-items:center;gap:10px}
          .lp-lbl::before{content:"";width:16px;height:1px;background:#C9A84C}
          .lp-stitle{font-family:Syne,sans-serif;font-size:clamp(1.8rem,3.5vw,2.75rem);
            font-weight:700;letter-spacing:-.025em;line-height:1.1;max-width:580px}
          .lp-sdesc{color:#7A93C0;font-size:1rem;max-width:460px;margin-top:.875rem;
            font-weight:300;line-height:1.8}
          .lp-how-grid{display:grid;grid-template-columns:1fr 1fr;gap:4rem;margin-top:4rem;align-items:start}
          .lp-steps{display:flex;flex-direction:column}
          .lp-step{display:flex;gap:1.5rem;padding:1.75rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
          .lp-step:first-child{padding-top:0}.lp-step:last-child{border-bottom:none;padding-bottom:0}
          .lp-st-n{font-family:Syne,sans-serif;font-size:.65rem;font-weight:700;
            color:rgba(46,111,216,.5);letter-spacing:.1em;margin-top:4px;min-width:26px}
          .lp-st-t{font-family:Syne,sans-serif;font-size:1rem;font-weight:600;margin-bottom:.4rem}
          .lp-st-d{font-size:.875rem;color:#7A93C0;line-height:1.7}
          .lp-ibox{background:linear-gradient(145deg,rgba(12,22,48,.9),rgba(8,15,36,.95));
            border:1px solid rgba(46,111,216,.2);border-radius:20px;padding:2.5rem}
          .lp-ibox-logo{width:36px;height:36px;object-fit:contain;margin-bottom:1.25rem;
            filter:drop-shadow(0 0 8px rgba(201,168,76,.3))}
          .lp-ibox-title{font-family:Syne,sans-serif;font-size:.72rem;font-weight:600;
            color:#3D5580;text-transform:uppercase;letter-spacing:.12em;margin-bottom:1.5rem}
          .lp-irow{display:flex;justify-content:space-between;align-items:center;
            padding:.8rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
          .lp-irow:last-of-type{border-bottom:none;margin-bottom:1.5rem}
          .lp-idot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:10px}
          .lp-iname{font-size:.875rem;color:#7A93C0}
          .lp-ipct{font-family:Syne,sans-serif;font-size:1rem;font-weight:700;color:#C9A84C}
          .lp-ibar{height:6px;background:rgba(255,255,255,.05);border-radius:6px;overflow:hidden;display:flex}
          .lp-pkg-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:2.5rem}
          .lp-pkg{background:rgba(12,22,48,.7);border:1px solid rgba(46,111,216,.15);
            border-radius:14px;padding:1.5rem 1.25rem;transition:all .3s;position:relative}
          .lp-pkg:hover{border-color:rgba(201,168,76,.4);transform:translateY(-5px);
            box-shadow:0 20px 50px rgba(0,0,0,.4)}
          .lp-pkg.hot{border-color:rgba(201,168,76,.5);
            background:linear-gradient(145deg,rgba(17,30,64,.9),rgba(201,168,76,.05))}
          .lp-pkg.hot::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;
            background:linear-gradient(90deg,transparent,#C9A84C,transparent)}
          .lp-pkg-badge{position:absolute;top:10px;right:10px;padding:2px 8px;
            background:#C9A84C;border-radius:4px;font-size:.6rem;font-weight:700;
            color:#080604;text-transform:uppercase}
          .lp-pkg-n{font-size:.65rem;color:#3D5580;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem}
          .lp-pkg-p{font-family:Syne,sans-serif;font-size:1.65rem;font-weight:800;line-height:1;margin-bottom:.2rem}
          .lp-pkg-u{font-size:.78rem;color:#7A93C0;font-weight:400}
          .lp-pkg-d{font-size:.75rem;color:#2EC48F;margin-bottom:1rem}
          .lp-pkg-feats{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
          .lp-pkg-feats li{font-size:.73rem;color:#7A93C0;display:flex;align-items:center;gap:7px}
          .lp-pkg-feats li::before{content:"";width:3px;height:3px;background:rgba(201,168,76,.4);
            border-radius:50%;flex-shrink:0}
          .lp-tbl-wrap{margin-top:2rem;border:1px solid rgba(46,111,216,.12);
            border-radius:14px;overflow:hidden}
          .lp-tbl{width:100%;border-collapse:collapse;font-size:.85rem}
          .lp-tbl thead tr{background:rgba(8,15,36,.9)}
          .lp-tbl th{padding:.875rem 1.25rem;color:#3D5580;font-weight:500;
            font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;
            border-bottom:1px solid rgba(46,111,216,.12)}
          .lp-tbl th:not(:first-child){text-align:right}
          .lp-tbl td{padding:.875rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.03)}
          .lp-tbl td:not(:first-child){text-align:right}
          .lp-tbl tbody tr:last-child td{border-bottom:none}
          .lp-tbl tbody tr:hover{background:rgba(46,111,216,.04)}
          .lp-tbl tbody tr:nth-child(even){background:rgba(46,111,216,.025)}
          .lp-rm-wrap{position:relative;padding:6rem 3rem;
            background:radial-gradient(ellipse 70% 50% at 50% 100%,rgba(30,95,191,.1) 0%,transparent 60%)}
          .lp-rm-inner{max-width:1200px;margin:0 auto}
          .lp-rm-track{position:relative;margin-top:4rem}
          .lp-rm-line{position:absolute;top:36px;left:5%;right:5%;height:2px;
            background:linear-gradient(90deg,transparent,rgba(46,111,216,.3) 15%,rgba(201,168,76,.3) 45%,rgba(46,111,216,.2) 75%,transparent)}
          .lp-rm-items{display:grid;grid-template-columns:repeat(8,1fr);gap:1rem;position:relative;z-index:1}
          .lp-rm-item{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px}
          .lp-rm-dot{width:72px;height:72px;display:flex;align-items:center;justify-content:center;
            border-radius:50%;font-size:1.6rem}
          .lp-rm-item.done .lp-rm-dot{background:linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.04));
            border:1px solid rgba(201,168,76,.35);box-shadow:0 0 18px rgba(201,168,76,.12)}
          .lp-rm-item.active .lp-rm-dot{background:linear-gradient(135deg,rgba(46,111,216,.2),rgba(46,111,216,.04));
            border:1px solid rgba(46,111,216,.5);box-shadow:0 0 18px rgba(46,111,216,.2)}
          .lp-rm-item:not(.done):not(.active) .lp-rm-dot{background:rgba(255,255,255,.03);
            border:1px solid rgba(255,255,255,.07)}
          .lp-rm-t{font-family:Syne,sans-serif;font-size:.78rem;font-weight:700;line-height:1.3}
          .lp-rm-s{font-size:.62rem;color:#3D5580;line-height:1.4}
          .lp-rm-tag{font-size:.58rem;padding:3px 8px;border-radius:5px;font-weight:600;display:inline-block}
          .lp-tag-done{background:rgba(201,168,76,.12);color:#C9A84C;border:1px solid rgba(201,168,76,.2)}
          .lp-tag-active{background:rgba(46,111,216,.12);color:#5B9EF8;border:1px solid rgba(46,111,216,.25)}
          .lp-tag-soon{background:rgba(255,255,255,.04);color:#3D5580;border:1px solid rgba(255,255,255,.06)}
          .lp-feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;
            margin-top:4rem;border-radius:20px;overflow:hidden;background:rgba(255,255,255,.04)}
          .lp-feat{background:rgba(5,9,26,.95);padding:2.25rem;transition:background .3s}
          .lp-feat:hover{background:rgba(12,22,48,.95)}
          .lp-feat-icon{width:42px;height:42px;border:1px solid rgba(201,168,76,.18);border-radius:10px;
            display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem;
            font-size:1.1rem;color:#C9A84C;background:rgba(201,168,76,.05)}
          .lp-feat-n{font-family:Syne,sans-serif;font-size:.95rem;font-weight:600;margin-bottom:.5rem}
          .lp-feat-d{font-size:.855rem;color:#7A93C0;line-height:1.65}
          .lp-tok-grid{display:grid;grid-template-columns:1fr 1fr;gap:4rem;
            margin-top:4rem;align-items:center}
          .lp-tok-row{display:flex;align-items:center;gap:1.25rem;margin-bottom:.5rem}
          .lp-tok-logo{width:54px;height:54px;object-fit:contain;
            filter:drop-shadow(0 0 14px rgba(201,168,76,.4))}
          .lp-tok-name{font-family:Syne,sans-serif;font-size:2.8rem;font-weight:800;
            background:linear-gradient(135deg,#C9A84C,#E8C96A);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
            letter-spacing:-.03em;line-height:1}
          .lp-tok-sub{font-size:.9rem;color:#7A93C0;margin-bottom:2rem}
          .lp-tok-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .lp-ts{background:rgba(12,22,48,.7);border:1px solid rgba(46,111,216,.15);
            border-radius:12px;padding:1.1rem;transition:border-color .3s}
          .lp-ts:hover{border-color:rgba(201,168,76,.3)}
          .lp-ts-l{font-size:.68rem;color:#3D5580;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem}
          .lp-ts-v{font-family:Syne,sans-serif;font-size:1.15rem;font-weight:700}
          .lp-donut-wrap{display:flex;flex-direction:column;align-items:center;gap:1.75rem}
          .lp-legend{display:flex;flex-direction:column;gap:9px;width:100%}
          .lp-leg{display:flex;align-items:center;justify-content:space-between;font-size:.85rem}
          .lp-leg-l{display:flex;align-items:center;gap:9px}
          .lp-leg-dot{width:9px;height:9px;border-radius:2px}
          .lp-leg-pct{font-family:Syne,sans-serif;font-weight:700;color:#7A93C0}
          .lp-cta-outer{padding:0 3rem 6rem;max-width:1200px;margin:0 auto}
          .lp-cta-box{position:relative;overflow:hidden;border-radius:24px;
            padding:5rem 4rem;text-align:center;
            background:linear-gradient(145deg,rgba(12,22,48,.95),rgba(8,15,36,.98));
            border:1px solid rgba(46,111,216,.18)}
          .lp-cta-box::before{content:"";position:absolute;inset:0;
            background:radial-gradient(ellipse 60% 60% at 50% 0%,rgba(46,111,216,.1) 0%,transparent 60%);
            pointer-events:none}
          .lp-cta-logo{width:80px;height:80px;object-fit:contain;margin-bottom:1.75rem;
            filter:drop-shadow(0 0 20px rgba(201,168,76,.4));animation:lp-float 4s ease-in-out infinite;
            position:relative;z-index:1}
          .lp-cta-box h2{font-family:Syne,sans-serif;font-size:clamp(1.8rem,3.5vw,3rem);
            font-weight:800;letter-spacing:-.03em;margin-bottom:1rem;position:relative;z-index:1}
          .lp-cta-box p{color:#7A93C0;font-size:1rem;margin-bottom:2.5rem;
            position:relative;z-index:1;max-width:480px;margin-left:auto;margin-right:auto}
          .lp-cta-acts{display:flex;gap:14px;justify-content:center;position:relative;z-index:1}
          .lp-footer{border-top:1px solid rgba(255,255,255,.04);
            padding:3rem;max-width:1200px;margin:0 auto}
          .lp-ft-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3rem}
          .lp-ft-logo-r{display:flex;align-items:center;gap:9px;margin-bottom:.75rem}
          .lp-ft-logo{width:30px;height:30px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(201,168,76,.3))}
          .lp-ft-name{font-family:Syne,sans-serif;font-size:1rem;font-weight:800}
          .lp-ft-name span{color:#C9A84C}
          .lp-ft-tag{font-size:.8rem;color:#3D5580;max-width:210px;line-height:1.6}
          .lp-ft-links{display:grid;grid-template-columns:repeat(3,1fr);gap:3rem}
          .lp-ft-ct{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:#3D5580;margin-bottom:.875rem}
          .lp-ft-col ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
          .lp-ft-col a{font-size:.84rem;color:#7A93C0;text-decoration:none;transition:color .2s}
          .lp-ft-col a:hover{color:#C9A84C}
          .lp-ft-bot{display:flex;justify-content:space-between;align-items:center;
            padding-top:2rem;border-top:1px solid rgba(255,255,255,.04);font-size:.76rem;color:#3D5580}
          .lp-socials{display:flex;gap:9px}
          .lp-soc{width:32px;height:32px;border:1px solid rgba(255,255,255,.07);border-radius:7px;
            display:flex;align-items:center;justify-content:center;color:#7A93C0;
            text-decoration:none;font-size:.72rem;transition:all .2s;background:rgba(255,255,255,.03)}
          .lp-soc:hover{border-color:rgba(201,168,76,.35);color:#C9A84C}
          .lp-scroll-hint{position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);
            z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;opacity:.45}
          @media(max-width:768px){.lp-scroll-hint{display:none}}
          .lp-ticker,#lp-how,#lp-packages{display:none}
          .lp-scroll-hint span{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#7A93C0}
          .lp-scroll-line{width:1px;height:36px;
            background:linear-gradient(180deg,#7A93C0 0%,transparent 100%)}
          @media(max-width:768px){
            .lp-nav{padding:.5rem .875rem}
            .lp-navlinks{display:none}
            .lp-logo{font-size:.9rem;gap:6px;white-space:nowrap}
            .lp-logo img{width:28px;height:28px}
            .lp-nav .lp-btn-out{display:none}
            .lp-nav .lp-btn-gold{padding:7px 14px;font-size:.8rem;white-space:nowrap}
            .lp-section{padding:4rem 1.25rem}
            .lp-how-grid,.lp-tok-grid{grid-template-columns:1fr}
            .lp-pkg-grid{grid-template-columns:repeat(2,1fr)}
            .lp-distribution-pkgs{grid-template-columns:repeat(2,1fr) !important}
            .lp-feat-grid{grid-template-columns:1fr}
            .lp-rm-items{grid-template-columns:repeat(2,1fr)}.lp-rm-line{display:none}
            .lp-ft-top{flex-direction:column;gap:2rem}
            .lp-ft-links{grid-template-columns:1fr 1fr;gap:2rem}
            .lp-cta-box{padding:3rem 1.25rem}.lp-cta-outer{padding:0 1.25rem 4rem}
            .lp-hero-logo-img{width:120px !important;height:120px !important}
            .lp-h1{font-size:2.4rem !important}
            .lp-hero-content{padding:0 1rem}
            .lp-acts{flex-direction:column;align-items:center;gap:10px}
            .lp-acts button,.lp-acts a{width:100%;max-width:280px;text-align:center}
            .lp-rm-wrap{padding:5rem 1.25rem}
            .lp-tbl-wrap{overflow-x:auto}
            .lp-pkg-grid{gap:10px}
          }
        `}</style>

        {/* —— NAV —— */}
        <nav className="lp-nav">
          <a href="#" className="lp-logo">
            <img src={logoMark} alt="MGX" />
            Meta<span>Guild</span>X
          </a>
          <ul className="lp-navlinks">
            <li><a href="#lp-roadmap">Roadmap</a></li>
            <li><a href="#lp-token">MGX Token</a></li>
            <li><a href="#lp-contracts">Contracts</a></li>
            <li><a href="#lp-docs">Docs</a></li>
          </ul>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button className="lp-btn-out" type="button" onClick={() => void handleConnectWallet()}>Sign in</button>
            <button className="lp-btn-gold" type="button" onClick={() => void handleConnectWallet()}>Launch App →</button>
          </div>
        </nav>

        {/* —— HERO —— */}
        <div className="lp-hero">
          <div className="lp-hero-bg"></div>
          <div className="lp-stars" id="lp-stars-container"></div>
          <div className="lp-ring-wrap">
            <div className="lp-ring lp-r1"></div>
            <div className="lp-ring lp-r2"></div>
            <div className="lp-ring lp-r3"></div>
          </div>
          <div className="lp-logo-wrap">
            <img src={logoMark} alt="MetaGuildX" className="lp-logo-img" style={{width:180,height:180,objectFit:"contain",maxWidth:"min(180px,45vw)",filter:"drop-shadow(0 0 35px rgba(201,168,76,.55)) drop-shadow(0 0 70px rgba(46,111,216,.3))"}} />
          </div>
          <div className="lp-hero-content">
            {referralSponsorId ? (
              <div style={{
                width:"100%",maxWidth:520,margin:"0 auto 2rem",
                background:"rgba(8,15,36,.95)",
                border:"1px solid rgba(201,168,76,.25)",
                borderRadius:18,overflow:"hidden",
                backdropFilter:"blur(16px)",
                textAlign:"left",
                scrollMarginTop:"80px"
              }}>
                {/* Header */}
                <div style={{
                  padding:"1.5rem 1.75rem",
                  borderBottom:"1px solid rgba(255,255,255,.06)",
                  background:"linear-gradient(135deg,rgba(201,168,76,.08),rgba(46,111,216,.05))"
                }}>
                  <div style={{fontSize:".65rem",color:"#C9A84C",textTransform:"uppercase",
                    letterSpacing:".12em",marginBottom:".875rem",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:6,height:6,background:"#2EC48F",borderRadius:"50%",
                      display:"inline-block",flexShrink:0,animation:"lp-pulse 2s infinite"}}></span>
                    Registering for MetaGuildX
                  </div>
                  <p style={{fontSize:".855rem",color:"#7A93C0",margin:"0 0 1.25rem",lineHeight:1.6}}>
                    You were invited to join MetaGuildX. Register to become part of your sponsor's network.
                  </p>
                  <div style={{
                    display:"flex",alignItems:"flex-start",gap:14,
                    background:"rgba(201,168,76,.06)",
                    border:"1px solid rgba(201,168,76,.2)",
                    borderRadius:12,padding:"1rem 1.25rem",
                    position:"relative"
                  }}>
                    <div style={{
                      width:48,height:48,borderRadius:"50%",flexShrink:0,
                      background:"linear-gradient(135deg,rgba(201,168,76,.3),rgba(46,111,216,.15))",
                      border:"2px solid rgba(201,168,76,.4)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontFamily:"Syne,sans-serif",fontWeight:800,fontSize:"1rem",color:"#C9A84C",
                      overflow:"hidden",boxShadow:"0 0 16px rgba(201,168,76,.2)",
                      minWidth:48
                    }}>#{referralSponsorId}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:".65rem",color:"#3D5580",textTransform:"uppercase",
                        letterSpacing:".1em",marginBottom:3}}>Your Upline / Sponsor</div>
                      <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:"1rem",
                        marginBottom:3,color:"#EEF4FF"}}>
                        User #{referralSponsorId}
                      </div>
                      <div style={{fontSize:".75rem",color:"#7A93C0",
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        maxWidth:"180px"}}>
                        {referralSponsorProfile
                          ? `${referralSponsorProfile.account.slice(0,6)}...${referralSponsorProfile.account.slice(-4)}`
                          : "MetaGuildX Member"}
                      </div>
                      <div style={{
                        marginTop:6,display:"inline-flex",alignItems:"center",gap:5,
                        padding:"4px 10px",
                        background:"rgba(46,196,143,.12)",border:"1px solid rgba(46,196,143,.25)",
                        borderRadius:5,fontSize:".68rem",color:"#2EC48F",fontWeight:600
                      }}> Verified</div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                {referralSponsorProfile && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(255,255,255,.04)"}}>
                    <div style={{padding:"1rem 1.5rem",background:"rgba(8,15,36,.95)"}}>
                      <div style={{fontSize:".65rem",color:"#3D5580",textTransform:"uppercase",
                        letterSpacing:".09em",marginBottom:4}}>Partners</div>
                      <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:"1.2rem",color:"#EEF4FF"}}>
                        {referralSponsorProfile.directReferrals}
                      </div>
                    </div>
                    <div style={{padding:"1rem 1.5rem",background:"rgba(8,15,36,.95)"}}>
                      <div style={{fontSize:".65rem",color:"#3D5580",textTransform:"uppercase",
                        letterSpacing:".09em",marginBottom:4}}>Package</div>
                      <div style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:"1.2rem",color:"#C9A84C"}}>
                        Pkg {referralSponsorProfile.packageLevel}
                      </div>
                    </div>
                  </div>
                )}

                {/* How to register */}
                <div style={{padding:"1.5rem 1.75rem",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                  <div style={{fontSize:".72rem",color:"#EEF4FF",fontFamily:"Syne,sans-serif",
                    fontWeight:600,marginBottom:1.25,letterSpacing:".02em"}}>
                    How to register in MetaGuildX
                  </div>
                  <div style={{marginTop:"1rem",display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      "Install a crypto wallet app (MetaMask recommended) on your smartphone or PC.",
                      "Fund your wallet with USDT on opBNB network for registration.",
                      "Click the Register button below and confirm in your wallet.",
                      "Copy and share your referral link to grow your network."
                    ].map((step,i) => (
                      <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                        <div style={{
                          width:24,height:24,borderRadius:"50%",flexShrink:0,
                          background:"rgba(46,111,216,.15)",border:"1px solid rgba(46,111,216,.3)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:".72rem",color:"#5B9EF8",
                          marginTop:1
                        }}>{i+1}</div>
                        <div style={{fontSize:".815rem",color:"#7A93C0",lineHeight:1.6}}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms + Register */}
                <div style={{padding:"1.25rem 1.75rem 1.75rem",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                  <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10,cursor:"pointer"}}>
                    <input
                      type="checkbox"
                      id="lp-terms-check"
                      style={{marginTop:3,accentColor:"#C9A84C",width:15,height:15,flexShrink:0}}
                    />
                    <span style={{fontSize:".815rem",color:"#7A93C0",lineHeight:1.5}}>
                      I agree to the{" "}
                      <a href="#" style={{color:"#C9A84C",textDecoration:"underline"}}>Terms of Use</a>
                      {" "}and confirm I understand the platform rules.
                    </span>
                  </label>
                  <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:1.5,cursor:"pointer"}}>
                    <input
                      type="checkbox"
                      id="lp-country-check"
                      style={{marginTop:3,accentColor:"#C9A84C",width:15,height:15,flexShrink:0}}
                    />
                    <span style={{fontSize:".815rem",color:"#7A93C0",lineHeight:1.5}}>
                      I am not a citizen of the USA, China or the UAE.
                    </span>
                  </label>
                  <button
                    type="button"
                    className="lp-btn-hero-gold"
                    style={{width:"100%",marginTop:"1.25rem",textAlign:"center"}}
                    onClick={() => {
                      const t = document.getElementById("lp-terms-check") as HTMLInputElement;
                      const c = document.getElementById("lp-country-check") as HTMLInputElement;
                      if (!t?.checked || !c?.checked) {
                        alert("Please agree to the terms before continuing.");
                        return;
                      }
                      void handleConnectWallet();
                    }}
                  >
                    Register with Sponsor #{referralSponsorId} →
                  </button>
                </div>
              </div>
            ) : null}
            <div className="lp-badge"><span className="lp-bdot"></span>Live on opBNB Network</div>
            <h1 className="lp-h1">
              Community.<br/>
              <span className="lp-h1-gold">Token.</span>{" "}
              <span className="lp-h1-cyan">Ecosystem.</span>
            </h1>
            <p className="lp-sub">A transparent, on-chain community building platform powered by the MGX token — live on opBNB Mainnet.</p>
            <div className="lp-acts">
              {referralSponsorId ? (
                <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>
                  Launch App →
                </button>
              ) : (
                <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>Launch App →</button>
              )}
              <a href="#lp-roadmap" className="lp-btn-hero-out">View Roadmap</a>
            </div>
          </div>
          <div className="lp-scroll-hint">
            <span>Scroll</span>
            <div className="lp-scroll-line"></div>
          </div>
        </div>

        {/* —— TICKER —— */}
        <div className="lp-ticker">
          <div className="lp-ticker-track">
            {[["Registration","$10 USDT"],["Direct income","46%"],["Level income","40%"],
              ["Cashback pool","4%"],["Network depth","10 Levels"],["Package tiers","10 Tiers"],
              ["Blockchain","opBNB"],["MGX Staking APY","10.95%"],
              ["Registration","$10 USDT"],["Direct income","46%"],["Level income","40%"],
              ["Cashback pool","4%"],["Network depth","10 Levels"],["Package tiers","10 Tiers"],
              ["Blockchain","opBNB"],["MGX Staking APY","10.95%"]
            ].map(([l,v],i) => (
              <span key={i} className="lp-ti">
                <span className="lp-ti-l">{l}</span>
                <span className="lp-ti-v">{v}</span>
                <span style={{color:"rgba(46,111,216,.25)",margin:"0 .5rem"}}>·</span>
              </span>
            ))}
          </div>
        </div>
        <div className="lp-sep"></div>

        {/* —— HOW IT WORKS —— */}
        <section className="lp-section" id="lp-how">
          <div className="lp-lbl">How it works</div>
          <h2 className="lp-stitle">Income flows automatically<br/>to your wallet</h2>
          <p className="lp-sdesc">No middlemen. No delays. Smart contracts distribute every dollar the moment it enters the system.</p>
          <div className="lp-how-grid">
            <div className="lp-steps">
              {[
                ["01","Register with $10 USDT","Connect your wallet and pay a one-time $10 USDT fee. Instantly activates your Package 1 position in the MetaGuildX network."],
                ["02","Build your downline","Invite others with your referral link. 46% of their registration goes directly to your wallet — instantly, on-chain."],
                ["03","Earn across 10 levels","Level income distributes 40% across your upline chain. As your network grows deeper, passive income compounds automatically."],
                ["04","Auto-upgrade & rebirth","Escrow accumulates toward package upgrades. Hit the threshold — the contract automatically elevates your position."],
              ].map(([n,t,d]) => (
                <div key={n} className="lp-step">
                  <div className="lp-st-n">{n}</div>
                  <div><div className="lp-st-t">{t}</div><div className="lp-st-d">{d}</div></div>
                </div>
              ))}
            </div>
            <div className="lp-ibox">
              <img src={logoMark} alt="MGX" className="lp-ibox-logo" />
              <div className="lp-ibox-title">Income distribution per $10 registration</div>
              {[
                ["#C9A84C","Direct sponsor income","46%"],
                ["#2EC48F","Level income (L1L10)","40%"],
                ["#5B8DEF","Cashback pool","4%"],
                ["#3D5580","Royalty Pool","10%"],
              ].map(([c,n,p]) => (
                <div key={n} className="lp-irow">
                  <div style={{display:"flex",alignItems:"center"}}>
                    <span className="lp-idot" style={{background:c}}></span>
                    <span className="lp-iname">{n}</span>
                  </div>
                  <span className="lp-ipct">{p}</span>
                </div>
              ))}
              <div className="lp-ibar">
                <div style={{width:"46%",height:"100%",background:"#C9A84C"}}></div>
                <div style={{width:"40%",height:"100%",background:"#2EC48F"}}></div>
                <div style={{width:"4%",height:"100%",background:"#5B8DEF"}}></div>
                <div style={{width:"10%",height:"100%",background:"#3D5580"}}></div>
              </div>
            </div>
          </div>
        </section>
        <div className="lp-sep"></div>

        {/* —— PACKAGES —— */}
        <section className="lp-section" id="lp-packages">
          <div className="lp-lbl">Package tiers</div>
          <h2 className="lp-stitle">Choose your entry level</h2>
          <p className="lp-sdesc">10 package tiers with doubling rewards. Start at $10 and scale up to $5,120.</p>
          <div className="lp-pkg-grid">
            {[
              {pkg:1,amt:10,desc:"Entry level · All features",feats:["$4.60 direct income","Level income eligible","Auto-upgrade enabled","MGX staking access"],hot:false},
              {pkg:2,amt:20,desc:"2 income potential",feats:["$9.20 direct income","Higher level earnings","Rebirth eligible","Priority placement"],hot:true},
              {pkg:3,amt:40,desc:"4 income potential",feats:["$18.40 direct income","Deep level penetration","Enhanced cashback","Bonus xSlot cycles"],hot:false},
              {pkg:4,amt:80,desc:"8 income potential",feats:["$36.80 direct income","Network multiplier","Token engine bonus","Max level benefits"],hot:false},
              {pkg:5,amt:160,desc:"Elite · $160$5,120",feats:["Up to $2,355 direct","Elite network status","Maximum earnings","All bonuses unlocked"],hot:false},
            ].map(({pkg,amt,desc,feats,hot}) => (
              <div key={pkg} className={`lp-pkg${hot?" hot":""}`}>
                {hot && <div className="lp-pkg-badge">Popular</div>}
                <div className="lp-pkg-n">Pkg {String(pkg).padStart(2,"0")}</div>
                <div className="lp-pkg-p">${amt} <span className="lp-pkg-u">USDT</span></div>
                <div className="lp-pkg-d">{desc}</div>
                <ul className="lp-pkg-feats">{feats.map(f=><li key={f}>{f}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="lp-tbl-wrap">
            <table className="lp-tbl">
              <thead><tr>
                <th style={{textAlign:"left"}}>Package</th>
                <th>Amount</th>
                <th>Direct Income (46%)</th>
                <th>Auto-Upgrade Threshold</th>
              </tr></thead>
              <tbody>
                {[[1,10],[2,20],[3,40],[4,80],[5,160],[6,320],[7,640],[8,1280],[9,2560],[10,5120]].map(([p,a]) => (
                  <tr key={p}>
                    <td style={{fontFamily:"Syne,sans-serif",fontWeight:600}}>Pkg {String(p).padStart(2,"0")}</td>
                    <td style={{color:"#C9A84C",fontFamily:"Syne,sans-serif",fontWeight:700}}>${a}</td>
                    <td style={{color:"#2EC48F"}}>${(a*0.46).toFixed(2)}</td>
                    <td style={{color:"#7A93C0"}}>${a*2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="lp-sep"></div>

        {/* —— ROADMAP —— */}
        <div className="lp-rm-wrap" id="lp-roadmap">
          <div className="lp-rm-inner">
            <div className="lp-lbl">Roadmap</div>
            <h2 className="lp-stitle">Building the future of<br/>decentralized finance</h2>
            <p className="lp-sdesc">MetaGuildX ecosystem expansion — from community platform to full metaverse.</p>
            <div className="lp-rm-track">
              <div className="lp-rm-line"></div>
              <div className="lp-rm-items">
                {[
                  {icon:"🏛️", title:"Community Building Platform", sub:"Binary placement, income system, cashback, rebirth — live on opBNB Mainnet.", tag:"done", label:"LIVE"},
                  {icon:"🪙", title:"MGX Token", sub:"Fixed-supply token distribution active. Box 1 pricing live.", tag:"active", label:"ACTIVE"},
                  {icon:"📊", title:"MGX DEX", sub:"Native decentralized exchange for MGX trading on opBNB.", tag:"planned", label:"PLANNED"},
                  {icon:"🔒", title:"Staking Activation", sub:"Staking infrastructure deployed. Community activation follows ecosystem milestones.", tag:"planned", label:"PLANNED"},
                  {icon:"📈", title:"Trading Platform", sub:"Advanced trading capabilities for the MetaGuildX ecosystem.", tag:"planned", label:"PLANNED"},
                  {icon:"🎨", title:"NFT Creation", sub:"Create and mint NFTs within the MetaGuildX ecosystem.", tag:"future", label:"FUTURE"},
                  {icon:"🛒", title:"NFT Marketplace", sub:"Trade and discover NFTs from the MetaGuildX community.", tag:"future", label:"FUTURE"},
                  {icon:"🎮", title:"Gaming Platform", sub:"On-chain gaming with MGX token integration.", tag:"future", label:"FUTURE"},
                  {icon:"🌐", title:"Metaverse", sub:"Immersive MetaGuildX experiences on opBNB.", tag:"future", label:"FUTURE"},
                ].map(({icon,title,sub,tag,label}) => (
                  <div key={title} className={`lp-rm-item ${tag==="done"?"done":tag==="active"?"active":""}`}>
                    <div className="lp-rm-dot">{icon}</div>
                    <div className="lp-rm-t">{title}</div>
                    <div className="lp-rm-s">{sub}</div>
                    <span className={`lp-rm-tag lp-tag-${tag}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={{textAlign:"center",color:"#7A93C0",fontSize:"0.82rem",
              maxWidth:"580px",margin:"2rem auto 0",lineHeight:1.7,
              padding:"1rem",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"8px"}}>
              This roadmap represents the long-term vision of MetaGuildX.
              Development priorities may evolve over time.
              No guaranteed delivery timeline is implied.
            </p>
          </div>
        </div>
        <div className="lp-sep"></div>

        {/* —— FEATURES —— */}
        <section className="lp-section" id="lp-features">
          <div className="lp-lbl">Platform features</div>
          <h2 className="lp-stitle">Built for transparency<br/>and security</h2>
          <div className="lp-feat-grid">
            {[
              ["🔗","On-Chain","All platform logic lives in smart contracts on opBNB Mainnet."],
              ["🔒","Secure Governance","Platform governance is managed through secure administrative controls designed to protect the ecosystem."],
              ["📋","Fixed Supply","511,750,000 MGX. No additional minting possible after launch."],
              ["⬆️","Upgradeable","Smart contracts can be improved via governance while protecting user funds."],
              ["🌐","opBNB Mainnet","Low-fee, high-throughput Layer 2 network purpose-built for scale."],
              ["👁️","Public Contracts","All contracts are publicly verifiable on the opBNB block explorer."],
            ].map(([icon,name,desc]) => (
              <div key={name} className="lp-feat">
                <div className="lp-feat-icon">{icon}</div>
                <div className="lp-feat-n">{name}</div>
                <div className="lp-feat-d">{desc}</div>
              </div>
            ))}
          </div>
        </section>
        <div className="lp-sep"></div>

        {/* —— MGX TOKEN —— */}
        <section className="lp-section" id="lp-token">
          <div className="lp-lbl">MGX Token</div>
          <div className="lp-tok-grid">
            <div>
              <div className="lp-tok-row">
                <img src={logoMark} alt="MGX" className="lp-tok-logo" />
                <div className="lp-tok-name">$MGX</div>
              </div>
              <div className="lp-tok-sub">The native utility token of the MetaGuildX ecosystem</div>
              <div className="lp-tok-stats">
                {[["Total Supply","511,750,000 MGX"],["Policy","Fixed — No new mint"],["Chain","opBNB Mainnet"],["Distribution","Box 1–10 System"]].map(([l,v])=>(
                  <div key={l} className="lp-ts">
                    <div className="lp-ts-l">{l}</div>
                    <div className="lp-ts-v">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-donut-wrap">
              <svg style={{transform:"rotate(-90deg)",filter:"drop-shadow(0 0 16px rgba(201,168,76,.1))"}} width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(46,111,216,.08)" strokeWidth="28"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#C9A84C" strokeWidth="28" strokeDasharray="263.9 713.1" strokeDashoffset="0"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#2E6FD8" strokeWidth="28" strokeDasharray="87.96 889.04" strokeDashoffset="-263.9"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#2EC48F" strokeWidth="28" strokeDasharray="87.96 889.04" strokeDashoffset="-351.86"/>
              </svg>
              <div className="lp-legend">
                {[["#C9A84C","Community","60%"],["#2E6FD8","Liquidity","20%"],["#2EC48F","Reserve","20%"]].map(([c,n,p])=>(
                  <div key={n} className="lp-leg">
                    <div className="lp-leg-l"><div className="lp-leg-dot" style={{background:c}}></div><span style={{color:"#7A93C0"}}>{n}</span></div>
                    <div className="lp-leg-pct">{p}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <div className="lp-sep"></div>

        {/* —— PLATFORM DISTRIBUTION MODEL —— */}
        <section className="lp-section" id="lp-distribution">
          <div className="lp-lbl">Distribution Model</div>
          <h2 className="lp-stitle">Platform Distribution Model</h2>
          <p style={{textAlign:"center",color:"#7A93C0",fontSize:"0.95rem",maxWidth:"600px",margin:"0 auto 3rem"}}>
            Every registration is processed automatically by the MetaGuildX smart contracts according to the platform distribution model.
          </p>

          {/* Package Levels */}
          <div className="lp-lbl" style={{marginBottom:"1.5rem"}}>Package Levels</div>
          <div className="lp-distribution-pkgs" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0.75rem",marginBottom:"3rem"}}>
            {[
              ["L1","$10"],["L2","$20"],["L3","$40"],["L4","$80"],["L5","$160"],
              ["L6","$320"],["L7","$640"],["L8","$1,280"],["L9","$2,560"],["L10","$5,120"]
            ].map(([level,price])=>(
              <div key={level} style={{
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(201,168,76,0.15)",
                borderRadius:"10px",
                padding:"1rem",
                textAlign:"center"
              }}>
                <div style={{color:"#7A93C0",fontSize:"0.8rem",marginBottom:"0.4rem"}}>{level}</div>
                <div style={{color:"#C9A84C",fontWeight:700,fontSize:"1.05rem"}}>{price}</div>
              </div>
            ))}
          </div>

          {/* Distribution Breakdown */}
          <div className="lp-lbl" style={{marginBottom:"1.5rem"}}>Distribution Breakdown</div>
          <div className="lp-feat-grid" style={{marginBottom:"3rem"}}>
            {[
              ["💸","Direct Income","46%","Distributed to direct upline automatically"],
              ["📊","Level Income","40%","Distributed across 10 levels of the network"],
              ["🔄","Cashback Pool","4%","Allocated to the platform cashback pool"],
              ["🌱","Royalty Pool","10%","Supports long-term ecosystem growth"],
            ].map(([icon,name,pct,desc])=>(
              <div key={name} className="lp-feat">
                <div className="lp-feat-icon">{icon}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.5rem"}}>
                  <div className="lp-feat-n" style={{margin:0}}>{name}</div>
                  <div style={{color:"#C9A84C",fontWeight:700,fontSize:"1.1rem"}}>{pct}</div>
                </div>
                <div className="lp-feat-d">{desc}</div>
              </div>
            ))}
          </div>

          {/* Royalty Pool Card */}
          <div style={{
            background:"rgba(201,168,76,0.06)",
            border:"1px solid rgba(201,168,76,0.18)",
            borderRadius:"14px",
            padding:"2rem",
            maxWidth:"680px",
            margin:"0 auto"
          }}>
            <div style={{color:"#C9A84C",fontWeight:700,fontSize:"1rem",marginBottom:"1rem"}}>🌱 Royalty Pool — 10%</div>
            <p style={{color:"#94a3b8",fontSize:"0.9rem",lineHeight:1.7,marginBottom:"1rem"}}>
              The Royalty Pool supports the long-term growth of the MetaGuildX ecosystem.
            </p>
            <ul style={{color:"#94a3b8",fontSize:"0.9rem",lineHeight:2,paddingLeft:"1.2rem",margin:0}}>
              <li>Royalty rewards</li>
              <li>Community development</li>
              <li>Platform development</li>
              <li>Ecosystem expansion</li>
              <li>Future MGX buyback initiatives (subject to governance and published policy)</li>
              <li>Future MGX token burn initiatives (subject to governance and published policy)</li>
            </ul>
          </div>
        </section>
        <div className="lp-sep"></div>

        <section className="lp-section" id="lp-staking-policy">
          <div className="lp-lbl">Staking</div>
          <h2 className="lp-stitle">MGX Staking</h2>
          <div style={{maxWidth:"640px",margin:"0 auto",
            background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:"14px",padding:"2rem",textAlign:"center"}}>
            <p style={{color:"#94a3b8",fontSize:"0.95rem",lineHeight:1.8,marginBottom:"1.5rem"}}>
              Staking infrastructure has been deployed. Community activation will follow
              future ecosystem milestones in accordance with the published platform policy.
            </p>
            <a href="https://metaguildx.net/docs/STAKING_READINESS.md"
               target="_blank" rel="noopener noreferrer"
               className="lp-btn-hero-out" style={{fontSize:"0.875rem"}}>
              Read Staking Policy →
            </a>
          </div>
        </section>
        <div className="lp-sep"></div>

        <section className="lp-section" id="lp-contracts">
          <div className="lp-lbl">Transparency</div>
          <h2 className="lp-stitle">Verify on the Blockchain</h2>
          <p style={{textAlign:"center",color:"#7A93C0",fontSize:"0.95rem",
            maxWidth:"540px",margin:"0 auto 3rem"}}>
            All MetaGuildX contracts are publicly deployed on opBNB Mainnet and fully verifiable.
          </p>
          <div style={{maxWidth:"680px",margin:"0 auto",
            border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px",overflow:"hidden"}}>
            {[
              {name:"Core Contract",     short:"0xE3cD...5c2F", full:"0xE3cD200609E223c96987c9FEa41C6014e8625c2F"},
              {name:"MGX Token",         short:"0x0410...Ba81", full:"0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81"},
              {name:"Staking Contract",  short:"0xD18E...26A3", full:"0xD18E7b23AeD67340bf974311d490cd4b903e26A3"},
            ].map(({name,short,full},i) => (
              <div key={name} style={{
                padding:"1.25rem 1.75rem",
                background: i%2===0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderBottom: i<2 ? "1px solid rgba(255,255,255,0.05)" : "none",
                display:"flex",alignItems:"center",justifyContent:"space-between",
                flexWrap:"wrap",gap:"0.75rem"
              }}>
                <div>
                  <div style={{color:"#EEF4FF",fontWeight:600,fontSize:"0.95rem"}}>{name}</div>
                  <div style={{color:"#7A93C0",fontFamily:"monospace",fontSize:"0.85rem",marginTop:"0.25rem"}}>{short}</div>
                </div>
                <a href={`https://opbnb.bscscan.com/address/${full}`}
                   target="_blank" rel="noopener noreferrer"
                   style={{color:"#C9A84C",fontSize:"0.85rem",textDecoration:"none",
                     border:"1px solid rgba(201,168,76,0.3)",borderRadius:"6px",padding:"0.4rem 0.9rem"}}>
                  View on Explorer ↗
                </a>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",color:"#475569",fontSize:"0.8rem",marginTop:"1.5rem"}}>
            Network: opBNB Mainnet — Chain ID: 204 · Third-party smart contract audit has not yet been completed.
          </p>
        </section>
        <div className="lp-sep"></div>

        <section className="lp-section" id="lp-docs">
          <div className="lp-lbl">Documentation</div>
          <h2 className="lp-stitle">Open Documentation</h2>
          <p style={{textAlign:"center",color:"#7A93C0",fontSize:"0.95rem",
            maxWidth:"540px",margin:"0 auto 3rem"}}>
            All MetaGuildX documentation is publicly available.
          </p>
          <div className="lp-feat-grid">
            {[
              {icon:"📄",title:"Whitepaper",    href:"/docs/MGX_TOKEN_WHITEPAPER_v1.0.pdf"},
              {icon:"💰",title:"Tokenomics",    href:"/docs/TOKENOMICS.md"},
              {icon:"🗺️",title:"Roadmap",       href:"/docs/ROADMAP.md"},
              {icon:"🏦",title:"Treasury Policy",href:"/docs/TREASURY_ARCHITECTURE.md"},
              {icon:"🌉",title:"Bridge Status",  href:"/docs/BRIDGE_STATUS.md"},
              {icon:"📊",title:"Staking Policy", href:"/docs/STAKING_READINESS.md"},
            ].map(({icon,title,href}) => (
              <a key={title} href={href} target="_blank" rel="noopener noreferrer"
                 className="lp-feat" style={{textDecoration:"none",cursor:"pointer"}}>
                <div className="lp-feat-icon">{icon}</div>
                <div className="lp-feat-n">{title}</div>
                <div className="lp-feat-d" style={{color:"#C9A84C",fontSize:"0.8rem"}}>Read →</div>
              </a>
            ))}
          </div>
        </section>
        <LevelIncomeCalculator />
        <div className="lp-sep"></div>

        <section className="lp-section" id="lp-start">
          <div className="lp-lbl">Get Started</div>
          <h2 className="lp-stitle">How to Join MetaGuildX</h2>
          <div className="lp-how-grid" style={{maxWidth:"860px",margin:"0 auto"}}>
            <div className="lp-steps">
              {[
                ["01","Connect Your Wallet","Install MetaMask or a compatible wallet and connect it to the MetaGuildX platform."],
                ["02","Switch to opBNB Mainnet","Add opBNB Mainnet (Chain ID: 204) to your wallet. Low fees, fast transactions."],
                ["03","Register and Join","Complete registration to join the MetaGuildX community and begin receiving MGX token allocations."],
              ].map(([n,t,d]) => (
                <div key={n} className="lp-step">
                  <div className="lp-st-n">{n}</div>
                  <div><div className="lp-st-t">{t}</div><div className="lp-st-d">{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="lp-sep"></div>

        <section className="lp-section" id="lp-faq">
          <div className="lp-lbl">FAQ</div>
          <h2 className="lp-stitle">Frequently Asked Questions</h2>
          <div style={{maxWidth:"720px",margin:"0 auto",display:"flex",flexDirection:"column",gap:"1rem"}}>
            {[
              ["What is MetaGuildX?","A transparent, on-chain community building platform powered by the MGX token on opBNB Mainnet."],
              ["Is the MGX supply fixed?","Yes. 511,750,000 MGX total. No additional minting is possible after the initial launch allocation."],
              ["How do I receive MGX?","MGX is automatically distributed on every registration and upgrade through the Box distribution system."],
              ["Is MetaGuildX audited?","Third-party smart contract audit has not yet been completed. All contracts are publicly viewable on the blockchain."],
              ["When will staking be available?","Staking infrastructure is deployed. Community activation follows future ecosystem milestones per published policy."],
              ["What blockchain is MetaGuildX on?","opBNB Mainnet — a low-fee, high-throughput Layer 2 network (Chain ID: 204)."],
              ["Where can I verify the contracts?","All contracts are on opBNB Mainnet and viewable on the block explorer. Links are in the Contracts section."],
              ["Where can I read official documentation?","Complete documentation is available in the Documentation section above, including Whitepaper, Tokenomics, Roadmap, Treasury Policy, Bridge Status, and Staking Policy."],
            ].map(([q,a]) => (
              <div key={q} style={{
                background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.07)",
                borderRadius:"10px",padding:"1.25rem 1.5rem"}}>
                <div style={{color:"#EEF4FF",fontWeight:600,fontSize:"0.95rem",marginBottom:"0.6rem"}}>{q}</div>
                <div style={{color:"#7A93C0",fontSize:"0.875rem",lineHeight:1.7}}>{a}</div>
              </div>
            ))}
          </div>
        </section>
        <div className="lp-sep"></div>

        {/* —— CTA —— */}
        <div className="lp-cta-outer">
          <div className="lp-cta-box">
            <img src={logoMark} alt="MetaGuildX" className="lp-cta-logo" />
            <h2>Join MetaGuildX</h2>
            <p>Connect your wallet and join a transparent, on-chain community building ecosystem on opBNB Mainnet.</p>
            <div className="lp-cta-acts">
              <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>Launch App →</button>
              <a href="#lp-roadmap" className="lp-btn-hero-out">View Roadmap</a>
            </div>
          </div>
        </div>

        {/* —— FOOTER —— */}
        <footer className="lp-footer">
          <div className="lp-ft-top">
            <div>
              <div className="lp-ft-logo-r">
                <img src={logoMark} alt="MGX" className="lp-ft-logo" />
                <div className="lp-ft-name">Meta<span>Guild</span>X</div>
              </div>
              <div className="lp-ft-tag">Community. Token. Ecosystem. Built on opBNB Mainnet.</div>
            </div>
            <div className="lp-ft-links">
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Platform</div>
                <ul><li><a href="#" onClick={(e) => { e.preventDefault(); void handleConnectWallet(); }}>Launch App</a></li><li><a href="#lp-roadmap">Roadmap</a></li><li><a href="#lp-docs">Documentation</a></li><li><a href="#lp-faq">FAQ</a></li></ul>
              </div>
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Resources</div>
                <ul><li><a href="/docs/MGX_TOKEN_WHITEPAPER_v1.0.pdf" target="_blank" rel="noopener noreferrer">Whitepaper</a></li><li><a href="/docs/TOKENOMICS.md" target="_blank" rel="noopener noreferrer">Tokenomics</a></li><li><a href="/docs/BRIDGE_STATUS.md" target="_blank" rel="noopener noreferrer">Bridge Status</a></li><li><a href="/docs/STAKING_READINESS.md" target="_blank" rel="noopener noreferrer">Staking Policy</a></li></ul>
              </div>
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Contracts</div>
                <ul><li><a href="https://opbnb.bscscan.com/address/0xE3cD200609E223c96987c9FEa41C6014e8625c2F" target="_blank" rel="noopener noreferrer">Core Contract ↗</a></li><li><a href="https://opbnb.bscscan.com/address/0x04103b36Ac638f4156Ca07149942Eb37ffD8bA81" target="_blank" rel="noopener noreferrer">MGX Token ↗</a></li><li><a href="https://opbnb.bscscan.com/address/0xD18E7b23AeD67340bf974311d490cd4b903e26A3" target="_blank" rel="noopener noreferrer">Staking ↗</a></li><li><a href="https://opbnb.bscscan.com" target="_blank" rel="noopener noreferrer">Explorer ↗</a></li></ul>
              </div>
            </div>
          </div>
          <div className="lp-ft-bot">
            <span>MetaGuildX is a decentralized platform. Participation involves financial risk. This is not financial advice. © 2026 MetaGuildX</span>
            <div className="lp-socials">
              <a href="#" className="lp-soc"></a>
              <a href="#" className="lp-soc">tg</a>
              <a href="#" className="lp-soc">dc</a>
              <a href="#" className="lp-soc">yt</a>
            </div>
          </div>
        </footer>

        {/* —— STAR GENERATOR SCRIPT —— */}
        <script dangerouslySetInnerHTML={{__html:`
          (function(){
            var c=document.getElementById("lp-stars-container");
            if(!c)return;
            for(var i=0;i<100;i++){
              var s=document.createElement("div");
              s.className="lp-star";
              var sz=Math.random()*2+0.5;
              var dur=2+Math.random()*4;
              var del=Math.random()*3;
              s.style.cssText="width:"+sz+"px;height:"+sz+"px;top:"+(Math.random()*100)+"%;left:"+(Math.random()*100)+"%;animation:lp-pulse "+dur+"s "+del+"s ease-in-out infinite;opacity:0.6";
              c.appendChild(s);
            }
          })();
        `}} />

        {/* Wallet selection modal */}
        {showWalletSelection && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
            <div style={{background:"#0C1630",border:"1px solid rgba(46,111,216,.25)",borderRadius:16,padding:"2rem",maxWidth:360,width:"90%",textAlign:"center"}}>
              <h3 style={{fontFamily:"Syne,sans-serif",marginBottom:"1.5rem"}}>Connect Wallet</h3>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <button className="lp-btn-gold" type="button" style={{width:"100%",padding:"14px"}} onClick={() => { setShowWalletSelection(false); void handleConnectWallet(); }}>MetaMask</button>
                <button className="lp-btn-out" type="button" style={{width:"100%",padding:"14px"}} onClick={() => setShowWalletSelection(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
      </>
    );
  }

  function renderDashboard() {
    const dashboardPageProps = {
      activeLevelsCount,
      activeTreePreview,
      asMgx,
      availableStakeAmount,
      boxEarningsDisplay,
      isBoxEarningsSyncing,
      canSubmitStake,
      canUpgradeCurrentPackage,
      canUseIndexedStakingActions,
      connectedWalletHistoryRows,
      connectedWalletTotalDisplay,
      directIncomeDisplay,
      directLeftNode,
      directRightNode,
      currentUserTreeNode,
      displayedMgxAllocated,
      displayedPendingStakingReward,
      displayedPersonalStaked,
      displayedStakePositions,
      displayedTotalMgxAllocated,
      displayedTotalStaked,
      earningsDashTab,
      escrowBalance,
      frozenEscrowDisplay,
      rebirthEscrowDisplay,
      getDisplayName,
      handleCopyRebirthReferralLink,
      handleCopyReferralLink,
      handleCopyWalletAddress,
      handleLoadMoreHistory,
      handleLogout,
      handleRefreshRewards,
      handleRefreshSection,
      handleShareReferralLink,
      hasClaimableReward,
      hasWithdrawableStake,
      isConnectedWalletHistoryLoading,
      isConnectedWalletLoading,
      isLoading,
      isLoadingLevelTree,
      isLoadingRebirthDetails,
      isLoadingTreeDetails,
      isStakePending,
      LazyTreePanel,
      leftBranchNodes,
      levelIncomeDisplay,
      lockPeriods,
      metaguildx,
      mgxAllocationRows,
      mgxAvailableDisplay,
      navigateToRebirth,
      networkBonusDisplay,
      networkBonusHistoryRows,
      networkDashTab,
      nextUnlockReferralTarget,
      nextUpgradeLevel,
      opBnbGasDisplay,
      outerUsdtBalanceDisplay,
      parseDisplayNumber,
      privacySettings,
      profileMeta,
      profileSaved,
      rebirthBoxEarningsByPkg,
      rebirthDashView,
      rebirthEscrowProgress,
      rebirthFrozenAmount,
      rebirthGoBack,
      rebirthIncomeByUserId,
      rebirthNavStack,
      rebirthNeededAmount,
      rebirthNodeDetails,
      rebirthPkgLevel,
      rebirthProgressLabel,
      rebirthProgressPercent,
      rebirthProgressStep,
      onChainSearchResult,
      onChainSearchLoading,
      rebirthRows,
      rebirthStatusLabel,
      rebirthTreePreview,
      rebirthXSlotStep,
      recentActivityRows,
      referralCopyStatus,
      referralGoalLabel,
      referralLink,
      referralSponsorId,
      referralSponsorProfile,
      registerForm,
      registrationSummary,
      regStep,
      renderSkeletonRows,
      rewardWindowReady,
      rightBranchNodes,
      runWalletAction,
      savePrivacy,
      saveProfileMeta,
      selectedFeaturedUser,
      selectedRebirthId,
      selectedRebirthRow,
      selectedTreeChildren,
      selectedTreeDetails,
      selectedTreeNode,
      selectedTreeParent,
      selectedTreePath,
      selectedTreeUserId,
      setActionFeedback,
      setDashboardView,
      setEarningsDashTab,
      setNetworkDashTab,
      setProfileMeta,
      setProfileSaved,
      setRebirthDashView,
      setRebirthNavStack,
      setRegisterForm,
      setSelectedRebirthId,
      setSelectedTreeUserId,
      setShowActivationConfirm,
      setStakeForm,
      setStatus,
      setTreeMode,
      setUserSearchQuery,
      setWalletMoveAmount,
      setWalletSubView,
      shortWalletAddress,
      showDashboardSkeleton,
      snapshot,
      spilloverIncomeDisplay,
      stakeableMgxAllocated,
      stakeForm,
      StakingSummary,
      Suspense,
      teamBusinessDisplay,
      totalMgxAllocatedDisplay,
      totalReceivedDisplay,
      totalTeamLabel,
      totalTeamMembers,
      transferFromBalance,
      transferFromLabel,
      transferToLabel,
      treeLevels,
      treeMode,
      upgradeMilestones,
      upgradeNeedDisplay,
      upgradeProgressPercent,
      upgradeRemainingDisplay,
      userDisplayNames,
      userLevelSummaryRows,
      userPackageLevel,
      userReferralRows,
      userSearchQuery,
      visibleLevelBreakdownRows,
      walletMoveAmount,
      walletSubView,
    };

    if (isAdminRoute) {
      return (
        <div className="dashboard-page admin-handoff-page">
          <header className="dashboard-topbar">
            <div className="brand-lockup">
              <img src={logoMark} alt="MetaGuildX logo" className="brand-mark" />
              <div className="brand-copy">
                <strong>MetaGuildX Admin</strong>
                <span className="brand-wallet-text">Unified 13-tab panel</span>
              </div>
            </div>
            <div className="dashboard-actions">
              <button type="button" onClick={handleLogout} disabled={isLoading}>
                Logout
              </button>
            </div>
          </header>

          <main className="dashboard-content admin-embed-shell">
            <section className="panel admin-embed-card">
              <p className="section-label">Admin</p>
              <div className="admin-embed-header">
                <div>
                  <h2>Full Admin Panel</h2>
                  <p>
                    The old 4-tab admin view has been merged into the standalone 13-tab admin panel.
                    Use this screen as the single admin entry point.
                  </p>
                </div>
                {adminPanelUrl ? (
                  <div className="admin-embed-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => window.open(adminPanelUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open in New Tab
                    </button>
                  </div>
                ) : null}
              </div>

              {adminPanelUrl ? (
                <div className="admin-embed-frame-wrap">
                  <iframe
                    title="MetaGuildX Admin Panel"
                    src={adminPanelUrl}
                    className="admin-embed-frame"
                  />
                </div>
              ) : (
                <div className="center-box admin-embed-fallback">
                  Standalone admin URL is not configured. Set <code>VITE_ADMIN_PANEL_URL</code> or run the
                  admin app on port 4174.
                </div>
              )}
            </section>
          </main>
        </div>
      );
    }

    return (
      <div className="dashboard-page">
        <style>{walletScreenStyles}</style>
        <div className="dashboard-topbar mobile-topbar">
          <div className="mobile-logo">
            <img src={logoMark} alt="MGX" className="mobile-logo-image" />
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontFamily:"Syne,sans-serif",fontWeight:700,fontSize:".9rem"}}>MetaGuildX</span>
              {snapshot.userId ? (
                <span style={{fontSize:".7rem",color:"#C9A84C",fontWeight:600}}>{profileMeta.displayName || `User #${userDisplayCode}`}</span>
              ) : null}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {snapshot.walletAddress ? (
              <span style={{fontSize:".7rem",color:"var(--text-muted)",fontFamily:"monospace"}}>
                {`${snapshot.walletAddress.slice(0,6)}...${snapshot.walletAddress.slice(-4)}`}
              </span>
            ) : null}
            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setMobileNavOpen((current) => !current)}
              aria-label="Toggle menu"
              style={{padding:"6px 12px",borderRadius:8,background:"rgba(46,111,216,.15)",border:"1px solid rgba(46,111,216,.25)",color:"var(--text-primary)",fontSize:".8rem",cursor:"pointer"}}
            >
              {mobileNavOpen ? "" : ""}
            </button>
          </div>
        </div>

        <div
          className={`sidebar-overlay nav-overlay ${mobileNavOpen ? "open" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden={mobileNavOpen ? "false" : "true"}
        />

        <div className="dashboard-shell">
          {/* LEFT SIDEBAR */}
          <aside className="dashboard-sidebar">
            {/* Logo */}
            <div className="dashboard-sidebar-logo">
              <img
                src="/mgx-logo.png"
                alt="MGX"
                style={{ width: "48px", height: "48px", objectFit: "contain",
                  filter: "drop-shadow(0 0 8px rgba(201,168,76,0.4))" }}
                onError={(e) => { e.currentTarget.style.display='none'; }}
              />
              <div className="dashboard-sidebar-logo-text">
                <span>MetaGuildX</span>
                {snapshot?.userId ? (
                  <span>{profileMeta.displayName || `User #${userDisplayCode}`}</span>
                ) : null}
                <span>
                  {snapshot?.walletAddress
                    ? `${snapshot.walletAddress.slice(0,6)}...${snapshot.walletAddress.slice(-4)}`
                    : "Dashboard"}
                </span>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="dashboard-sidebar-nav">
              {/* Main nav items */}
              {[
                { key: "overview",  icon: "🏠", label: "Home" },
                { key: "income",    icon: "💰", label: "Earnings" },
                { key: "network",   icon: "🌐", label: "Network" },
                { key: "upgrade",   icon: "⬆️", label: "Upgrade" },
                { key: "rebirth",   icon: "♻️", label: "Rebirth" },
                { key: "wallet",    icon: "👛", label: "Wallet" },
              ].map(item => (
                <button
                  key={item.key}
                  className={`sidebar-nav-item${dashboardView === item.key || (item.key === "network" && ["network","tree","referrals"].includes(dashboardView)) ? " active" : ""}`}
                  onClick={() => {
                    setDashboardView(item.key as DashboardView);
                    if (item.key === "wallet") setWalletSubView("main");
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              {/* Community section */}
              <div style={{
                fontSize: "10px", fontWeight: 700, color: "#3D5580",
                textTransform: "uppercase", letterSpacing: "0.1em",
                padding: "16px 14px 6px", marginTop: "8px"
              }}>
                Community
              </div>
              {[
                { key: "team",       icon: "👥", label: "My Team" },
                { key: "usersearch", icon: "🔍", label: "User Search" },
              ].map(item => (
                <button
                  key={item.key}
                  className={`sidebar-nav-item${dashboardView === item.key ? " active" : ""}`}
                  onClick={() => setDashboardView(item.key as DashboardView)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              {/* Bottom items */}
              {[
                { key: "support",  icon: "🎧", label: "Support" },
                { key: "crosschain", icon: "🔁", label: "Cross-Chain Hub" },
                { key: "profile",  icon: "👤", label: "My Profile" },
                { key: "settings", icon: "✔️", label: "Settings" },
              ].map(item => (
                <button
                  key={item.key}
                  className={`sidebar-nav-item${dashboardView === item.key ? " active" : ""}`}
                  onClick={() => setDashboardView(item.key as DashboardView)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Footer: Logout */}
            <div className="dashboard-sidebar-footer">
              <button
                className="sidebar-nav-item"
                onClick={handleLogout}
                style={{ color: "#FF6B7A" }}
              >
                <span className="nav-icon">🚪</span>
                <span>Logout</span>
              </button>
            </div>
          </aside>

          {/* RIGHT: topbar + content */}
          <div className="dashboard-body">
        <header className="dashboard-topbar desktop-topbar">
          <div className="brand-lockup">
            <img
              src={logoMark}
              alt="MetaGuildX logo"
              className="brand-mark"
              style={{ width: "44px", height: "44px", objectFit: "contain",
                filter: "drop-shadow(0 0 8px rgba(201,168,76,0.4))" }}
            />
            <div className="brand-copy">
              <strong>MetaGuildX Dashboard</strong>
              <span className="brand-wallet-text" title={snapshot.walletAddress ?? "Wallet pending"}>
                {snapshot.userId ? profileMeta.displayName || `User #${userDisplayCode}` : snapshot.walletAddress ? `${snapshot.walletAddress.slice(0, 6)}...${snapshot.walletAddress.slice(-4)}` : "Wallet pending"}
              </span>
            </div>
          </div>
          <div className="dashboard-actions">
            {snapshot.walletAddress ? (
              <button type="button" onClick={handleLogout} disabled={isLoading}>
                Logout
              </button>
            ) : (
              <button type="button" onClick={() => void handleConnectWallet("overview")} disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {!isAdminRoute || isAdminAuthorized ? (
        <section className={`tab-nav dashboard-menu dashboard-nav desktop-hide ${mobileNavOpen ? "mobile-open" : ""}`}>
          <div className="dashboard-nav-grid">
            {isAdminRoute ? null : (
              <>
            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "overview" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("overview")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🏠</span> Home</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "income" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("income")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">💰</span> Earnings</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "network" || dashboardView === "tree" || dashboardView === "referrals"
                  ? "ring-1 ring-blue-500 bg-gray-800"
                  : ""
              }`}
              onClick={() => {
                setDashboardView("network");
                setTreeMode("personal");
              }}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🌐</span> Network</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "upgrade" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("upgrade")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">⬆️</span> Upgrade</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "rebirth" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("rebirth")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">♻️</span> Rebirth</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "wallet" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => {
                setDashboardView("wallet");
                setWalletSubView("main");
              }}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">👛</span> Wallet</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "team" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("team")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">👥</span> My Team</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "usersearch" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("usersearch")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🔍</span> Search</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "support" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("support")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🎧</span> Support</p>
            </button>
            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "crosschain" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("crosschain")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🔁</span> Cross-Chain Hub</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "profile" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("profile")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">👤</span> My Profile</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "settings" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("settings")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">✔️</span> Settings</p>
            </button>
              </>
            )}
          </div>
        </section>

        ) : null}
        <main className="dashboard-content">
            {isLoading ? (
            <div className="center-box" style={loadingShellStyle}>
              <div className="loading-text">Loading dashboard...</div>
              <div className="status-text">{status}</div>
            </div>
            ) : loadFailure ? (
              <div className="center-box" style={loadingShellStyle}>
                <div className="error-text">{loadFailure}</div>
                <button type="button" className="btn-primary" onClick={() => void handleRetryDashboardLoad()}>
                  Retry Dashboard Load
                </button>
                {SHOW_DIAGNOSTICS ? renderStartupDiagnosticsPanel() : null}
              </div>
            ) : hasError ? (
              <div className="error-text">
                Unable to load data. Please reconnect your wallet or try again.
            </div>
          ) : isAdminRoute && !snapshot.walletAddress ? (
            <div className="center-box" style={loadingShellStyle}>Connect wallet to continue</div>
          ) : isAdminRoute && isCheckingAdminAccess ? (
            <div className="center-box" style={loadingShellStyle}>Checking access...</div>
          ) : isAdminRoute && isWrongAdminNetwork ? (
            <div className="center-box" style={loadingShellStyle}>Wrong network. Please switch network.</div>
          ) : isAdminRoute && !isAdminAuthorized ? (
            <div className="center-box" style={loadingShellStyle}>Access restricted</div>
          ) : (
            <>
          {dashboardView === "overview" && <section className="panel dashboard-intro dashboard-view w-full max-w-full">
            <p className="section-label">Home</p>
            <div className="dashboard-hero-row">
              <div>
                <h2>{snapshot.userId ? <>Welcome back, {profileMeta.displayName || `User #${userDisplayCode}`}</> : "Welcome back"}</h2>
                <p>
                  {snapshot.packageLevel ? `Package ${snapshot.packageLevel}` : "Package pending"}{" · "}
                  {snapshot.isRegistered ? "Active member" : "Activation pending"}{" · Since "}{memberSinceLabel}
                </p>
                {safeContractWarning ? <p className="warning-text">{safeContractWarning}</p> : null}
              </div>
              <div className="summary-strip w-full">
                <article className="summary-chip">
                  <span>Total Earned</span>
                  <strong>${totalEarnedDisplay}</strong>
                </article>
                <article className="summary-chip">
                  <span>Package</span>
                  <strong>{snapshot.packageLevel ? `Pkg ${snapshot.packageLevel}` : "Pending"}</strong>
                </article>
                <article className="summary-chip">
                  <span>MGX Staked</span>
                  <strong>{displayedPersonalStaked} MGX</strong>
                </article>
                <article className="summary-chip">
                  <span>Team Members</span>
                  <strong>{totalTeamLabel}</strong>
                </article>
              </div>
            </div>
            {actionFeedback ? (
              <div className="toast-notification" role="status" aria-live="polite">
                <div className="toast-copy">
                  <strong>{actionFeedback.title}</strong>
                  <span>{actionFeedback.detail}</span>
                </div>
                <button type="button" className="toast-dismiss" onClick={() => setActionFeedback(null)} aria-label="Dismiss notification">
                  
                </button>
              </div>
            ) : null}
            {shouldShowActivationPrompt ? (
              <div className="activation-banner">
                <div>
                  <strong>Registration ready</strong>
                  <span>Your wallet is connected, but this account is not active yet. No USDT approval has happened so far. Continue to Package 1 activation when ready.</span>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setDashboardView("register");
                    setStatus("Package 1 is ready. This next step will show the 10 USDT approval and registration confirmation.");
                  }}
                >
                  Activate Now
                </button>
              </div>
            ) : null}
          </section>}


          {!isAdminRoute && dashboardView === "overview" ? <OverviewPage {...dashboardPageProps} /> : null}
          {!isAdminRoute && dashboardView === "crosschain" ? <CrossChainHubPage /> : null}

          {dashboardView === "network" || dashboardView === "tree" ? <NetworkPage {...dashboardPageProps} /> : null}

          {dashboardView === "income" ? <IncomePage {...dashboardPageProps} /> : null}

          {dashboardView === "referrals" ? <ReferralsPage {...dashboardPageProps} /> : null}

          {dashboardView === "levels" ? <LevelsPage {...dashboardPageProps} /> : null}

          {dashboardView === "rebirth" ? <RebirthPage {...dashboardPageProps} /> : null}

          {dashboardView === "wallet" ? <WalletPage {...dashboardPageProps} /> : null}

          {dashboardView === "upgrade" ? <UpgradePage {...dashboardPageProps} /> : null}

          {dashboardView === "cashback" ? <CashbackPage {...dashboardPageProps} /> : null}

          {dashboardView === "profile" && <ProfilePage {...dashboardPageProps} />}

          {dashboardView === "settings" && <SettingsPage {...dashboardPageProps} />}

          {dashboardView === "team" && <TeamPage {...dashboardPageProps} />}

          {dashboardView === "usersearch" && <UserSearchPage {...dashboardPageProps} />}

          {dashboardView === "support" ? (
            <SupportPage
              userId={snapshot.userId}
              walletAddress={snapshot.walletAddress}
            />
          ) : null}

          {dashboardView === "register" ? <RegisterPage {...dashboardPageProps} /> : null}

            </>
          )}
          {showActivationConfirm ? (
            <div className="flow-modal-overlay" role="presentation">
              <div className="flow-modal-card">
                <div className="flow-modal-header">
                  <div>
                    <p className="section-label">Step 3</p>
                    <h3>Approve 10 USDT and register</h3>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => setShowActivationConfirm(false)}>
                    Cancel
                  </button>
                </div>
                <div className="transaction-summary-card">
                  <div>
                    <span>Package</span>
                    <strong>Package 1</strong>
                  </div>
                  <div>
                    <span>Cost</span>
                    <strong>$10 USDT</strong>
                  </div>
                  <div>
                    <span>Sponsor</span>
                    <strong>{referralSponsorId ?? Number(registerForm.sponsorId || "0")}</strong>
                  </div>
                </div>
                <p className="text-secondary">
                  This is step 3. Only now will MetaMask ask for 10 USDT approval, followed by the registration transaction.
                </p>
                <div className="flow-modal-actions">
                  <button type="button" className="secondary-button" onClick={() => setShowActivationConfirm(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" onClick={() => void handleActivate()} disabled={isLoading}>
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
          </div>
        </div>
      </div>
    );
  }

  return screen === "dashboard" ? renderDashboard() : renderLanding();
}

export default App;































