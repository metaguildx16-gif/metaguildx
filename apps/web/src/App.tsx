import { Contract, JsonRpcProvider, ethers, formatUnits } from "ethers";
import { Suspense, lazy, startTransition, useEffect, useRef, useState } from "react";
import logoMark from "./assets/mgx logo.png";
import { fallbackSnapshot } from "./appFallback";
import { SupportPage } from "./pages/Support";
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
  | "support";
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
  const [selectedRebirthId, setSelectedRebirthId] = useState<number | null>(null);
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
  const [profileMeta, setProfileMeta] = useState<typeof defaultProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });
  const saveProfileMeta = (updated: typeof defaultProfile) => {
    setProfileMeta(updated);
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
  };
  const [profileSaved, setProfileSaved] = useState(false);
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
    console.time(label);
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) =>
          window.setTimeout(() => reject(new Error(`${label} timed out after 90s`)), DASHBOARD_LOAD_TIMEOUT_MS)
        )
      ]);
    } finally {
      console.timeEnd(label);
    }
  }

  async function refreshStartupDiagnostics(walletConnected: boolean, registeredUserId: number | null) {
    const deployBlock = metaguildx.getDeploymentAnalyticsStartBlock();
    let currentBlock: number | null = null;

    if (activeNetworkConfig.rpcUrl) {
      try {
        console.time("provider.getBlockNumber [startup diagnostics]");
        const provider = new JsonRpcProvider(activeNetworkConfig.rpcUrl);
        currentBlock = await Promise.race<number>([
          provider.getBlockNumber(),
          new Promise<number>((_, reject) =>
            window.setTimeout(() => reject(new Error("provider.getBlockNumber timed out after 90s")), DASHBOARD_LOAD_TIMEOUT_MS)
          )
        ]);
      } catch (error) {
        console.warn("Startup diagnostics block read failed", error);
      } finally {
        console.timeEnd("provider.getBlockNumber [startup diagnostics]");
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
            beginLoadPhase("loading tree", "Loading tree...");
            beginLoadPhase("loading earnings", "Loading earnings...");
            setLoadStage("complete");
            finishLoadingSession("complete");
            return;
          } catch {
            clearWalletSession();
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
        const provider = new JsonRpcProvider(rpcUrl);
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
          setTotalUsers(Math.max(0, Number(nextId) - 2));
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

    const parsedRef = Number(refValue);
    if (!Number.isFinite(parsedRef) || parsedRef <= 0) {
      return;
    }

    setReferralSponsorId(parsedRef);
    setRegisterForm((current) => ({ ...current, sponsorId: refValue }));
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
        .then(setSnapshot)
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
    if (dashboardView !== "income") {
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
  }, [dashboardView, snapshot.userId, snapshot.levelIncome]);

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

  async function refreshSnapshot(walletAddress?: string | null) {
    startLoadingSession("loading user profile", "Loading user profile...");
    setLoadStage("profile");
    const nextSnapshot = await withDashboardTimeout(
      metaguildx.loadDashboardSnapshot(walletAddress ?? snapshot.walletAddress, { forceRefresh: true }),
      "fetchDashboardData"
    );
    setLoadStage("income");
    beginLoadPhase("loading analytics", "Loading analytics...");
    setSnapshot(nextSnapshot);
    beginLoadPhase("loading tree", "Loading tree...");
    beginLoadPhase("loading earnings", "Loading earnings...");
    setLoadStage("complete");
    finishLoadingSession("complete");
    return nextSnapshot;
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const nextSnapshot = await refreshSnapshot();
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
  const referralLink =
    snapshot.userId && typeof window !== "undefined" ? `${window.location.origin}/?ref=${snapshot.userId}` : null;
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
  const canStartSignUp = registrationConsent.terms && registrationConsent.restrictedCountry;
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
    { id: "stake", label: "Stake", symbol: "ST" },
    { id: "myStake", label: "My Stake", symbol: "MS" },
  ];

  const transferFromLabel = "MGX Allocated (Free)";
  const transferToLabel = "MetaMask wallet";
  const transferFromBalance = displayedMgxAllocated;
  const totalTeamMembers =
    snapshot.leftBranchNodes + snapshot.rightBranchNodes > 0
      ? snapshot.leftBranchNodes + snapshot.rightBranchNodes
      : snapshot.userId === 1 && totalUsers > 0
      ? Math.max(totalUsers - 1, 0)
      : snapshot.treePreview.filter((node) => node.userId !== (snapshot.userId ?? 0)).length;
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
    const result: Record<number, string> = {};

    if (packageOneBucketEarnings > 0) {
      result[1] = packageOneBucketEarnings.toFixed(2);
    }

    const currentPackageLevel = snapshot.packageLevel ?? 0;
    if (currentPackageLevel > 1 && currentBucketEarnings > 0) {
      result[currentPackageLevel] = currentBucketEarnings.toFixed(2);
    }

    return result;
  })();
  const memberSinceLabel = formatDashboardDate(snapshot.joinedAt);
  const sponsorLabel = snapshot.sponsorId ? `User #${snapshot.sponsorId}` : "Root";
  const currentUserTreeNode = snapshot.userId ? snapshot.treePreview.find((node) => node.userId === snapshot.userId) ?? null : null;
  const directLeftNode =
    currentUserTreeNode && currentUserTreeNode.leftChildId
      ? snapshot.treePreview.find((node) => node.userId === currentUserTreeNode.leftChildId) ?? null
      : null;
  const directRightNode =
    currentUserTreeNode && currentUserTreeNode.rightChildId
      ? snapshot.treePreview.find((node) => node.userId === currentUserTreeNode.rightChildId) ?? null
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
  const frozenEscrowDisplay = parseDisplayNumber(escrowBalance).toFixed(2);
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
        <StatCard title="Staked Amount" value={`${displayedPersonalStaked} MGX`} icon="🔒" accent="cyan" />
        <StatCard title="Pending Reward" value={`${displayedPendingStakingReward} MGX`} icon="⭐" accent="gold" />
        <StatCard
          title="Daily Earnings"
          value={stakingDataLoading ? "Loading..." : `${calcDailyEarnings().toFixed(4)} MGX`}
          icon="📈"
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
      packageLevel: featured?.packageLevel ?? treeNode?.packageLevel ?? 1,
      wallet: "account" in (treeNode ?? {}) && treeNode?.account ? `${treeNode.account.slice(0, 6)}...${treeNode.account.slice(-4)}` : "Wallet loading",
      totalEarnings: featured?.totalEarnings ?? "0",
        mgxAllocated: featured?.mgxAllocated ?? "0",
        userActiveBoxId: featured?.userActiveBoxId ?? null,
        joinedLabel: `Member ${userId}`,
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
        nextSnapshot = await refreshSnapshot();
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
                }}>⚠ Risk Disclaimer</div>
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
                  🔗 All operations are governed by audited smart contracts on opBNB.
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

        {/* ── STYLES ── */}
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

        {/* ── NAV ── */}
        <nav className="lp-nav">
          <a href="#" className="lp-logo">
            <img src={logoMark} alt="MGX" />
            Meta<span>Guild</span>X
          </a>
          <ul className="lp-navlinks">
            <li><a href="#lp-how">How it works</a></li>
            <li><a href="#lp-packages">Packages</a></li>
            <li><a href="#lp-roadmap">Roadmap</a></li>
            <li><a href="#lp-token">MGX Token</a></li>
          </ul>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button className="lp-btn-out" type="button" onClick={() => void handleConnectWallet()}>Sign in</button>
            <button className="lp-btn-gold" type="button" onClick={() => void handleConnectWallet()}>Launch App →</button>
          </div>
        </nav>

        {/* ── HERO ── */}
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
                      }}>✓ Verified</div>
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
              The Future of<br/>
              <span className="lp-h1-gold">Decentralized</span>{" "}
              <span className="lp-h1-cyan">Income</span>
            </h1>
            <p className="lp-sub">Every registration automatically distributes USDT across 10 levels of your network — instantly, transparently, and forever on-chain.</p>
            <div className="lp-acts">
              {referralSponsorId ? (
                <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>
                  Register with Sponsor #{referralSponsorId} →
                </button>
              ) : (
                <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>Start Earning →</button>
              )}
              <a href="#lp-how" className="lp-btn-hero-out">How it works</a>
            </div>
          </div>
          <div className="lp-scroll-hint">
            <span>Scroll</span>
            <div className="lp-scroll-line"></div>
          </div>
        </div>

        {/* ── TICKER ── */}
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

        {/* ── HOW IT WORKS ── */}
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
                ["#2EC48F","Level income (L1–L10)","40%"],
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

        {/* ── PACKAGES ── */}
        <section className="lp-section" id="lp-packages">
          <div className="lp-lbl">Package tiers</div>
          <h2 className="lp-stitle">Choose your entry level</h2>
          <p className="lp-sdesc">10 package tiers with doubling rewards. Start at $10 and scale up to $5,120.</p>
          <div className="lp-pkg-grid">
            {[
              {pkg:1,amt:10,desc:"Entry level · All features",feats:["$4.60 direct income","Level income eligible","Auto-upgrade enabled","MGX staking access"],hot:false},
              {pkg:2,amt:20,desc:"2× income potential",feats:["$9.20 direct income","Higher level earnings","Rebirth eligible","Priority placement"],hot:true},
              {pkg:3,amt:40,desc:"4× income potential",feats:["$18.40 direct income","Deep level penetration","Enhanced cashback","Bonus xSlot cycles"],hot:false},
              {pkg:4,amt:80,desc:"8× income potential",feats:["$36.80 direct income","Network multiplier","Token engine bonus","Max level benefits"],hot:false},
              {pkg:5,amt:160,desc:"Elite · $160–$5,120",feats:["Up to $2,355 direct","Elite network status","Maximum earnings","All bonuses unlocked"],hot:false},
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

        {/* ── ROADMAP ── */}
        <div className="lp-rm-wrap" id="lp-roadmap">
          <div className="lp-rm-inner">
            <div className="lp-lbl">Roadmap</div>
            <h2 className="lp-stitle">Building the future of<br/>decentralized finance</h2>
            <p className="lp-sdesc">MetaGuildX ecosystem expansion — from community platform to full metaverse.</p>
            <div className="lp-rm-track">
              <div className="lp-rm-line"></div>
              <div className="lp-rm-items">
                {[
                  {icon:"🏗️",title:"C&B Platform",sub:"Community Building",tag:"done",label:"Live ✓"},
                  {icon:"🪙",title:"MGX Token",sub:"Token Launch",tag:"done",label:"Live ✓"},
                  {icon:"🏦",title:"MGX Staking",sub:"Stake & Earn Rewards",tag:"done",label:"Live ✓"},
                  {icon:"🖼️",title:"NFT Creation",sub:"NFT Minting Platform",tag:"active",label:"In Progress"},
                  {icon:"🏪",title:"NFT Marketplace",sub:"Buy, Sell & Trade",tag:"soon",label:"Coming Soon"},
                  {icon:"⚡",title:"MGX DEX",sub:"Decentralized Exchange",tag:"soon",label:"Coming Soon"},
                  {icon:"🎮",title:"Gaming Platform",sub:"Play-to-Earn Games",tag:"soon",label:"Coming Soon"},
                  {icon:"🌐",title:"Metaverse",sub:"Virtual World & Helping",tag:"soon",label:"Future"},
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
          </div>
        </div>
        <div className="lp-sep"></div>

        {/* ── FEATURES ── */}
        <section className="lp-section" id="lp-features">
          <div className="lp-lbl">Platform features</div>
          <h2 className="lp-stitle">Built for transparency<br/>and performance</h2>
          <div className="lp-feat-grid">
            {[
              ["◈","UUPS Upgradeable Proxy","OpenZeppelin v5 with ERC-7201 namespaced storage. Contracts upgrade safely without disrupting user funds."],
              ["⬡","Binary placement tree","Smart queue of 1000 positions. Overflow users auto-place on the opposite side for balanced network growth."],
              ["⟳","Auto-upgrade engine","Escrow accumulates toward your next package. When threshold is hit, the contract upgrades automatically."],
              ["✦","Rebirth mechanism","Complete Package 1 cycle and re-enter the network on the opposite side — unlocking a fresh income cycle."],
              ["◎","MGX staking rewards","Stake MGX tokens and earn 10.95% APY. Rewards distribute every 24 hours from the 10.23M MGX reward pool."],
              ["⊞","Cashback pool","4% of every registration flows to the cashback pool, distributed proportionally to qualifying members."],
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

        {/* ── MGX TOKEN ── */}
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
                {[["Staking APY","10.95%"],["Reward cycle","24 hours"],["Reward pool","10.23M MGX"],["Network","opBNB"]].map(([l,v])=>(
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
                <circle cx="100" cy="100" r="70" fill="none" stroke="#C9A84C" strokeWidth="28" strokeDasharray="439.8 537.2" strokeDashoffset="0"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#2E6FD8" strokeWidth="28" strokeDasharray="195.5 781.5" strokeDashoffset="-439.8"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#2EC48F" strokeWidth="28" strokeDasharray="195.5 781.5" strokeDashoffset="-635.3"/>
                <circle cx="100" cy="100" r="70" fill="none" stroke="#1A4B8C" strokeWidth="28" strokeDasharray="146.6 830.4" strokeDashoffset="-830.8"/>
              </svg>
              <div className="lp-legend">
                {[["#C9A84C","Staking rewards","45%"],["#2E6FD8","Team & development","20%"],["#2EC48F","Community & ecosystem","20%"],["#1A4B8C","Reserve","15%"]].map(([c,n,p])=>(
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

        {/* ── CTA ── */}
        <div className="lp-cta-outer">
          <div className="lp-cta-box">
            <img src={logoMark} alt="MetaGuildX" className="lp-cta-logo" />
            <h2>Ready to start earning?</h2>
            <p>Join the MetaGuildX network and build real passive income on-chain.</p>
            <div className="lp-cta-acts">
              <button className="lp-btn-hero-gold" type="button" onClick={() => void handleConnectWallet()}>Connect Wallet →</button>
              <a href="#lp-how" className="lp-btn-hero-out">Learn more</a>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="lp-footer">
          <div className="lp-ft-top">
            <div>
              <div className="lp-ft-logo-r">
                <img src={logoMark} alt="MGX" className="lp-ft-logo" />
                <div className="lp-ft-name">Meta<span>Guild</span>X</div>
              </div>
              <div className="lp-ft-tag">Decentralized multi-level income on opBNB blockchain.</div>
            </div>
            <div className="lp-ft-links">
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Platform</div>
                <ul><li><a href="#">Dashboard</a></li><li><a href="#">Register</a></li><li><a href="#">Staking</a></li><li><a href="#">Network tree</a></li></ul>
              </div>
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Resources</div>
                <ul><li><a href="#">Documentation</a></li><li><a href="#">Smart contracts</a></li><li><a href="#">Whitepaper</a></li><li><a href="#">Support</a></li></ul>
              </div>
              <div className="lp-ft-col">
                <div className="lp-ft-ct">Legal</div>
                <ul><li><a href="#">Terms of service</a></li><li><a href="#">Privacy policy</a></li><li><a href="#">Risk disclaimer</a></li></ul>
              </div>
            </div>
          </div>
          <div className="lp-ft-bot">
            <span>© 2026 MetaGuildX. All rights reserved.</span>
            <div className="lp-socials">
              <a href="#" className="lp-soc">𝕏</a>
              <a href="#" className="lp-soc">tg</a>
              <a href="#" className="lp-soc">dc</a>
              <a href="#" className="lp-soc">yt</a>
            </div>
          </div>
        </footer>

        {/* ── STAR GENERATOR SCRIPT ── */}
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
                <span style={{fontSize:".7rem",color:"#C9A84C",fontWeight:600}}>{`User #${snapshot.userId}`}</span>
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
              {mobileNavOpen ? "✕" : "☰"}
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
              <img src="/mgx-logo.png" alt="MGX" onError={(e) => { e.currentTarget.style.display='none'; }} />
              <div className="dashboard-sidebar-logo-text">
                <span>MetaGuildX</span>
                <span>
                  {snapshot?.walletAddress
                    ? `${snapshot.walletAddress.slice(0,6)}...${snapshot.walletAddress.slice(-4)}`
                    : "Dashboard"}
                </span>
              </div>
            </div>

            {/* Nav Items */}
            <nav className="dashboard-sidebar-nav">
              {[
                { key: "overview",  icon: "🏠", label: "Home" },
                { key: "income",    icon: "💰", label: "Earnings" },
                { key: "network",   icon: "🌐", label: "Network" },
                { key: "upgrade",   icon: "⬆️", label: "Upgrade" },
                { key: "rebirth",   icon: "♻️", label: "Rebirth" },
                { key: "wallet",    icon: "👛", label: "Wallet" },
                { key: "support",   icon: "🎧", label: "Support" },
                { key: "profile",   icon: "👤", label: "My Profile" },
                { key: "settings",  icon: "⚙️", label: "Settings" },
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
            <img src={logoMark} alt="MetaGuildX logo" className="brand-mark" />
            <div className="brand-copy">
              <strong>MetaGuildX Dashboard</strong>
              <span className="brand-wallet-text" title={snapshot.walletAddress ?? "Wallet pending"}>
                {snapshot.walletAddress ? `${snapshot.walletAddress.slice(0, 6)}...${snapshot.walletAddress.slice(-4)}` : "Wallet pending"}
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
                dashboardView === "support" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("support")}
            >
              <p className="text-lg font-semibold"><span className="nav-icon">🎧</span> Support</p>
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
              <p className="text-lg font-semibold"><span className="nav-icon">⚙️</span> Settings</p>
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
          <section className="panel dashboard-intro dashboard-view w-full max-w-full">
            <p className="section-label">Home</p>
            <div className="dashboard-hero-row">
              <div>
                <h2>{snapshot.userId ? `Welcome back, User #${snapshot.userId}` : "Welcome back"}</h2>
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
                  ✕
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
          </section>

          {!isAdminRoute && dashboardView === "overview" ? (
            <section className="panel dashboard-preview dashboard-view w-full max-w-full">
              <div className="overview-layout flex flex-col gap-4 w-full max-w-full">
                <div className="overview-row overview-row-primary grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-full">
                  <article className="section-card premium-panel dashboard-home-card">
                    <div className="section-card-header">
                      <div className="dashboard-card-title-stack">
                        <span className="section-badge blue">Earnings Summary</span>
                      </div>
                      <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Home")} disabled={isLoading}>
                        ↻
                      </button>
                    </div>
                    <div className="section-card-body dashboard-home-body">
                      {showDashboardSkeleton ? (
                        renderSkeletonRows(3)
                      ) : (
                        <>
                          <div className="income-row dashboard-summary-row"><span className="income-label">Direct Income</span><span className="income-amount">${directIncomeDisplay}</span></div>
                          <div className="income-row dashboard-summary-row"><span className="income-label">Level Income</span><span className="income-amount">${levelIncomeDisplay}</span></div>
                          <div className="income-row dashboard-summary-row"><span className="income-label">Frozen</span><span className="income-amount">${frozenEscrowDisplay}</span></div>
                          <div className="dashboard-summary-total">
                            <span>Total</span>
                            <strong>{`$${totalReceivedDisplay}`}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </article>

                  <article className="section-card premium-panel dashboard-home-card">
                    <div className="section-card-header">
                      <span className="section-badge blue">My Tree</span>
                    </div>
                    <div className="section-card-body dashboard-home-body">
                      {showDashboardSkeleton ? (
                        <>
                          {renderSkeletonRows(6)}
                          <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-gray-700/50" />
                        </>
                      ) : (
                        <>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Direct Left</span><span className={`income-amount ${directLeftNode ? "" : "text-amber"}`}>{directLeftNode ? `User #${directLeftNode.userId}` : "Empty slot"}</span></div>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Direct Right</span><span className={`income-amount ${directRightNode ? "" : "text-amber"}`}>{directRightNode ? `User #${directRightNode.userId}` : "Empty slot"}</span></div>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Level Left</span><span className="income-amount">{snapshot.levelTreeLeft ?? 0}</span></div>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Level Right</span><span className="income-amount">{snapshot.levelTreeRight ?? 0}</span></div>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Total Team</span><span className="income-amount">{totalTeamLabel}</span></div>
                          <div className="income-row dashboard-tree-row"><span className="income-label">Left | Right</span><span className="income-amount">{snapshot.leftBranchNodes} | {snapshot.rightBranchNodes}</span></div>
                          <button
                            type="button"
                            className="btn-primary-large mt-4 dashboard-tree-cta"
                            onClick={() => setDashboardView("network")}
                          >
                            View Full Tree
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </section>
          ) : null}

          {dashboardView === "network" || dashboardView === "tree" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Network</p>
              <div className="summary-strip referrals-summary-strip premium-network-stats w-full max-w-full" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
                  <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Direct Referrals</span>
                  <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.2rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{snapshot.directReferrals}</strong>
                </article>
                <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
                  <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Total Team</span>
                  <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.2rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{totalTeamLabel}</strong>
                </article>
                <article className="summary-chip premium-network-card" style={{minWidth:0,overflow:"hidden"}}>
                  <span style={{fontSize:".68rem",color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Left | Right</span>
                  <strong style={{fontFamily:"Syne,sans-serif",fontSize:"1.1rem",fontWeight:700,color:"var(--text-primary)",display:"block"}}>{snapshot.leftBranchNodes} | {snapshot.rightBranchNodes}</strong>
                </article>
                <article className="summary-chip premium-network-card team-business">
                  <span>📊 Team Business</span>
                  <strong>${teamBusinessDisplay}</strong>
                </article>
              </div>

              <div className="dashboard-subtabs-shell">
                <div className="dashboard-subtabs">
                  {([
                    ["referrals", "Referrals"],
                    ["tree", "Tree"],
                    ["incomelog", "Income Log"]
                  ] as const).map(([tabId, label]) => (
                    <button
                      key={tabId}
                      type="button"
                      className={`dashboard-subtab ${networkDashTab === tabId ? "active" : ""}`}
                      onClick={() => setNetworkDashTab(tabId)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className={`dashboard-subtab-content ${networkDashTab === "tree" ? "is-tree" : ""}`}>
                  {networkDashTab === "referrals" ? (
                    <div className="referrals-layout">
                      <article className="section-card referral-card-link premium-panel">
                        <div className="section-card-header">
                          <h3 className="section-card-title">Share Your Link</h3>
                        </div>
                        <div className="section-card-body premium-share-card">
                          <div className="referral-link-box">
                            <input
                              className="referral-link-input"
                              value={referralLink ?? "Connect wallet to generate your referral link"}
                              readOnly
                              aria-label="Referral link"
                              title={referralLink ?? "Connect wallet to generate link"}
                            />
                            <button
                              type="button"
                              className="referral-copy-btn"
                              onClick={handleCopyReferralLink}
                              disabled={!referralLink}
                            >
                              <span aria-hidden="true">✦</span>
                              <span>Copy</span>
                            </button>
                            <button
                              type="button"
                              className="referral-share-btn share-wa"
                              onClick={() => handleShareReferralLink("whatsapp")}
                              disabled={!referralLink}
                              aria-label="Share on WhatsApp"
                            >
                              WA
                            </button>
                            <button
                              type="button"
                              className="referral-share-btn share-tg"
                              onClick={() => handleShareReferralLink("telegram")}
                              disabled={!referralLink}
                              aria-label="Share on Telegram"
                            >
                              TG
                            </button>
                            <button
                              type="button"
                              className="referral-share-btn share-x"
                              onClick={() => handleShareReferralLink("twitter")}
                              disabled={!referralLink}
                              aria-label="Share on X"
                            >
                              X
                            </button>
                          </div>
                          {referralCopyStatus ? <p className="copy-status-text">{referralCopyStatus}</p> : null}
                        </div>
                      </article>

                      <article className="section-card premium-panel">
                        <div className="section-card-header">
                          <h3 className="section-card-title">Direct Referrals</h3>
                        </div>
                        <div className="section-card-body overflow-x-auto">
                          <table className="referrals-table min-w-full divide-y divide-gray-800 text-left text-sm">
                            <thead className="text-gray-400">
                              <tr>
                                <th className="referrals-col-user">#</th>
                                <th className="referrals-col-user">User</th>
                                <th className="referrals-col-package">Package</th>
                                <th className="referrals-col-joined">Joined</th>
                                <th className="referrals-col-income">Income</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/70">
                              {userReferralRows.length > 0 ? userReferralRows.map((node, index) => (
                                <tr key={`network-referral-${node.userId}`} className="referrals-data-row">
                                  <td className="referrals-col-user">{index + 1}</td>
                                  <td className="referrals-col-user referral-cell-strong"><span className="referral-user-pill">{`#${node.userId}`}</span></td>
                                  <td className="referrals-col-package"><span className="referral-pkg-pill">{`Pkg ${node.packageLevel}`}</span></td>
                                  <td className="referrals-col-joined"><span className="referral-joined-muted">{node.joinedLabel}</span></td>
                                  <td className={`referrals-col-income ${parseDisplayNumber(node.income) > 0 ? "referral-income-positive" : "referral-income-zero"}`}>${parseDisplayNumber(node.income).toFixed(2)}</td>
                                </tr>
                              )) : (
                                <tr><td colSpan={5} className="py-6 text-center text-gray-500">No direct referrals yet</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    </div>
                  ) : null}

                  {networkDashTab === "tree" ? (
                    <div className="network-tree-shell">
                      <div className="dashboard-tree-mode-bar">
                        <button
                          type="button"
                          onClick={() => setTreeMode("personal")}
                          className={`dashboard-subtab ${treeMode === "personal" ? "active" : ""}`}
                        >
                          Personal Tree
                        </button>
                        <button
                          type="button"
                          onClick={() => setTreeMode("level")}
                          className={`dashboard-subtab ${treeMode === "level" ? "active" : ""}`}
                        >
                          Level Tree
                        </button>
                      </div>
                      <Suspense fallback={<section className="panel"><p>Loading tree view...</p></section>}>
                        <div className="dashboard-tree-scroll">
                          {treeMode === "level" && (snapshot.directReferrals ?? 0) === 0 ? (
                            <div className="section-card-body empty-state">
                              <p>No referrals yet. Invite someone to see your Level Tree.</p>
                            </div>
                          ) : (
                            <LazyTreePanel
                              snapshot={snapshot}
                              treePreview={activeTreePreview}
                              treeLevels={treeLevels}
                              selectedTreeUserId={selectedTreeUserId}
                              setSelectedTreeUserId={setSelectedTreeUserId}
                              selectedTreeNode={selectedTreeNode}
                              selectedTreePath={selectedTreePath}
                              selectedTreeParent={selectedTreeParent}
                              selectedTreeChildren={selectedTreeChildren}
                              selectedTreeDetails={treeMode === "personal" ? selectedTreeDetails : null}
                              selectedFeaturedUser={selectedFeaturedUser}
                              leftBranchNodes={leftBranchNodes}
                              rightBranchNodes={rightBranchNodes}
                              isLoadingTreeDetails={treeMode === "personal" ? isLoadingTreeDetails : isLoadingLevelTree}
                              treeLabel={treeMode === "personal" ? "Tree" : "Level Tree"}
                              treeTitle={treeMode === "personal" ? "Binary Tree View" : "Level Tree View"}
                              treeDescription={
                                treeMode === "personal"
                                  ? "Root stays centered. Left and right child slots stay visible for at least three levels."
                                  : "Eligible users are shown in the same pyramid layout. Open slots stay visible for at least three levels."
                              }
                              emptyStateText={treeMode === "personal" ? "No tree nodes loaded yet." : "No level tree available."}
                              showEventHistory={false}
                            />
                          )}
                        </div>
                      </Suspense>
                    </div>
                  ) : null}

                  {networkDashTab === "incomelog" ? (
                    <article className="section-card premium-panel">
                      <div className="section-card-header">
                        <h3 className="section-card-title">Income Log</h3>
                      </div>
                      <div className="section-card-body">
                        <ul className="metric-list compact progress-list">
                          {networkBonusHistoryRows.length > 0 ? networkBonusHistoryRows.map((item) => (
                            <li key={`network-log-${item.txHash}`}>
                              <strong>{item.fromUserId ? `From User #${item.fromUserId}` : "Rebirth network"}</strong> � {item.dateLabel}<br />
                              <span className="text-secondary">{`Amount: $${item.amount}`}</span>
                            </li>
                          )) : <li>No network income log yet.</li>}
                        </ul>
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {dashboardView === "income" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Earnings</p>
              <div className="stats-grid premium-earnings-strip">
                <article className="stat-card premium-earnings-stat"><p className="stat-card-label">Direct Income</p><p className="stat-card-value">${directIncomeDisplay}</p></article>
                <article className="stat-card premium-earnings-stat"><p className="stat-card-label">Level Income</p><p className="stat-card-value">${levelIncomeDisplay}</p></article>
                <article className="stat-card premium-earnings-stat" title="Display only — Network activity"><p className="stat-card-label">Crossline Income</p><p className="stat-card-value">${networkBonusDisplay}</p></article>
                <article className="stat-card premium-earnings-total"><p className="stat-card-label">Total Earned</p><p className="stat-card-value">${totalReceivedDisplay}</p></article>
              </div>

              <div className="dashboard-subtabs-shell">
                <div className="dashboard-subtabs">
                  {([
                    ["overview", "Overview"],
                    ["levels", "Levels"],
                    ["boxcross", "Box & Cross"],
                    ["activity", "Activity"]
                  ] as const).map(([tabId, label]) => (
                    <button
                      key={tabId}
                      type="button"
                      className={`dashboard-subtab ${earningsDashTab === tabId ? "active" : ""}`}
                      onClick={() => setEarningsDashTab(tabId)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="dashboard-subtab-content">
                  {earningsDashTab === "overview" ? (
                    <article className="section-card premium-panel">
                      <div className="section-card-header">
                        <h3 className="section-card-title">My Earnings</h3>
                        <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Earnings")} disabled={isLoading}>
                          ? Refresh
                        </button>
                      </div>
                      <div className="section-card-body">
                        {showDashboardSkeleton ? (
                          renderSkeletonRows(6)
                        ) : (
                          <>
                            <div className="income-row premium-income-row"><span className="income-label">Direct Income</span><span className="income-amount">${directIncomeDisplay}</span></div>
                            <div className="income-row premium-income-row"><span className="income-label">Level Income</span><span className="income-amount">${levelIncomeDisplay}</span></div>
                            <div className="income-row premium-income-row total"><span className="income-label">Total Earned</span><span className="income-amount">${totalReceivedDisplay}</span></div>
                            <div className="income-row premium-income-row muted"><span className="income-label">Frozen (Auto-Upgrade)</span><span className="income-amount">${frozenEscrowDisplay}</span></div>
                            <div className="income-row income-row-secondary" title="Display only � Network activity">
                              <span className="income-label">Crossline (Display)</span>
                              <span className="income-amount">${networkBonusDisplay}</span>
                            </div>
                            <div className="income-row premium-income-row amber">
                              <span className="income-label">Spillover (Display)</span>
                              <span className="income-amount">${spilloverIncomeDisplay}</span>
                            </div>
                            <p className="premium-income-note">Network activity record only.</p>
                          </>
                        )}
                      </div>
                    </article>
                  ) : null}

                  {earningsDashTab === "levels" ? (
                    <article className="section-card premium-panel">
                      <div className="section-card-header">
                        <h3 className="section-card-title">Level Income Breakdown</h3>
                      </div>
                      <div className="section-card-body">
                        <div className="levels-summary-card premium-levels-summary">
                          <div className="levels-summary-line">
                            <span>Active Levels:</span>
                            <strong className="premium-level-pill">{activeLevelsCount} / 10</strong>
                          </div>
                          <div className="levels-summary-line">
                            <span>Direct Referrals:</span>
                            <strong>{snapshot.directReferrals}</strong>
                          </div>
                          <div className="levels-summary-line">
                            <span>Unlock Rule:</span>
                            <strong>{referralGoalLabel}</strong>
                          </div>
                        </div>
                        <div className="levels-status-grid compact-level-grid mt-4">
                          {visibleLevelBreakdownRows.map((row) => {
                            const levelSummary = userLevelSummaryRows.find((candidate) => candidate.levelNumber === row.level);
                            const isUnlocked = levelSummary?.isUnlocked ?? false;
                            const hasIncome = parseDisplayNumber(row.amount) > 0;
                            return (
                              <article
                                key={`income-level-${row.level}`}
                                className={`level-status-card ${!isUnlocked ? "level-status-card-locked" : hasIncome ? "level-status-card-active" : "level-status-card-info"}`}
                              >
                                <strong>{`L${row.level}`}</strong>
                                <span className={`level-status-badge ${isUnlocked ? (hasIncome ? "active" : "info") : "locked"}`}>
                                  {!isUnlocked ? "Locked" : hasIncome ? "Active" : "Ready"}
                                </span>
                                <span className="level-status-members">{row.members} {row.members === 1 ? "member" : "members"}</span>
                                <span className="level-status-rate">${parseDisplayNumber(row.amount).toFixed(2)}</span>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  ) : null}

                  {earningsDashTab === "boxcross" ? (
                    <div className="income-layout">
                      <article className="section-card premium-panel">
                        <div className="section-card-header">
                          <h3 className="section-card-title text-yellow-400">Box Earnings</h3>
                        </div>
                        <div className="section-card-body space-y-2">
                          <p className="text-xs text-gray-400">Income by package cycle</p>
                          {Object.entries(boxEarningsDisplay).map(([slot, amount]) => (
                            <div
                              key={`box-earnings-${slot}`}
                              className="box-earnings-row"
                            >
                              <div className="box-earnings-left">
                                <span className="box-earnings-badge">
                                  {slot}
                                </span>
                                <span className="text-sm text-gray-300">{`Box ${slot}`}</span>
                                <span className="box-earnings-pkg">{`Pkg ${slot}`}</span>
                              </div>
                              <strong className="font-semibold text-cyan-400">{`$${amount}`}</strong>
                            </div>
                          ))}
                          {Object.keys(boxEarningsDisplay).length === 0 ? (
                            <div className="py-4 text-center text-sm text-gray-500">No box earnings yet</div>
                          ) : null}
                        </div>
                      </article>

                      <article className="section-card premium-panel">
                        <div className="section-card-header">
                          <h3 className="section-card-title" title="Display only � Network activity">Crossline Income</h3>
                        </div>
                        <div className="section-card-body">
                          <p className="text-secondary">Display only � Network activity.</p>
                          <ul className="metric-list compact progress-list mt-4">
                            {networkBonusHistoryRows.length > 0 ? networkBonusHistoryRows.map((item) => (
                              <li key={`crossline-${item.txHash}`}>
                                <strong>{item.fromUserId ? `From User #${item.fromUserId} (rebirth network)` : "Rebirth network"}</strong> � {item.dateLabel}<br />
                                <span className="text-secondary">{`Amount: $${item.amount}`}</span>
                              </li>
                            )) : <li>No crossline income yet.</li>}
                          </ul>
                        </div>
                      </article>
                    </div>
                  ) : null}

                  {earningsDashTab === "activity" ? (
                    <article className="section-card premium-panel">
                      <div className="section-card-header">
                        <h3 className="section-card-title">Recent Activity</h3>
                      </div>
                      <div className="section-card-body">
                        <ul className="metric-list compact progress-list">
                          {recentActivityRows.length > 0 ? recentActivityRows.slice(0, 5).map((item, index) => (
                            <li key={`recent-income-${item.blockNumber ?? "na"}-${item.primary}-${item.secondary}-${index}`}>
                              <strong>{item.primary}</strong> · {item.timestampLabel ?? "Live"}<br />
                              <span className="text-secondary">{item.secondary}</span>
                            </li>
                          )) : <li>No activity yet.</li>}
                        </ul>
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {dashboardView === "referrals" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Referrals</p>
              <div className="summary-strip referrals-summary-strip flex flex-wrap gap-2 w-full max-w-full">
                <article className="summary-chip">
                  <span>Total Direct Referrals</span>
                  <strong>{snapshot.directReferrals}</strong>
                </article>
                <article className="summary-chip">
                  <span>Total Team Business</span>
                  <strong>${snapshot.totalTeamBusiness}</strong>
                </article>
              </div>
              <div className="referrals-layout">
                <article className="section-card referral-card-link">
                  <div className="section-card-header">
                    <h3 className="section-card-title">Your Referral Link</h3>
                  </div>
                  <div className="section-card-body">
                    <div className="referral-link-box">
                      <input
                        className="referral-link-input"
                        value={referralLink ?? "Connect wallet to generate your referral link"}
                        readOnly
                        aria-label="Referral link"
                        title={referralLink ?? "Connect wallet to generate link"}
                      />
                      <button
                        type="button"
                        className="referral-copy-btn"
                        onClick={handleCopyReferralLink}
                        disabled={!referralLink}
                      >
                        <span aria-hidden="true">✦</span>
                        <span>Copy</span>
                      </button>
                    </div>
                    {referralCopyStatus ? <p className="copy-status-text">{referralCopyStatus}</p> : null}
                  </div>
                </article>
              </div>
              <article className="section-card">
                <div className="section-card-header">
                  <h3 className="section-card-title">Direct Referrals</h3>
                </div>
                <div className="section-card-body overflow-x-auto">
                    <table className="referrals-table min-w-full divide-y divide-gray-800 text-left text-sm">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="referrals-col-user">User ID</th>
                          <th className="referrals-col-wallet referrals-wallet-col">Wallet</th>
                          <th className="referrals-col-package">Package</th>
                          <th className="referrals-col-joined">Joined</th>
                          <th className="referrals-col-income">Your Income</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/70">
                        {userReferralRows.length > 0 ? userReferralRows.map((node) => (
                          <tr key={`referral-${node.userId}`} className="referrals-data-row">
                            <td className="referrals-col-user referral-cell-strong">{`#${node.userId}`}</td>
                            <td className="referrals-col-wallet referrals-wallet-col referral-cell-wallet">{node.wallet}</td>
                            <td className="referrals-col-package">Pkg {node.packageLevel}</td>
                            <td className="referrals-col-joined">{node.joinedLabel}</td>
                            <td className={`referrals-col-income ${parseDisplayNumber(node.income) > 0 ? "referral-income-positive" : "referral-income-zero"}`}>${node.income}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan={5} className="py-6 text-center text-gray-500">No direct referrals yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {dashboardView === "levels" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Level Summary</p>
              <div className="levels-layout">
                <article className="section-card levels-card-main">
                  <div className="section-card-header">
                    <h3 className="section-card-title">Unlock Summary</h3>
                  </div>
                  <div className="section-card-body">
                    <div className="levels-summary-card">
                      <div className="levels-summary-line">
                        <span>Active Levels:</span>
                        <strong>{activeLevelsCount} / 10</strong>
                      </div>
                      <div className="levels-summary-line">
                        <span>Direct Referrals:</span>
                        <strong>{snapshot.directReferrals}</strong>
                      </div>
                      <div className="levels-summary-line">
                        <span>Next unlock at:</span>
                        <strong>{nextUnlockReferralTarget ? `${nextUnlockReferralTarget} referrals` : "All levels unlocked"}</strong>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="section-card levels-card-main">
                  <div className="section-card-header">
                    <h3 className="section-card-title">Level Status Grid</h3>
                  </div>
                  <div className="section-card-body">
                    <div className="levels-status-grid">
                      {userLevelSummaryRows.map((row) => (
                        <article
                          key={`level-summary-${row.levelNumber}`}
                          className={`level-status-card ${row.isUnlocked ? "level-status-card-active" : "level-status-card-locked"}`}
                        >
                          <strong>{`Level ${row.levelNumber}`}</strong>
                          <span className={`level-status-badge ${row.isUnlocked ? "active" : "locked"}`}>
                            {row.isUnlocked ? "✅ Active" : "🔒 Locked"}
                          </span>
                          <span className="level-status-rate">4%</span>
                        </article>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="section-card levels-card-side">
                  <div className="section-card-header">
                    <h3 className="section-card-title">Unlock Rules</h3>
                  </div>
                  <div className="section-card-body">
                    <ul className="metric-list">
                      <li>1 referral = 2 levels unlocked</li>
                      <li>5 referrals = all 10 levels unlocked</li>
                    </ul>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {dashboardView === "rebirth" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Rebirth</p>
              <div className="space-y-6">
                <article className="section-card premium-panel border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="section-card-header border-b border-gray-800">
                    <h3 className="section-card-title text-yellow-400">Rebirth Status</h3>
                  </div>
                  <div className="section-card-body space-y-5">
                    <div className="rebirth-status-banner">
                      <div>
                        <p className="rebirth-status-eyebrow">Rebirth Cycle Status</p>
                        <h4 className="rebirth-status-title">
                          {snapshot.rebirthCount > 0 ? "Rebirth Triggered" : "Rebirth Charging"}
                        </h4>
                        <p className="rebirth-status-copy">
                          {snapshot.rebirthCount > 0
                            ? "Your next earning identity is active and ready to grow with its own tree and rewards."
                            : "Keep filling your Package 1 journey to unlock the next rebirth slot with a fresh earning identity."}
                        </p>
                      </div>
                      <span className={`rebirth-status-pill ${snapshot.rebirthCount > 0 ? "is-success" : "is-waiting"}`}>
                        {snapshot.rebirthCount > 0 ? "ACTIVE" : "IN PROGRESS"}
                      </span>
                    </div>

                    <div className="rebirth-status-grid">
                      <div className="rebirth-status-metric">
                        <p className="rebirth-status-metric-label">Total Rebirths</p>
                        <p className="rebirth-status-metric-value">{snapshot.rebirthCount}</p>
                      </div>
                      <div className="rebirth-status-metric">
                        <p className="rebirth-status-metric-label">Current Status</p>
                        <p className={`rebirth-status-metric-value ${snapshot.rebirthCount > 0 ? "is-success" : "is-waiting"}`}>
                          {rebirthStatusLabel}
                        </p>
                      </div>
                    </div>

                    <div className="rebirth-progress-shell">
                      <div className="rebirth-progress-meta">
                        <div>
                          <p className="text-sm font-semibold text-yellow-400">xSlot Progress</p>
                          <p className="mt-1 text-sm text-gray-300">Current cycle progress toward the next rebirth trigger.</p>
                        </div>
                        <span className="rebirth-progress-pill">
                          xSlot {rebirthProgressStep} / 5
                        </span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-950">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-500"
                          style={{ width: `${rebirthProgressPercent}%` }}
                        />
                      </div>
                      <div className="rebirth-context-badges">
                        <span className="rebirth-context-badge">{`Current Package: ${snapshot.packageLevel ? `Pkg ${snapshot.packageLevel}` : "Pending"}`}</span>
                        <span className="rebirth-context-badge">{`Current Box: ${snapshot.currentBoxId ?? 1}`}</span>
                        <span className="rebirth-context-badge is-bright">{rebirthProgressLabel}</span>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="section-card premium-panel border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="section-card-header border-b border-gray-800">
                    <h3 className="section-card-title text-yellow-400">My Rebirth IDs</h3>
                  </div>
                  <div className="section-card-body">
                    {selectedRebirthId ? (
                      <div className="rebirth-subdash rebirth-subdash-shell">
                        <div className="rebirth-subdash-header">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRebirthId(null);
                              setRebirthDashView("earnings");
                            }}
                            className="rebirth-back-btn"
                          >
                            ? Back
                          </button>
                          <div className="rebirth-subdash-headline">
                            <span className="rebirth-detail-badge">ACTIVE ID</span>
                            <h2 className="rebirth-subdash-title">{`Rebirth ID #${selectedRebirthId}`}</h2>
                          </div>
                        </div>

                        <div className="rebirth-stats-row">
                          {[
                            { label: "Package", value: selectedRebirthRow ? `Pkg ${selectedRebirthRow.packageLevel}` : "Pkg 1", icon: "📦" },
                            { label: "Direct Income", value: `$${rebirthNodeDetails?.directIncome ?? "0"}`, cyan: true, icon: "💰" },
                            { label: "Level Income", value: `$${rebirthNodeDetails?.levelIncome ?? "0"}`, cyan: true, icon: "📊" },
                            { label: "Total Team", value: String((rebirthNodeDetails?.leftBranchNodes ?? 0) + (rebirthNodeDetails?.rightBranchNodes ?? 0)), icon: "👥" },
                            { label: "Direct Referrals", value: String(rebirthNodeDetails?.directReferrals ?? 0), icon: "🤝" },
                            {
                              label: "Total Earnings",
                              value: `$${
                                rebirthNodeDetails
                                  ? (
                                      parseFloat(rebirthNodeDetails.directIncome ?? "0") +
                                      parseFloat(rebirthNodeDetails.levelIncome ?? "0")
                                    ).toFixed(2)
                                  : "0"
                              }`,
                              gold: true,
                              icon: "🏆"
                            },
                            ...(rebirthNodeDetails && parseDisplayNumber(rebirthNodeDetails.mgxAllocated) > 0
                              ? [
                                  {
                                    label: "MGX Allocated",
                                    value: `${rebirthNodeDetails.mgxAllocated} MGX`,
                                    gold: true,
                                    icon: "MGX"
                                  }
                                ]
                              : [])
                          ].map((stat, index) => (
                            <div key={`rebirth-stat-${index}`} className="rebirth-stat-card">
                              <span className="rebirth-stat-icon" aria-hidden="true">{stat.icon}</span>
                              <span className="rebirth-stat-label">{stat.label}</span>
                              <strong
                                className={`rebirth-stat-value ${
                                  stat.cyan ? "text-cyan" : stat.gold ? "text-gold" : ""
                                }`}
                              >
                                {stat.value}
                              </strong>
                            </div>
                          ))}
                        </div>

                        <div className="rebirth-subdash-tabs">
                          {(["earnings", "tree", "referral"] as const).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setRebirthDashView(tab)}
                              className={`rebirth-tab ${rebirthDashView === tab ? "active" : ""}`}
                            >
                              {tab === "referral" ? "Referral Link" : `${tab.charAt(0).toUpperCase()}${tab.slice(1)}`}
                            </button>
                          ))}
                        </div>

                        <div className="rebirth-subdash-content">
                          {rebirthDashView === "earnings" ? (
                            <>
                              <div className="rebirth-earnings-grid">
                                {[
                                  { label: "Direct Income", value: rebirthNodeDetails?.directIncome ?? "0", money: true },
                                  { label: "Level Income", value: rebirthNodeDetails?.levelIncome ?? "0", money: true },
                                  { label: "Left Team", value: String(rebirthNodeDetails?.leftBranchNodes ?? 0) },
                                  { label: "Right Team", value: String(rebirthNodeDetails?.rightBranchNodes ?? 0) }
                                ].map((item, index) => (
                                  <div key={`rebirth-earnings-${index}`} className="rebirth-income-card">
                                    <span>{item.label}</span>
                                    <strong className={item.money ? "text-cyan" : ""}>
                                      {item.money ? `$${item.value}` : item.value}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                              <div className="section-card mt-4">
                                <div className="section-card-header">
                                  <h3 className="section-card-title">Auto-Upgrade Escrow</h3>
                                </div>
                                <div className="section-card-body">
                                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-medium text-white">🔐 Auto-Upgrade Escrow</span>
                                      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                                        {`xSlot ${rebirthXSlotStep} / 5`}
                                      </span>
                                    </div>
                                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-600"
                                        style={{ width: `${Math.min(rebirthEscrowProgress, 100)}%` }}
                                      />
                                    </div>
                                    <div className="mt-2 text-right text-xs font-medium text-cyan-300">
                                      {`${rebirthEscrowProgress.toFixed(1)}%`}
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                      <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                                        <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Frozen</span>
                                        <span className="mt-1 block text-sm font-semibold text-cyan-300">{`$${rebirthFrozenAmount.toFixed(2)}`}</span>
                                      </div>
                                      <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                                        <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Needed</span>
                                        <span className="mt-1 block text-sm font-semibold text-white">{`$${rebirthNeededAmount.toFixed(2)}`}</span>
                                      </div>
                                      <div className="rounded-xl border border-white/8 bg-black/10 px-3 py-2">
                                        <span className="block text-xs uppercase tracking-[0.18em] text-gray-400">Package</span>
                                        <span className="mt-1 block text-sm font-semibold text-white">{`Pkg ${rebirthPkgLevel}`}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="section-card mt-4">
                                <div className="section-card-header">
                                  <h3 className="section-card-title">Box Earnings</h3>
                                </div>
                                <div className="section-card-body">
                                  {Object.keys(rebirthBoxEarningsByPkg).length > 0 ? (
                                    <div className="space-y-3">
                                      {Object.entries(rebirthBoxEarningsByPkg)
                                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                                        .map(([pkg, amount]) => (
                                          <div key={`rebirth-box-${pkg}`} className="income-row premium-income-row">
                                            <span className="income-label">{`Box 1 � Pkg ${pkg}`}</span>
                                            <span className="income-amount">{`$${Number(amount).toFixed(2)}`}</span>
                                          </div>
                                        ))}
                                    </div>
                                  ) : (
                                    <div className="py-2 text-sm text-gray-500">No box earnings yet</div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : null}

                          {rebirthDashView === "tree" ? (
                            <Suspense
                              fallback={
                                <div className="text-center text-gray-400 py-8">
                                  Loading tree...
                                </div>
                              }
                            >
                              <LazyTreePanel
                                key={`rebirth-tree-${selectedRebirthId}`}
                                snapshot={snapshot}
                                treePreview={rebirthTreePreview}
                                selectedTreeUserId={selectedRebirthId}
                                setSelectedTreeUserId={setSelectedRebirthId}
                                selectedTreeNode={
                                  rebirthTreePreview.find((node) => node.userId === selectedRebirthId) ?? null
                                }
                                selectedTreePath={[]}
                                selectedTreeParent={null}
                                selectedTreeChildren={[]}
                                selectedTreeDetails={rebirthNodeDetails}
                                selectedFeaturedUser={null}
                                leftBranchNodes={[]}
                                rightBranchNodes={[]}
                                isLoadingTreeDetails={isLoadingRebirthDetails}
                                treeLabel="Rebirth Tree"
                                treeTitle={`Rebirth Tree: User ${selectedRebirthId}`}
                                treeDescription="Earns independently from original ID."
                                emptyStateText="No rebirth tree data."
                                initialRootId={selectedRebirthId}
                                disableRootSync={true}
                                showEventHistory={false}
                              />
                            </Suspense>
                          ) : null}

                          {rebirthDashView === "referral" ? (
                            <div className="rebirth-referral-section">
                              <p className="text-secondary mb-3">
                                {`Share this link to add members under Rebirth ID #${selectedRebirthId}`}
                              </p>
                              <div className="referral-link-row">
                                <input
                                  readOnly
                                  className="referral-link-input"
                                  value={
                                    typeof window !== "undefined"
                                      ? `${window.location.origin}/?ref=${selectedRebirthId ?? ""}`
                                      : ""
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn-primary-large"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      `${window.location.origin}/?ref=${selectedRebirthId ?? ""}`
                                    )
                                  }
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : rebirthRows.length > 0 ? (
                      <div className="rebirth-id-grid">
                        {rebirthRows.map((row) => {
                          const rebirthReferralLink =
                            typeof window !== "undefined"
                              ? `${window.location.origin}/?ref=${row.userId}`
                              : "Wallet unavailable";
                          const isRebirthIncomeLoading = !rebirthIncomeByUserId[row.userId];

                          return (
                            <article key={`rebirth-${row.rebirthId}`} className="rebirth-id-card premium">
                              <div className="rebirth-id-card-top">
                                <div className="rebirth-id-copy">
                                  <div className="rebirth-id-header">
                                    <span className="rebirth-id-badge">{`Rebirth ID #${row.rebirthId}`}</span>
                                    <span className="rebirth-package-chip">{row.packageLabel}</span>
                                  </div>
                                  <p className="rebirth-id-wallet" title={row.wallet}>
                                    {row.wallet === "Same wallet" ? row.wallet : `${row.wallet.slice(0, 6)}...${row.wallet.slice(-4)}`}
                                  </p>
                                </div>
                                <span className="rebirth-live-pill">
                                  {row.status}
                                </span>
                              </div>

                              <div className="rebirth-id-body">
                                <div className="rebirth-income-stack">
                                  <span className="rebirth-income-label">Total Earned</span>
                                  <p className="rebirth-income-value">
                                    {isRebirthIncomeLoading ? (
                                      <span className="text-gray-500">Loading...</span>
                                    ) : (
                                      <>
                                        <span className="rebirth-currency">$</span>
                                        {(
                                          parseFloat(row.directIncome ?? "0") +
                                          parseFloat(row.levelIncome ?? "0")
                                        ).toFixed(2)}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="rebirth-link-shell">
                                  <p className="rebirth-link-label">Referral Link</p>
                                  <div className="rebirth-link-row">
                                    <input
                                      className="referral-link-input flex-1"
                                      value={rebirthReferralLink}
                                      readOnly
                                      aria-label={`Rebirth referral link for user ${row.rebirthId}`}
                                      title={rebirthReferralLink}
                                    />
                                    <button
                                      type="button"
                                      className="rebirth-link-copy-btn"
                                      onClick={() =>
                                        void handleCopyRebirthReferralLink(String(row.userId))
                                      }
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="rebirth-id-actions">
                                <button
                                  type="button"
                                  className="rebirth-id-view-btn"
                                  onClick={() => {
                                    setSelectedRebirthId(Number(row.rebirthId));
                                    setRebirthDashView("earnings");
                                  }}
                                >
                                  View Details
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-700 bg-gray-800/40 px-6 py-10 text-center">
                        <p className="text-lg font-semibold text-yellow-400">No rebirth IDs yet</p>
                        <p className="mt-2 text-sm text-gray-300">Complete the Package 1 five-cycle journey to unlock your next rebirth.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="section-card border border-gray-700 bg-gray-900/90 shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="section-card-header border-b border-gray-800">
                    <h3 className="section-card-title text-yellow-400">How Rebirth Works</h3>
                  </div>
                  <div className="section-card-body">
                    <ul className="space-y-3 text-sm text-gray-200">
                      <li><span className="text-cyan-400">�</span> Rebirth triggers after completing the Package 1 five-cycle journey.</li>
                      <li><span className="text-cyan-400">�</span> Your rebirth ID uses the same wallet but starts fresh as a new earning identity.</li>
                      <li><span className="text-cyan-400">�</span> Original and rebirth IDs continue earning independently inside the same ecosystem.</li>
                      <li><span className="text-cyan-400">�</span> Use the tree viewer above to inspect each rebirth ID�s placement and live income progress.</li>
                    </ul>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {dashboardView === "wallet" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Wallet</p>
                            {walletSubView === "transfer" ? (
                <div className="transfer-container">
                  <div className="transfer-header">
                    <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
                      &larr; Back
                    </button>
                    <h3>Transfer</h3>
                  </div>

                  <div className="transfer-section">
                    <label className="transfer-label">FROM</label>
                    <div className="transfer-source">
                      <div className="source-icon">MGX</div>
                      <div className="source-info">
                        <span className="source-name">{transferFromLabel}</span>
                        <span className="source-balance">Balance: {transferFromBalance} MGX</span>
                      </div>
                    </div>
                  </div>

                  <div className="transfer-arrow">→</div>

                  <div className="transfer-section">
                    <label className="transfer-label">TO</label>
                    <div className="transfer-destination">
                      <div className="dest-icon">WAL</div>
                      <div className="dest-info">
                        <span className="dest-name">{transferToLabel}</span>
                        <span className="dest-address">{shortWalletAddress}</span>
                      </div>
                    </div>
                  </div>

                  <div className="transfer-section">
                    <label className="transfer-label">AMOUNT</label>
                    <div className="amount-input-row">
                      <input
                        type="number"
                        className="amount-input"
                        placeholder="0"
                        value={walletMoveAmount}
                        onChange={(event) => setWalletMoveAmount(event.target.value)}
                        inputMode="decimal"
                      />
                      <button
                        type="button"
                        className="btn-max"
                        onClick={() => setWalletMoveAmount(displayedMgxAllocated)}
                      >MAX</button>
                    </div>
                    <span className="transfer-token-label">MGX</span>
                    <span className="source-balance">Balance: {displayedMgxAllocated} MGX</span>
                  </div>

                    <button
                      type="button"
                      className="btn-transfer-submit"
                      disabled={
                        isLoading ||
                        !snapshot.walletAddress ||
                        !snapshot.userId ||
                        Number(walletMoveAmount) <= 0
                      }
                      onClick={() => {
                        setStatus("Withdraw is not available in this deployment yet.");
                        setActionFeedback({
                          title: "Withdraw action is not live yet",
                          detail: "This UI is ready, but the current deployment does not expose a public internal-wallet withdraw function."
                        });
                      }}
                    >
                      Transfer Now
                    </button>
                </div>
              ) : walletSubView === "mgxboxes" ? (
                <div className="wallet-screen">
                  <div className="wallet-screen-header">
                    <button type="button" className="secondary-button" onClick={() => setWalletSubView("main")}>
                      &larr; Back
                    </button>
                    <h2>MGX Allocation</h2>
                  </div>

                  <div className="wallet-total-balance mgx-allocation-hero">
                    <div className="balance-label">Total Balance</div>
                    <div className="mgx-allocation-hero-ring">
                      <div className="balance-amount-large">{totalMgxAllocatedDisplay} MGX</div>
                      <div className="balance-usd">{`� $${totalMgxAllocatedDisplay}`}</div>
                    </div>
                  </div>

                  <div className="inner-balance-section mgx-allocation-grid">
                    <div className="inner-balance-header">Inner Balance</div>
                    {mgxAllocationRows.map((row) => (
                      <div className="balance-row-item mgx-allocation-card" key={row.id}>
                        <div className="token-icon-circle mgx">
                          MGX
                          <span className="box-number">{row.id}</span>
                        </div>
                        <div className="token-info">
                          <span className="token-name">{`Box ${row.id}`}</span>
                          <span className="token-sub">Available for withdrawal</span>
                          <span className="mgx-allocation-status">Available</span>
                        </div>
                        <div className="token-amount-right">
                          <span className="amount-main">{row.amount} MGX</span>
                          <span className="amount-sub">{`� $${row.usdApprox}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="wallet-screen-button-stack">
                    <button
                      type="button"
                      className="wallet-action-btn-full mgx-withdraw-btn"
                      disabled={parseDisplayNumber(displayedMgxAllocated) <= 0}
                      onClick={() => {
                        setStatus("Withdraw is not available in this deployment yet.");
                        setActionFeedback({
                          title: "Withdraw action is not live yet",
                          detail: "This UI is ready, but the current deployment does not expose a public internal-wallet withdraw function."
                        });
                      }}
                    >
                      Withdraw All MGX
                    </button>
                  </div>
                </div>
              ) : walletSubView === "stakingclaim" ? (
                <div className="wallet-screen">
                  <div className="wallet-screen-header">
                    <button type="button" className="secondary-button" onClick={() => setWalletSubView("main")}>
                      &larr; Back
                    </button>
                    <h2>Staking Rewards</h2>
                  </div>

                  <StakingSummary />

                  <div className="wallet-staking-cards" style={{marginBottom:"1rem"}}>
                    <article className="dashboard-card action-card wallet-staking-card wallet-staking-premium-card">
                      <div className="section-header">
                        <span className="section-badge purple">STAKING POSITION</span>
                        <button type="button" className="btn-refresh-reward" onClick={handleRefreshRewards} disabled={isLoading || !snapshot.walletAddress}>
                          Refresh
                        </button>
                      </div>
                      {displayedStakePositions.length > 0 ? (
                        <div className="stake-position-list compact wallet-staking-position-list">
                          {displayedStakePositions.map((position) => (
                            <article key={`rewards-position-${position.index}`} className="stake-position-item compact wallet-staking-position-card">
                              <div className="stake-position-item-header">
                                <strong>{`Position ${position.index + 1}`}</strong>
                                <span>{position.lockDurationLabel}</span>
                              </div>
                              <div className="stake-position-inline">
                                <span className="stake-position-inline-chip">{`Staked: ${position.amount} MGX`}</span>
                                <span className="stake-position-inline-chip reward">{`Pending: ${position.pendingReward} MGX`}</span>
                                <span className="stake-position-inline-chip">{`Started: ${position.startDateLabel}`}</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="no-stake-state wallet-staking-empty">
                          <span>No staking positions yet</span>
                        </div>
                      )}
                    </article>
                  </div>

                  <div className="wallet-screen-button-stack">
                    <button
                      type="button"
                      className="wallet-action-btn-full green"
                      disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                      onClick={() =>
                        runWalletAction(
                          () => metaguildx.claimReward(displayedPendingStakingReward, rewardWindowReady),
                          "Claiming staking reward...",
                          "Reward claimed",
                          (_nextSnapshot, result) => ({
                            title: "Reward claimed successfully",
                            detail: `Successfully claimed ${result.claimedReward} MGX.`
                          })
                        )
                      }
                    >
                      Claim Reward
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn-full blue"
                      disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                      onClick={() =>
                        runWalletAction(
                          () => metaguildx.compoundReward(),
                          "Compounding reward...",
                          "Reward compounded",
                          () => ({
                            title: "Reward compounded",
                            detail: "The available staking reward has been added back into your position."
                          })
                        )
                      }
                    >
                      Compound Reward
                    </button>
                  </div>
                </div>
              ) : walletSubView === "stake" ? (
                <div className="staking-container wallet-staking-layout">
                  <div className="wallet-staking-header">
                    <button type="button" className="secondary-button wallet-staking-back" onClick={() => setWalletSubView("main")}>
                      &larr; Back to Wallet
                    </button>
                    <strong className="wallet-staking-title">Staking</strong>
                  </div>

                  <div className="wallet-staking-cards">
                    <article className="dashboard-card action-card wallet-staking-card wallet-staking-premium-card">
                      <div className="wallet-staking-action-grid">
                        <button
                          type="button"
                          className="btn-stake-action wallet-staking-action-btn"
                          onClick={() => setWalletSubView("stake")}
                        >
                          Add More Stake
                        </button>
                        <button
                          type="button"
                          className="btn-stake-action wallet-staking-action-btn is-claim"
                          disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                          onClick={() =>
                            runWalletAction(
                              () => metaguildx.claimReward(displayedPendingStakingReward, rewardWindowReady),
                              "Claiming staking reward...",
                              "Reward claimed",
                              (_nextSnapshot, result) => ({
                                title: "Reward claimed successfully",
                                detail: `Successfully claimed ${result.claimedReward} MGX.`
                              })
                            )
                          }
                        >
                          Claim Reward
                        </button>
                        <button
                          type="button"
                          className="btn-stake-action wallet-staking-action-btn is-compound"
                          disabled={isLoading || !snapshot.walletAddress || !hasClaimableReward}
                          onClick={() =>
                            runWalletAction(
                              () => metaguildx.compoundReward(),
                              "Compounding reward...",
                              "Reward compounded",
                              () => ({
                                title: "Reward compounded",
                                detail: "The available staking reward has been added back into your position."
                              })
                            )
                          }
                        >
                          Compound Reward
                        </button>
                        <button
                          type="button"
                          className="btn-stake-action danger wallet-staking-action-btn"
                          disabled={isLoading || !snapshot.walletAddress || !hasWithdrawableStake}
                          onClick={() => setWalletSubView("myStake")}
                        >
                          Withdraw
                        </button>
                      </div>
                    </article>

                    <article className="dashboard-card action-card wallet-staking-card wallet-staking-premium-card">
                      <div className="section-header">
                        <span className="section-badge purple">STAKE MGX</span>
                      </div>
                      <div className="stake-position-card wallet-staking-form-card">
                        <div className="stake-detail-row wallet-staking-available">
                          <span>Available MGX</span>
                          <span className="green">{stakeableMgxAllocated} MGX</span>
                        </div>
                        <div className="transfer-number-card">
                          <span>AMOUNT</span>
                          <div className="transfer-number-row">
                            <input
                              value={stakeForm.amount}
                              onChange={(event) => setStakeForm((current) => ({ ...current, amount: event.target.value }))}
                              inputMode="decimal"
                            />
                            <button
                              type="button"
                              className="transfer-max-button"
                              onClick={() => setStakeForm((current) => ({ ...current, amount: stakeableMgxAllocated }))}
                            >
                              MAX
                            </button>
                            <div className="transfer-token-pill">MGX</div>
                          </div>
                          <p>BALANCE: {stakeableMgxAllocated} MGX</p>
                        </div>
                        <div className="stake-duration-inline premium-stake-duration-grid">
                          {lockPeriods.map((period) => (
                            <label key={period.key} className={`premium-stake-duration-card ${stakeForm.durationKey === period.key ? "selected" : ""}`}>
                              <input
                                type="radio"
                                name="stake-duration-page"
                                checked={stakeForm.durationKey === period.key}
                                onChange={() => setStakeForm((current) => ({ ...current, durationKey: period.key }))}
                              />
                              <span className="premium-stake-duration-title">{period.label}</span>
                              <span className="premium-stake-duration-bonus">{period.bonus}</span>
                            </label>
                          ))}
                        </div>
                        <label className="stake-auto-checkbox premium-stake-toggle">
                          <input
                            type="checkbox"
                            checked={stakeForm.autoCompound}
                            onChange={(event) => setStakeForm((current) => ({ ...current, autoCompound: event.target.checked }))}
                          />
                          <span className="premium-stake-toggle-switch" aria-hidden="true">
                            <span className="premium-stake-toggle-knob" />
                          </span>
                          <span>Enable auto-compound</span>
                        </label>
                        <button
                          type="button"
                          className="btn-primary-large wallet-staking-submit"
                          disabled={isLoading || !snapshot.walletAddress || availableStakeAmount <= 0}
                          onClick={() => {
                            if (!canSubmitStake) {
                              setStatus("Staking could not start. Enter an amount within your available MGX allocation.");
                              setActionFeedback({
                                title: "Not enough available MGX",
                                detail: `You can stake up to ${stakeableMgxAllocated} MGX right now. Reduce the amount and try again.`
                              });
                              return;
                            }

                            isStakePending.current = true;
                            void runWalletAction(
                              () =>
                                metaguildx.stakeTokens({
                                  amount: Number(stakeForm.amount),
                                  durationKey: stakeForm.durationKey,
                                  autoCompound: stakeForm.autoCompound
                                }),
                              "Submitting stake...",
                              "Stake updated",
                              () => ({
                                title: "✅ Stake confirmed",
                                detail: "Position updated"
                              })
                            )
                              .finally(() => {
                                isStakePending.current = false;
                                setStakeForm((current) => ({ ...current }));
                              });
                          }}
                        >
                          Stake Now
                        </button>
                      </div>
                    </article>
                  </div>
                </div>
              ) : walletSubView === "myStake" ? (
                <div className="staking-container">
                  <div className="staking-header">
                    <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
                      &larr; Back
                    </button>
                    <h3>My Staking</h3>
                    <button type="button" className="btn-refresh-reward" onClick={handleRefreshRewards} disabled={isLoading || !snapshot.walletAddress}>
                      Refresh
                    </button>
                  </div>

                  <div className="stake-position-card stake-position-card-premium">
                    <div className="stake-details">
                      <div className="stake-detail-row">
                        <span>Staking Positions</span>
                        <span className="green">{displayedStakePositions.length}</span>
                      </div>
                      <div className="stake-detail-row">
                        <span>Total Pool Staked</span>
                        <span className="green">{asMgx(displayedTotalStaked)}</span>
                      </div>
                    </div>

                    {displayedStakePositions.length > 0 ? (
                      <div className="stake-position-list">
                        {displayedStakePositions.map((position) => (
                          <article key={`stake-position-${position.index}`} className="stake-position-item stake-position-item-premium">
                            <div className="stake-position-item-header">
                              <strong>{`Position ${position.index + 1}`}</strong>
                              <span className="section-badge purple">{position.lockDurationLabel}</span>
                            </div>
                            <div className="stake-position-grid">
                              <div className="stake-stat">
                                <span className="stake-label">Staked</span>
                                <span className="stake-value">{position.amount} MGX</span>
                              </div>
                              <div className="stake-stat">
                                <span className="stake-label">Pending Reward</span>
                                <span className="stake-value green">{position.pendingReward} MGX</span>
                              </div>
                              <div className="stake-stat">
                                <span className="stake-label">Started</span>
                                <span className="stake-value">{position.startDateLabel}</span>
                              </div>
                              <div className="stake-stat">
                                <span className="stake-label">Locked Until</span>
                                <span className="stake-value">{position.unlockDateLabel}</span>
                              </div>
                              <div className="stake-stat">
                                <span className="stake-label">Auto-Compound</span>
                                <span className={`stake-value ${position.autoCompound ? "green" : "dim"}`}>
                                  {position.autoCompound ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </div>
                            <div className="stake-lock-progress">
                              <div className="stake-lock-progress-header">
                                <span>Lock Progress</span>
                                <span>{position.lockProgressPercent.toFixed(3)}% complete</span>
                              </div>
                              <div className="upgrade-progress-bar">
                                <span className="upgrade-progress-fill" style={{ width: `${position.lockProgressPercent}%` }} />
                              </div>
                            </div>
                            <div className="stake-action-grid">
                              <button
                                type="button"
                                className="btn-stake-action is-claim"
                                title={canUseIndexedStakingActions ? undefined : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."}
                                disabled={isLoading || !snapshot.walletAddress || !canUseIndexedStakingActions || parseDisplayNumber(position.pendingReward) <= 0 || !rewardWindowReady}
                                onClick={() =>
                                  runWalletAction(
                                    () => metaguildx.claimReward(position.pendingReward, rewardWindowReady),
                                    "Claiming staking reward...",
                                    "Reward claimed",
                                    (_nextSnapshot, result) => ({
                                      title: "Reward claimed successfully",
                                      detail: `Successfully claimed ${result.claimedReward} MGX.`
                                    })
                                  )
                                }
                              >
                                Claim Reward
                              </button>
                              <button
                                type="button"
                                className="btn-stake-action is-compound"
                                title={canUseIndexedStakingActions ? undefined : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."}
                                disabled={isLoading || !snapshot.walletAddress || !canUseIndexedStakingActions || parseDisplayNumber(position.pendingReward) <= 0}
                                onClick={() =>
                                  runWalletAction(
                                    () => metaguildx.compoundReward(),
                                    "Compounding reward...",
                                    "Reward compounded",
                                    () => ({
                                      title: "Reward compounded",
                                      detail: "The available staking reward has been added back into your position."
                                    })
                                  )
                                }
                              >
                                Compound Reward
                              </button>
                              <button
                                type="button"
                                className="btn-stake-action danger"
                                title={
                                  position.isLocked
                                    ? `Locked until ${position.unlockDateLabel}`
                                    : canUseIndexedStakingActions
                                    ? undefined
                                    : "Indexed staking actions need Core contract wrappers before they can be sent from the dashboard."
                                }
                                disabled={
                                  isLoading ||
                                  !snapshot.walletAddress ||
                                  !canUseIndexedStakingActions ||
                                  position.isLocked ||
                                  parseDisplayNumber(position.amount) <= 0
                                }
                                onClick={() =>
                                  runWalletAction(
                                    () => metaguildx.withdrawStakeTokens({ amount: parseDisplayNumber(position.amount) }),
                                    "Withdrawing staked MGX...",
                                    "Stake withdrawn",
                                    () => ({
                                      title: "Stake withdrawn successfully",
                                      detail: "Your staked MGX has been returned to your available allocation."
                                    })
                                  )
                                }
                              >
                                Withdraw
                              </button>
                            </div>
                            {position.isLocked ? <p className="warning-text">{`This stake is locked until ${position.unlockDateLabel}.`}</p> : null}
                          </article>
                        ))}
                        {!canUseIndexedStakingActions ? (
                          <p className="warning-text">
                            Position-specific claim, compound, and withdraw actions need indexed Core wrappers. The dashboard now shows every position, but on-chain action routing still supports only the legacy combined flow.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="no-stake-state">
                        <span>No active stake</span>
                        <button type="button" className="btn-start-stake" onClick={() => setWalletSubView("stake")}>
                          Start Staking
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : walletSubView === "cashback" ? (
                <div className="staking-container">
                  <div className="staking-header">
                    <button type="button" className="btn-back" onClick={() => setWalletSubView("main")}>
                      &larr; Back to Wallet
                    </button>
                    <h3>Cashback Pool</h3>
                    <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Cashback")} disabled={isLoading}>
                      Refresh
                    </button>
                  </div>

                  <article className="dashboard-card action-card cashback-panel">
                    <div className="section-header">
                      <span className="section-badge orange">CASHBACK POOL</span>
                    </div>
                    <div className="cashback-status-card">
                      <div className="cashback-status-icon">CB</div>
                      <div className="cashback-status-copy">
                        <span className="token-name">Cashback Status</span>
                        <span className="cashback-status-badge">Available after surrender window</span>
                      </div>
                      <div className="token-amount cashback-status-amount">
                        <span className="amount-main">${parseDisplayNumber(snapshot.pendingCashback).toFixed(2)}</span>
                        <span className="amount-sub">{parseDisplayNumber(snapshot.pendingCashback) > 0 ? "Ready" : "No cashback"}</span>
                      </div>
                    </div>
                    <div className="cashback-info-grid">
                      <div className="cashback-info-row">
                        <span>Pool Balance</span>
                        <strong>{`$${snapshot.cashbackPoolBalance}`}</strong>
                      </div>
                      <div className="cashback-info-row">
                        <span>Status</span>
                        <strong>{snapshot.surrenderStatus}</strong>
                      </div>
                      <div className="cashback-info-row">
                        <span>Surrender Rule</span>
                        <strong>3 to 6 month window</strong>
                      </div>
                    </div>
                    <div className="cashback-notice-banner">
                      Claim is disabled in the current live deployment.
                    </div>
                    <div className="flex justify-center sm:justify-start">
                      <button type="button" className="btn-primary-large cashback-view-btn w-full sm:w-auto" title="Available after mainnet launch" disabled>
                        View Cashback ?
                      </button>
                    </div>
                    {parseDisplayNumber(snapshot.pendingCashback) === 0 ? (
                      <p className="status-text text-center">No cashback yet</p>
                    ) : null}
                  </article>
                </div>
              ) : (
              <div className="wallet-container">
                <div className="wallet-section balance-section">
                  <div className="section-header">
                    <span className="section-badge blue">CONNECTED WALLET</span>
                    <button type="button" className="btn-refresh-reward" onClick={() => void handleRefreshSection("Wallet")} disabled={isLoading}>
                      ? Refresh
                    </button>
                  </div>
                <div className="wallet-address-row">
                    <div className="wallet-address premium-wallet-address" title={snapshot.walletAddress ?? "Wallet pending"}>
                      <div className="premium-wallet-address-copy">
                        <span className="premium-wallet-address-label">Connected Wallet</span>
                        <span>{shortWalletAddress}</span>
                      </div>
                      <button type="button" className="premium-wallet-copy-btn" onClick={handleCopyWalletAddress} disabled={!snapshot.walletAddress}>Copy</button>
                    </div>
                    <button type="button" className="btn-disconnect" onClick={handleLogout} disabled={isLoading}>
                      Disconnect
                    </button>
                  </div>
                  <div className="wallet-total-balance wallet-total-balance-premium">
                    <span className="balance-label">Total Balance</span>
                    <span className={`balance-amount ${parseFloat(connectedWalletTotalDisplay) > 0 ? "is-positive" : ""}`}>${connectedWalletTotalDisplay}</span>
                  </div>
                  <div className="wallet-action-buttons premium-action-grid" style={{gridTemplateColumns:"repeat(2,1fr)",maxWidth:500,margin:"0 auto",gap:12}}>
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("mgxboxes"); }}>
                      <span className="premium-action-icon">💎</span>
                      <span className="premium-action-title">Inner Wallet</span>
                      <span className="premium-action-subtitle">Transfer earnings to wallet</span>
                    </button>
                    <button
                      type="button"
                      className="btn-action premium-action-card"
                      onClick={() => {
                        setDashboardView("wallet");
                        setWalletSubView("stakingclaim");
                      }}
                    >
                      <span className="premium-action-icon">🎁</span>
                      <span className="premium-action-title">Reward Wallet</span>
                      <span className="premium-action-subtitle">Claim platform rewards</span>
                    </button>
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("stake"); }}>
                      <span className="premium-action-icon">🔒</span>
                      <span className="premium-action-title">Staking</span>
                      <span className="premium-action-subtitle">Stake MGX tokens</span>
                      {parseDisplayNumber(displayedPersonalStaked) > 0 ? (
                        <span className="premium-action-badge">{`${displayedPersonalStaked} MGX staked`}</span>
                      ) : null}
                    </button>
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("cashback"); }}>
                      <span className="premium-action-icon">💰</span>
                      <span className="premium-action-title">Cashback Pool</span>
                      <span className="premium-action-subtitle">View cashback status</span>
                    </button>
                  </div>
                </div>

                <div className="wallet-section balance-section premium-balance-section">
                  <div className="section-header">
                    <span className="section-badge orange">INNER BALANCE</span>
                    <span className="section-sub">Platform earnings and managed balances</span>
                  </div>
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon">ESC</div>
                    <div className="token-info">
                      <span className="token-name">Frozen (Auto-Upgrade)</span>
                      <span className="token-sub">Current package escrow</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">${frozenEscrowDisplay}</span>
                    </div>
                  </div>
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon mgx-icon">MGX</div>
                    <div className="token-info">
                      <span className="token-name">MGX Staked</span>
                      <span className="token-sub">Active staking positions</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{displayedPersonalStaked}</span>
                      <span className="amount-sub">MGX</span>
                    </div>
                  </div>
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon mgx-icon">MGX</div>
                    <div className="token-info">
                      <span className="token-name">MGX Allocated (Total)</span>
                      <span className="token-sub">Primary + rebirth allocations</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{displayedTotalMgxAllocated}</span>
                      <span className="amount-sub">MGX</span>
                    </div>
                  </div>
                </div>

                <div className="wallet-section escrow-section premium-balance-section">
                  <div className="section-header">
                    <span className="section-badge blue">WALLET BALANCE</span>
                    <span className="section-sub">{shortWalletAddress}</span>
                  </div>
                  {isConnectedWalletLoading ? <p className="status-text">Loading connected wallet assets...</p> : null}
                  {snapshot.connectedWalletAssetsError ? (
                    <p className="warning-text">Unable to load wallet assets right now. Please try again.</p>
                  ) : null}
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon">USDT</div>
                    <div className="token-info">
                      <span className="token-name">USDT</span>
                      <span className="token-sub">External wallet balance</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main amount-main-highlight">{outerUsdtBalanceDisplay}</span>
                      <span className="amount-sub">USDT</span>
                    </div>
                  </div>
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon">BNB</div>
                    <div className="token-info">
                      <span className="token-name">opBNB Gas</span>
                      <span className="token-sub">Native gas balance</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{opBnbGasDisplay}</span>
                      <span className="amount-sub">BNB</span>
                    </div>
                  </div>
                  <div className="balance-row premium-balance-row">
                    <div className="token-icon mgx-icon">MGX</div>
                    <div className="token-info">
                      <span className="token-name">MGX</span>
                      <span className="token-sub">Available MGX</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{mgxAvailableDisplay}</span>
                      <span className="amount-sub">MGX</span>
                    </div>
                  </div>
                </div>

                <div className="wallet-section balance-section">
                  <div className="section-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
                    <span className="section-badge blue">Recent Wallet Activity</span>
                    <button type="button" className="btn-refresh-reward" onClick={() => void handleLoadMoreHistory()} disabled={isConnectedWalletHistoryLoading}>
                      {isConnectedWalletHistoryLoading ? "Loading..." : "↻ Refresh"}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {connectedWalletHistoryRows.length > 0 ? (
                      connectedWalletHistoryRows.slice(0, 10).map((row) => (
                        <div key={row.hash} className="tx-row">
                          <div>
                            <div className="income-label">{row.type}</div>
                            <div className="income-sublabel">{row.date}</div>
                          </div>
                          <div className="text-right">
                            <div className="token-amount">{row.amount}</div>
                            <div className="token-usd">{row.status}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <p className="empty-state-text">No transaction history available yet.</p>
                      </div>
                    )}
                    {snapshot.connectedWalletHistoryError ? <p className="warning-text">{snapshot.connectedWalletHistoryError}</p> : null}
                  </div>
                </div>
              </div>
              )}
            </section>
          ) : null}

          {dashboardView === "upgrade" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Upgrade</p>
              <div className="dashboard-card action-card upgrade-premium-card upgrade-journey-shell">
                <div className="upgrade-card-header">
                  <span className="upgrade-card-icon">↑</span>
                  <div>
                    <h3>Package Upgrade</h3>
                    <p className="upgrade-card-path">
                      {snapshot.packageLevel ? `Pkg ${snapshot.packageLevel}` : "Not active"} <span>→</span> {nextUpgradeLevel ? `Pkg ${nextUpgradeLevel}` : "Maximum"}
                    </p>
                  </div>
                </div>
                <div className="upgrade-journey-summary">
                  <span className="upgrade-journey-label">Your Upgrade Journey</span>
                  <p className="upgrade-journey-copy">
                    Track every milestone from Pkg 1 through Pkg 10 and see exactly where your next upgrade unlock sits.
                  </p>
                </div>
                <div className="upgrade-journey-grid">
                  {upgradeMilestones.map((milestone) => {
                    const isCompleted = milestone.fromPkg < userPackageLevel;
                    const isActive = milestone.fromPkg === userPackageLevel;
                    const isLocked = milestone.fromPkg > userPackageLevel;
                    const isMaxMilestone = milestone.toPkg === "MAX";
                    const milestoneCostLabel = isMaxMilestone ? "Final tier" : `$${milestone.cost.toFixed(2)}`;

                    return (
                      <article
                        key={`upgrade-milestone-${milestone.fromPkg}`}
                        className={`upgrade-milestone-card ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""} ${isLocked ? "locked" : ""} ${isMaxMilestone ? "max-milestone" : ""}`}
                      >
                        <div className="upgrade-milestone-head">
                          <div className="upgrade-milestone-title-wrap">
                            <span className="upgrade-milestone-icon" aria-hidden="true">
                              {isCompleted ? "✅" : isActive ? "⚡" : "🔒"}
                            </span>
                            <div>
                              <h4>{`Pkg ${milestone.fromPkg} → ${typeof milestone.toPkg === "number" ? `Pkg ${milestone.toPkg}` : milestone.toPkg}`}</h4>
                              {isCompleted ? <p className="upgrade-milestone-subtitle success">Completed</p> : null}
                              {isLocked ? (
                                <>
                                  <p className="upgrade-milestone-subtitle muted">Complete previous to unlock</p>
                                  <p className="upgrade-milestone-cost">{`Cost: ${milestoneCostLabel}`}</p>
                                </>
                              ) : null}
                              {isActive && isMaxMilestone ? <p className="upgrade-milestone-subtitle success">You are already at the highest package tier.</p> : null}
                            </div>
                          </div>
                          <span className={`upgrade-milestone-badge ${isCompleted ? "done" : ""} ${isActive ? "active" : ""} ${isLocked ? "locked" : ""}`}>
                            {isCompleted ? "✅ DONE" : isActive ? "⚡ Active" : "🔒 LOCKED"}
                          </span>
                        </div>

                        {isCompleted ? (
                          <div className="upgrade-milestone-complete">
                            <div className="upgrade-milestone-meta">
                              <span className="upgrade-milestone-meta-label">✅ Upgraded</span>
                              <span className="upgrade-milestone-cost">{`Cost Paid: ${milestoneCostLabel}`}</span>
                            </div>
                            <div className="upgrade-milestone-progress" aria-hidden="true">
                              <span className="upgrade-milestone-progress-fill" style={{ width: "100%" }} />
                            </div>
                            <div className="upgrade-milestone-meta">
                              <span className="upgrade-milestone-complete-copy">Milestone Complete! 🎉</span>
                              <span className="upgrade-milestone-percent">100%</span>
                            </div>
                          </div>
                        ) : null}

                        {isActive && !isMaxMilestone ? (
                          <>
                            <div className="info-card upgrade-progress-card premium-upgrade-progress-card">
                              <div className="upgrade-progress-bar" aria-hidden="true">
                                <span className="upgrade-progress-fill" style={{ width: `${upgradeProgressPercent.toFixed(0)}%` }} />
                              </div>
                              <span className="upgrade-progress-percent">Progress: {upgradeProgressPercent.toFixed(0)}%</span>
                              <div className="upgrade-progress-stats premium-upgrade-stats">
                                <div className="premium-upgrade-stat">
                                  <span>Frozen</span>
                                  <strong>${frozenEscrowDisplay}</strong>
                                </div>
                                <div className="premium-upgrade-stat">
                                  <span>Need</span>
                                  <strong>${upgradeNeedDisplay}</strong>
                                </div>
                                <div className="premium-upgrade-stat">
                                  <span>Left</span>
                                  <strong>${upgradeRemainingDisplay}</strong>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-primary-large premium-upgrade-btn"
                              disabled={isLoading || !canUpgradeCurrentPackage}
                              onClick={() =>
                                runWalletAction(
                                  () =>
                                    metaguildx.upgradeUserPackage({
                                      userId: snapshot.userId ?? 0,
                                      newPackageLevel: nextUpgradeLevel ?? 0
                                    }),
                                  "Upgrading package...",
                                  "Package upgraded",
                                  (nextSnapshot) => ({
                                    title: `Package ${nextUpgradeLevel ?? "-"} upgraded successfully`,
                                    detail: `Your current package is now ${nextSnapshot.packageLevel ? `Package ${nextSnapshot.packageLevel}` : "updated"}. Running box: Box ${nextSnapshot.currentBoxId} at $${nextSnapshot.currentBoxPrice}.`
                                  })
                                )
                              }
                            >
                              ⬆ Upgrade Now
                            </button>
                          </>
                        ) : null}

                        {isActive && isMaxMilestone ? <div className="upgrade-max-state">🏆 You're at Maximum Package Level!</div> : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

          {dashboardView === "cashback" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Cashback</p>
              <div className="summary-strip flex flex-wrap gap-2 w-full max-w-full">
                <article className="summary-chip">
                  <span>Surrender Status</span>
                  <strong>{snapshot.surrenderStatus}</strong>
                </article>
                <article className="summary-chip">
                  <span>Pending Cashback</span>
                  <strong>${snapshot.pendingCashback}</strong>
                </article>
                <article className="summary-chip">
                  <span>Cashback Earned</span>
                  <strong>${snapshot.cashbackIncome}</strong>
                </article>
                <article className="summary-chip">
                  <span>Auto Settlement</span>
                  <strong>{snapshot.pendingCashback !== "0" ? "Ready" : "Waiting"}</strong>
                </article>
              </div>

              <div className="dashboard-grid detailed grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full">
                <article className="dashboard-card action-card">
                  <h3>Surrender</h3>
                  <div className="info-card">
                    <strong>Pool Status</strong>
                    <span>Pool Balance: ${snapshot.cashbackPoolBalance}</span>
                    <span>Your Share: ${snapshot.pendingCashback}</span>
                    <span>Status: {snapshot.surrenderStatus}</span>
                    <span>Cashback is reserved for surrendered IDs after the full cycle.</span>
                  </div>
                  <button
                    type="button"
                    title="Available after mainnet launch"
                    disabled
                  >
                    Surrender
                  </button>
                </article>

                <article className="dashboard-card action-card">
                  <h3>Claim Cashback</h3>
                  <ul className="metric-list">
                    <li>Pending cashback: ${snapshot.pendingCashback}</li>
                    <li>Claim status: Available after mainnet launch</li>
                    <li>Escrow balance: ${escrowBalance}</li>
                    <li>Connected wallet value: ${snapshot.connectedWalletValue}</li>
                  </ul>
                  <button
                    type="button"
                    title="Available after mainnet launch"
                    disabled
                  >
                    Claim Cashback
                  </button>
                </article>

                <article className="dashboard-card action-card">
                  <h3>Cashback Notes</h3>
                  <ul className="metric-list">
                    <li>Pool Balance: ${snapshot.cashbackPoolBalance}</li>
                    <li>Surrender Status: {snapshot.surrenderStatus}</li>
                    <li>Surrender window follows 3 to 6 month rules.</li>
                    <li>Claim and surrender buttons are disabled until mainnet launch.</li>
                  </ul>
                </article>
              </div>
            </section>
          ) : null}

          {dashboardView === "profile" && (
            <div className="dashboard-page" style={{ padding: "24px" }}>

              {/* Profile Header Card */}
              <div className="dashboard-card" style={{
                padding: "32px",
                marginBottom: "24px",
                background: "linear-gradient(135deg, rgba(46,111,216,0.15) 0%, rgba(201,168,76,0.08) 100%)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                gap: "24px",
                flexWrap: "wrap",
                position: "relative",
                width: "100%"
              }}>
                {/* Avatar */}
                <div style={{
                  width: "88px", height: "88px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #1a3a6e, #2E6FD8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 0 32px rgba(46,111,216,0.4)",
                  border: "2px solid rgba(201,168,76,0.4)",
                  overflow: "hidden"
                }}>
                  <img
                    src="/mgx-logo.png"
                    alt="MGX"
                    style={{ width: "80px", height: "80px", objectFit: "contain",
                      filter: "drop-shadow(0 0 8px rgba(201,168,76,0.4))" }}
                    onError={e => { e.currentTarget.style.display="none"; }}
                  />
                </div>

                {/* User Info */}
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: "#EEF4FF", marginBottom: "4px" }}>
                    {profileMeta.displayName || `User #${snapshot?.userId || "—"}`}
                  </div>
                  {profileMeta.nickname && (
                    <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
                      @{profileMeta.nickname}
                    </div>
                  )}
                  <div style={{
                    fontSize: "12px", color: "#7EB3FF", marginBottom: "10px",
                    fontFamily: "monospace", display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    {snapshot?.walletAddress
                      ? `${snapshot.walletAddress.slice(0,6)}...${snapshot.walletAddress.slice(-4)}`
                      : "—"}
                    <button
                      id="wallet-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(snapshot?.walletAddress || "");
                        const btn = document.getElementById("wallet-copy-btn");
                        if (btn) { btn.textContent = "✅"; setTimeout(() => { btn.textContent = "📋"; }, 2000); }
                      }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "#C9A84C", fontSize: "13px", padding: "0"
                      }}
                      title="Copy wallet address"
                    >📋</button>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{
                      background: "rgba(76,175,130,0.15)", border: "1px solid rgba(76,175,130,0.4)",
                      borderRadius: "20px", padding: "3px 12px", fontSize: "11px", color: "#4CAF82", fontWeight: 600
                    }}>✅ Verified Member</span>
                    <span style={{
                      background: "rgba(46,111,216,0.15)", border: "1px solid rgba(46,111,216,0.4)",
                      borderRadius: "20px", padding: "3px 12px", fontSize: "11px", color: "#7EB3FF", fontWeight: 600
                    }}>📦 Package {snapshot?.packageLevel || 0}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                  <button
                    className="btn-primary"
                    style={{ padding: "10px 20px", fontSize: "13px", borderRadius: "10px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      const link = `${window.location.origin}?ref=${snapshot?.userId}`;
                      navigator.clipboard.writeText(link);
                    }}
                  >
                    🔗 Copy Referral Link
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      padding: "10px 20px", fontSize: "13px", borderRadius: "10px",
                      background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.35)",
                      color: "#FF6B7A", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,53,69,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(220,53,69,0.12)")}
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>

              {/* Stats Grid — 2×2 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                marginBottom: "24px"
              }}>
                {[
                  { icon: "👥", label: "Direct Referrals", value: String(snapshot?.directReferrals ?? "—"), color: "#7EB3FF" },
                  { icon: "🌐", label: "Total Team", value: String(totalTeamMembers), color: "#7EB3FF" },
                  {
                    icon: "💰", label: "Total Earnings",
                    value: privacySettings.earnings === "all" ? `$${snapshot?.totalEarnings ?? "0"}` : "🔒 Hidden",
                    color: "#C9A84C"
                  },
                  {
                    icon: "📦", label: "Package Level",
                    value: privacySettings.packageLevel === "all" ? `Level ${snapshot?.packageLevel ?? 0}` : "🔒 Hidden",
                    color: "#C9A84C"
                  }
                ].map((stat, i) => (
                  <div key={i} className="stat-card" style={{
                    textAlign: "center", padding: "24px 16px", borderRadius: "16px"
                  }}>
                    <div style={{ fontSize: "30px", marginBottom: "10px" }}>{stat.icon}</div>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: stat.color, marginBottom: "4px" }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: "12px", color: "#8899BB" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Personal Info Card */}
              <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", width: "100%" }}>
                <h3 style={{ color: "#C9A84C", marginBottom: "20px", fontSize: "15px", fontWeight: 600 }}>
                  📋 Personal Info
                </h3>
                {[
                  { label: "User ID", value: `#${snapshot?.userId || "—"}` },
                  { label: "Sponsor ID", value: `#${snapshot?.sponsorId || "—"}` },
                  {
                    label: "Wallet",
                    value: privacySettings.walletAddress === "all"
                      ? snapshot?.walletAddress || "—"
                      : `${(snapshot?.walletAddress || "").slice(0,6)}...••••`
                  },
                  {
                    label: "Joined",
                    value: snapshot?.joinedAt
                      ? new Date(Number(snapshot.joinedAt) * 1000).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
                      : "—"
                  }
                ].map((row, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 0",
                    borderBottom: i < 3 ? "1px solid rgba(46,111,216,0.12)" : "none"
                  }}>
                    <span style={{ fontSize: "13px", color: "#8899BB" }}>{row.label}</span>
                    <span style={{ fontSize: "13px", color: "#EEF4FF", fontFamily: "monospace" }}>{row.value}</span>
                  </div>
                ))}
              </div>

            </div>
          )}

          {dashboardView === "settings" && (
            <div className="dashboard-page" style={{ padding: "24px" }}>
              <h2 style={{ color: "#EEF4FF", fontSize: "20px", fontWeight: 700, marginBottom: "24px" }}>
                ⚙️ Settings
              </h2>

              <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* === PROFILE SECTION === */}
              <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", marginBottom: "20px", flex: "1 1 340px" }}>
                <h3 style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
                  👤 Profile
                </h3>
                <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
                  Customize how you appear to others
                </p>

                {/* Avatar Upload — Coming Soon */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "20px",
                  padding: "16px 0", borderBottom: "1px solid rgba(46,111,216,0.12)",
                  marginBottom: "20px"
                }}>
                  <div style={{
                    width: "72px", height: "72px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #1a3a6e, #2E6FD8)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid rgba(201,168,76,0.3)", flexShrink: 0,
                    overflow: "hidden"
                  }}>
                    <img
                      src="/mgx-logo.png"
                      alt="MGX"
                      style={{ width: "64px", height: "64px", objectFit: "contain",
                        filter: "drop-shadow(0 0 6px rgba(201,168,76,0.3))" }}
                      onError={e => { e.currentTarget.style.display="none"; }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", color: "#EEF4FF", marginBottom: "4px", fontWeight: 500 }}>
                      Profile Photo
                    </div>
                    <div style={{
                      fontSize: "11px", color: "#8899BB", marginBottom: "8px"
                    }}>
                      Permanent storage — backend integration coming soon
                    </div>
                    <button style={{
                      padding: "7px 16px", borderRadius: "8px", fontSize: "12px",
                      background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)",
                      color: "#C9A84C", cursor: "not-allowed", fontWeight: 500
                    }} disabled>
                      📷 Upload Photo (Coming Soon)
                    </button>
                  </div>
                </div>

                {/* Nickname Input */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
                    Username / Nickname
                  </label>
                  <input
                    type="text"
                    value={profileMeta.nickname}
                    onChange={e => setProfileMeta({ ...profileMeta, nickname: e.target.value })}
                    placeholder="e.g. cryptoking"
                    maxLength={30}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: "10px",
                      background: "rgba(46,111,216,0.08)", border: "1px solid rgba(46,111,216,0.25)",
                      color: "#EEF4FF", fontSize: "14px", outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Display Name Input */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={profileMeta.displayName}
                    onChange={e => setProfileMeta({ ...profileMeta, displayName: e.target.value })}
                    placeholder="e.g. John Smith"
                    maxLength={40}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: "10px",
                      background: "rgba(46,111,216,0.08)", border: "1px solid rgba(46,111,216,0.25)",
                      color: "#EEF4FF", fontSize: "14px", outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Save Button */}
                <button
                  className="btn-primary"
                  style={{ padding: "11px 28px", borderRadius: "10px", fontSize: "14px", fontWeight: 600 }}
                  onClick={() => {
                    saveProfileMeta(profileMeta);
                    setProfileSaved(true);
                    setTimeout(() => setProfileSaved(false), 2500);
                  }}
                >
                  {profileSaved ? "✅ Saved!" : "💾 Save Changes"}
                </button>
              </div>

              {/* === PRIVACY SECTION === */}
              <div className="dashboard-card" style={{ padding: "28px", borderRadius: "16px", marginBottom: "20px", flex: "1 1 340px" }}>
                <h3 style={{ color: "#C9A84C", fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>
                  🔒 Privacy Controls
                </h3>
                <p style={{ color: "#8899BB", fontSize: "13px", marginBottom: "24px" }}>
                  Control what others can see on your public profile
                </p>

                {([
                  { key: "earnings",      label: "💰 Income / Earnings",  desc: "Your total and breakdown earnings" },
                  { key: "referralTree",  label: "🌳 Referral Tree",       desc: "Your downline and network tree" },
                  { key: "packageLevel",  label: "📦 Package Level",       desc: "Your current active package" },
                  { key: "walletAddress", label: "👛 Wallet Address",      desc: "Your full wallet address" }
                ] as const).map((item, i, arr) => (
                  <div key={item.key} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "16px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(46,111,216,0.12)" : "none"
                  }}>
                    <div>
                      <div style={{ fontSize: "14px", color: "#EEF4FF", marginBottom: "3px" }}>{item.label}</div>
                      <div style={{ fontSize: "12px", color: "#8899BB" }}>{item.desc}</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      {(["all", "only_me"] as const).map(opt => (
                        <button
                          key={opt}
                          onClick={() => savePrivacy({ ...privacySettings, [item.key]: opt })}
                          style={{
                            padding: "6px 14px", borderRadius: "20px", fontSize: "12px",
                            fontWeight: 500, cursor: "pointer",
                            border: privacySettings[item.key] === opt
                              ? "1px solid #C9A84C"
                              : "1px solid rgba(255,255,255,0.1)",
                            background: privacySettings[item.key] === opt
                              ? "rgba(201,168,76,0.2)"
                              : "rgba(255,255,255,0.04)",
                            color: privacySettings[item.key] === opt ? "#C9A84C" : "#8899BB",
                            transition: "all 0.2s"
                          }}
                        >
                          {opt === "all" ? "🌐 All Users" : "🔒 Only Me"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>

              {/* Auto-save note */}
              <div style={{
                textAlign: "center", fontSize: "12px", color: "#4CAF82",
                padding: "10px", background: "rgba(76,175,130,0.08)",
                borderRadius: "8px", border: "1px solid rgba(76,175,130,0.2)"
              }}>
                ✅ Privacy settings auto-saved • Profile saved manually
              </div>

            </div>
          )}

          {dashboardView === "support" ? (
            <SupportPage
              userId={snapshot.userId}
              walletAddress={snapshot.walletAddress}
            />
          ) : null}

          {dashboardView === "register" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Register</p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "16px",
                width: "100%"
              }}>
                <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
                  <h3 style={{
                    fontSize: "15px", fontWeight: 700, color: "#C9A84C",
                    marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
                  }}>
                    👤 Sponsor Details
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
                    Enter your sponsor's ID to join their network
                  </p>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", color: "#8899BB", marginBottom: "6px" }}>
                      Sponsor ID
                    </label>
                    {referralSponsorId !== null ? (
                      <div style={{
                        padding: "12px 16px", borderRadius: "10px",
                        background: "rgba(201,168,76,0.08)",
                        border: "1px solid rgba(201,168,76,0.25)",
                        display: "flex", alignItems: "center", gap: "10px"
                      }}>
                        <span style={{ fontSize: "20px" }}>🔒</span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#C9A84C" }}>
                            Sponsor #{referralSponsorId} Locked
                          </div>
                          <div style={{ fontSize: "12px", color: "#8899BB" }}>
                            You were invited by this sponsor
                          </div>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={registerForm.sponsorId}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, sponsorId: event.target.value }))}
                        placeholder="Enter Sponsor ID"
                        min="1"
                        style={{
                          width: "100%", padding: "12px 14px", borderRadius: "10px",
                          background: "rgba(46,111,216,0.08)",
                          border: "1px solid rgba(46,111,216,0.25)",
                          color: "#EEF4FF", fontSize: "14px", outline: "none",
                          boxSizing: "border-box", fontFamily: "inherit"
                        }}
                      />
                    )}
                  </div>
                  {referralSponsorId !== null && referralSponsorProfile ? (
                    <div style={{
                      padding: "12px 16px", borderRadius: "10px",
                      background: "rgba(46,111,216,0.06)",
                      border: "1px solid rgba(46,111,216,0.2)",
                      display: "flex", alignItems: "center", gap: "12px"
                    }}>
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%",
                        background: "linear-gradient(135deg,rgba(201,168,76,.3),rgba(46,111,216,.2))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, color: "#C9A84C", fontSize: "14px", flexShrink: 0
                      }}>
                        #{referralSponsorId}
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#EEF4FF" }}>
                          User #{referralSponsorId}
                        </div>
                        <div style={{ fontSize: "11px", color: "#8899BB" }}>
                          {referralSponsorProfile.directReferrals} partners · Pkg {referralSponsorProfile.packageLevel}
                        </div>
                        <div style={{
                          marginTop: "4px", display: "inline-flex", alignItems: "center",
                          gap: "4px", padding: "2px 8px",
                          background: "rgba(46,196,143,.1)", border: "1px solid rgba(46,196,143,.2)",
                          borderRadius: "4px", fontSize: "11px", color: "#2EC48F"
                        }}>
                          ✓ Verified
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
                  <h3 style={{
                    fontSize: "15px", fontWeight: 700, color: "#C9A84C",
                    marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
                  }}>
                    📦 Package Activation
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
                    Start with Package 1 — upgrade anytime
                  </p>
                  <div style={{
                    padding: "16px", borderRadius: "12px", marginBottom: "16px",
                    background: "linear-gradient(135deg,rgba(201,168,76,.1),rgba(46,111,216,.06))",
                    border: "1px solid rgba(201,168,76,.25)",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "4px" }}>Package Level</div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: "#C9A84C", fontFamily: "Syne,sans-serif" }}>
                        Package 1
                      </div>
                      <div style={{ fontSize: "12px", color: "#7EB3FF", marginTop: "2px" }}>
                        Entry level · All features
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "13px", color: "#8899BB", marginBottom: "4px" }}>Amount</div>
                      <div style={{ fontSize: "26px", fontWeight: 800, color: "#EEF4FF", fontFamily: "Syne,sans-serif" }}>
                        ${snapshot.packagePrices[0] ?? 10}
                      </div>
                      <div style={{ fontSize: "12px", color: "#8899BB" }}>USDT</div>
                    </div>
                  </div>
                  <div style={{ marginBottom: "20px" }}>
                    {[
                      { label: "Direct income", value: "$4.60", color: "#C9A84C" },
                      { label: "Level income", value: "$4.00", color: "#2EC48F" },
                      { label: "Cashback pool", value: "$0.40", color: "#7EB3FF" },
                      { label: "Royalty pool", value: "$1.00", color: "#8899BB" },
                    ].map((row, index) => (
                      <div key={row.label} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: index < 3 ? "1px solid rgba(46,111,216,0.08)" : "none"
                      }}>
                        <span style={{ fontSize: "13px", color: "#8899BB" }}>{row.label}</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {!registrationSummary ? (
                    <button
                      className="btn-primary"
                      style={{
                        width: "100%", padding: "14px",
                        borderRadius: "12px", fontSize: "15px",
                        fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1
                      }}
                      onClick={() => setShowActivationConfirm(true)}
                      disabled={isLoading || !snapshot.walletAddress}
                    >
                      {isLoading ? "⏳ Processing..." : "⚡ Activate Package 1 — $10 USDT"}
                    </button>
                  ) : (
                    <div style={{
                      padding: "14px", borderRadius: "12px", textAlign: "center",
                      background: "rgba(46,196,143,0.1)", border: "1px solid rgba(46,196,143,0.3)",
                      color: "#2EC48F", fontWeight: 700, fontSize: "15px"
                    }}>
                      ✅ Registration Complete!
                    </div>
                  )}
                </div>

                <div className="dashboard-card" style={{ padding: "24px", borderRadius: "16px" }}>
                  <h3 style={{
                    fontSize: "15px", fontWeight: 700, color: "#C9A84C",
                    marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px"
                  }}>
                    📋 How it works
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8899BB", marginBottom: "20px" }}>
                    Registration steps & rules
                  </p>
                  {isLoading && regStep > 0 ? (
                    <div style={{ marginBottom: "20px" }}>
                      {[
                        { step: 1, label: "Approve USDT", icon: "✅" },
                        { step: 2, label: "Confirm Registration", icon: "🔐" },
                        { step: 3, label: "On-chain Processing", icon: "⛓️" },
                        { step: 4, label: "Complete", icon: "🎉" },
                      ].map(({ step, label, icon }) => (
                        <div key={step} style={{
                          display: "flex", alignItems: "center", gap: "12px",
                          padding: "10px 0",
                          borderBottom: step < 4 ? "1px solid rgba(46,111,216,0.08)" : "none",
                          opacity: regStep >= step ? 1 : 0.4
                        }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                            background: regStep >= step ? "rgba(46,196,143,0.15)" : "rgba(46,111,216,0.08)",
                            border: regStep >= step ? "1px solid rgba(46,196,143,0.4)" : "1px solid rgba(46,111,216,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "14px"
                          }}>
                            {regStep >= step ? icon : step}
                          </div>
                          <span style={{
                            fontSize: "13px",
                            color: regStep >= step ? "#EEF4FF" : "#8899BB",
                            fontWeight: regStep >= step ? 600 : 400
                          }}>
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginBottom: "20px" }}>
                      {[
                        { icon: "🔗", text: "Connect MetaMask wallet" },
                        { icon: "💵", text: "Have $10 USDT on opBNB network" },
                        { icon: "✍️", text: "Approve USDT transaction" },
                        { icon: "⛓️", text: "Confirm registration on-chain" },
                        { icon: "🎉", text: "Welcome to MetaGuildX!" },
                      ].map((item, index) => (
                        <div key={item.text} style={{
                          display: "flex", alignItems: "flex-start", gap: "12px",
                          padding: "10px 0",
                          borderBottom: index < 4 ? "1px solid rgba(46,111,216,0.08)" : "none"
                        }}>
                          <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
                          <span style={{ fontSize: "13px", color: "#8899BB", lineHeight: 1.5 }}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {registrationSummary ? (
                    <div style={{
                      padding: "16px", borderRadius: "12px",
                      background: "rgba(46,196,143,0.06)",
                      border: "1px solid rgba(46,196,143,0.2)"
                    }}>
                      <div style={{ fontSize: "13px", color: "#2EC48F", fontWeight: 700, marginBottom: "8px" }}>
                        🎉 Registration Complete
                      </div>
                      <div style={{ fontSize: "12px", color: "#8899BB" }}>
                        Tx: {registrationSummary.txHash?.slice(0, 10)}...
                      </div>
                      <div style={{ fontSize: "12px", color: "#8899BB", marginTop: "4px" }}>
                        Paid: {registrationSummary.paid}
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: "100%", marginTop: "12px", padding: "10px", borderRadius: "10px" }}
                        onClick={() => setDashboardView("overview")}
                      >
                        Go to Dashboard →
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

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





























