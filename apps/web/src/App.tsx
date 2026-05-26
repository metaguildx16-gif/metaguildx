import { Contract, JsonRpcProvider, ethers, formatUnits } from "ethers";
import { Suspense, lazy, startTransition, useEffect, useState } from "react";
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
      Promise.resolve(metaguildx.loadDashboardSnapshot(snapshot.walletAddress))
        .then(setSnapshot)
        .catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(intervalId);
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
          title: `Sponsor detected: ID ${referralSponsorId}`,
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
  const displayedMgxAllocated =
    parseDisplayNumber(snapshot.mgxAllocated) > 0 || !liveWalletStakeState
      ? snapshot.mgxAllocated
      : liveWalletStakeState.mgxAllocated;
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
  const availableStakeAmount = parseDisplayNumber(displayedMgxAllocated);
  const requestedStakeAmount = Number(stakeForm.amount || "0");
  const canSubmitStake = requestedStakeAmount > 0 && requestedStakeAmount <= availableStakeAmount;
  const hasWithdrawableStake = parseDisplayNumber(displayedPersonalStaked) > 0;
  const canUseIndexedStakingActions = displayedStakePositions.length <= 1;
  const primaryStakePosition = displayedStakePositions[0] ?? null;
  const rewardWindowReady = (() => {
    const rewardDebt = primaryStakePosition?.rewardDebt ?? 0n;
    if (!rewardDebt) return false;
    const nextReward = Number(rewardDebt) + 86400;
    return Math.floor(Date.now() / 1000) >= nextReward;
  })();
  const hasClaimableReward =
    parseDisplayNumber(displayedPendingStakingReward) > 0
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
  const mgxWalletBalanceDisplay = parseDisplayNumber(mgxWalletRow?.amount ?? displayedMgxAllocated).toFixed(2);
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

    const nextReward = Number(rewardDebt) + 86400;
    const now = Math.floor(Date.now() / 1000);
    const remaining = nextReward - now;
    if (remaining <= 0) {
      return "Ready to claim";
    }

    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return `${h}h ${m}m ${s}s`;
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
        <StatCard title="Staked Amount" value={`${displayedPersonalStaked} MGX`} icon="?" accent="cyan" />
        <StatCard title="Pending Reward" value={`${displayedPendingStakingReward} MGX`} icon="?" accent="gold" />
        <StatCard
          title="Daily Earnings"
          value={stakingDataLoading ? "Loading..." : `${calcDailyEarnings().toFixed(4)} MGX`}
          icon="?"
          accent="success"
        />
        <StatCard title="Your Share" value={`${stakingSharePercent}%`} icon="?" accent="cyan" badge="LIVE" />
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
      <div className="landing-page">
        <nav className="landing-nav">
          <div className="landing-nav-inner">
            <div className="landing-logo">
              <img src={logoMark} alt="MGX" className="landing-logo-image" />
              <span className="logo-text">MetaGuildX</span>
            </div>

            <div className="landing-nav-links">
              <a href="#how-it-works">How It Works</a>
              <a href="#packages">Packages</a>
              <a href="#income">Income Types</a>
              <a href="#why">Why Us</a>
            </div>

            <button className="btn-connect-nav" type="button" onClick={() => void handleConnectWallet()} disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        </nav>

        <section className="hero-section" id="hero">
          <div className="hero-content">
            <h1 className="hero-title">MetaGuildX Ecosystem</h1>

            <p className="hero-subtitle">
              Earn | Grow | Rebirth | Decentralized Income System
            </p>

            <div className="hero-buttons">
              {referralSponsorId ? (
                <button className="btn-primary-large" type="button" onClick={handleBeginRegistrationFlow} disabled={isLoading || !canStartSignUp}>
                  {isLoading ? "Opening MetaMask..." : "Sign Up"}
                </button>
              ) : (
                <button className="btn-connect-nav" type="button" onClick={() => void handleConnectWallet()} disabled={isLoading}>
                  {isLoading ? "Connecting..." : "Connect Wallet"}
                </button>
              )}
            </div>

            <div className="hero-status">
              <p className="landing-status-text">{status}</p>
              {connectError ? <p className="connect-error">{connectError}</p> : null}
              {snapshot.contractWarning ? <p className="error-text">{snapshot.contractWarning}</p> : null}
              {referralSponsorId ? (
                <div className="register-intro-card">
                  <div className="sponsor-info">
                    <div className="sponsor-label">Referral Link Active</div>
                    <div className="register-intro-grid">
                      <div>
                        <span>Your Upline</span>
                        <strong>{`User ${referralSponsorId}`}</strong>
                      </div>
                      <div>
                        <span>Partners</span>
                        <strong>{sponsorPartnerCount}</strong>
                      </div>
                      <div>
                        <span>Registration</span>
                        <strong>{sponsorRegistrationLabel}</strong>
                      </div>
                    </div>
                    <p className="text-secondary">
                      {referredSponsorPreview
                        ? `Invited by User ${referredSponsorPreview.userId}${"account" in referredSponsorPreview ? ` | ${referredSponsorPreview.account.slice(0, 6)}...${referredSponsorPreview.account.slice(-4)}` : ""} | Package ${referredSponsorPreview.packageLevel}`
                        : "Sponsor preview will load after contract data refresh."}
                    </p>
                  </div>
                  <label className="register-consent-row">
                    <input
                      type="checkbox"
                      checked={registrationConsent.terms}
                      onChange={(event) => setRegistrationConsent((current) => ({ ...current, terms: event.target.checked }))}
                    />
                    <span>I agree to terms of use</span>
                  </label>
                  <label className="register-consent-row">
                    <input
                      type="checkbox"
                      checked={registrationConsent.restrictedCountry}
                      onChange={(event) => setRegistrationConsent((current) => ({ ...current, restrictedCountry: event.target.checked }))}
                    />
                    <span>I am not from restricted countries</span>
                  </label>
                  <p className="text-secondary register-flow-note">
                    Sign Up opens wallet selection first. After wallet connection, the dashboard opens in Not active mode and you can continue with Package 1 activation.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{totalUsers.toLocaleString()}</div>
            <div className="stat-label">Users</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">${totalVolume.toLocaleString()}</div>
            <div className="stat-label">Volume</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">10</div>
            <div className="stat-label">Packages</div>
          </div>
        </section>

        <section className="section-how" id="how-it-works">
          <div className="section-container">
            <div className="landing-page section-label">Simple Process</div>
            <h2 className="landing-page section-title">Start Earning in 3 Steps</h2>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-number">01</div>
                <div className="step-icon">W</div>
                <h3>Connect Wallet</h3>
                <p>Connect MetaMask to OPBNB. No signup. No email. Pure Web3.</p>
              </div>

              <div className="step-card">
                <div className="step-number">02</div>
                <div className="step-icon">P</div>
                <h3>Choose Package</h3>
                <p>Start with just $10 USDT. Auto-upgrade as you earn more.</p>
              </div>

              <div className="step-card">
                <div className="step-number">03</div>
                <div className="step-icon">E</div>
                <h3>Earn Daily</h3>
                <p>Earn from referrals, 10 levels deep, and automatic network growth.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-income" id="income">
          <div className="section-container">
            <div className="landing-page section-label">Multiple Income Streams</div>
            <h2 className="landing-page section-title">How You Earn</h2>

            <div className="income-cards-grid">
              <div className="income-card income-card--direct">
                <div className="income-card-icon">DI</div>
                <h3>Direct Income</h3>
                <div className="income-pct">46%</div>
                <p>Earn 46% of every direct referral's package price, instantly.</p>
              </div>

              <div className="income-card income-card--level">
                <div className="income-card-icon">LI</div>
                <h3>Level Income</h3>
                <div className="income-pct">4% x 10</div>
                <p>Earn 4% across 10 levels deep in your network.</p>
              </div>

              <div className="income-card income-card--upgrade">
                <div className="income-card-icon">AU</div>
                <h3>Auto Upgrade</h3>
                <div className="income-pct">2X</div>
                <p>Earn 2X your package? Auto-upgrade to next level. No action needed.</p>
              </div>

              <div className="income-card income-card--cashback">
                <div className="income-card-icon">CB</div>
                <h3>Cashback Pool</h3>
                <div className="income-pct">4%</div>
                <p>4% of every join goes to cashback pool. Surrender and earn daily.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section-packages" id="packages">
          <div className="section-container">
            <div className="landing-page section-label">Choose Your Level</div>
            <h2 className="landing-page section-title">Investment Packages</h2>
            <p className="landing-page section-subtitle">Start small, grow automatically. Each level unlocks higher earnings.</p>

            <div className="packages-grid-new">
              {[
                { level: 1, price: 10, direct: 4.6 },
                { level: 2, price: 20, direct: 9.2 },
                { level: 3, price: 40, direct: 18.4 },
                { level: 4, price: 80, direct: 36.8 },
                { level: 5, price: 160, direct: 73.6 },
                { level: 6, price: 320, direct: 147.2 },
                { level: 7, price: 640, direct: 294.4 },
                { level: 8, price: 1280, direct: 588.8 },
                { level: 9, price: 2560, direct: 1177.6 },
                { level: 10, price: 5120, direct: 2355.2 }
              ].map((pkg) => (
                <div key={pkg.level} className={`pkg-card ${pkg.level === 1 ? "pkg-card--featured" : ""}`}>
                  {pkg.level === 1 ? <div className="pkg-badge">Start Here</div> : null}
                  <div className="pkg-level">Level {pkg.level}</div>
                  <div className="pkg-price">
                    ${pkg.price}
                    <span> USDT</span>
                  </div>
                  <div className="pkg-direct">
                    Direct:
                    <strong> ${pkg.direct.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-why" id="why">
          <div className="section-container">
            <h2 className="landing-page section-title">Why MetaGuildX?</h2>

            <div className="why-grid">
              {[
                { icon: "OC", title: "Fully On-Chain", desc: "All logic runs on OPBNB smart contracts. No human can interfere." },
                { icon: "TR", title: "100% Transparent", desc: "Every transaction is publicly verifiable on-chain." },
                { icon: "IP", title: "Instant Payouts", desc: "Income is distributed automatically in the same transaction flow." },
                { icon: "AG", title: "Auto Growth", desc: "2X income triggers auto-upgrade so your account grows itself." },
                { icon: "GL", title: "Global Access", desc: "Open to anyone with a Web3 wallet and OPBNB access." },
                { icon: "LE", title: "Low Entry", desc: "Start with just $10 USDT without large capital requirements." }
              ].map((item) => (
                <div key={item.title} className="why-card">
                  <div className="why-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-cta">
          <div className="section-container text-center">
            <h2 className="cta-title">Ready to Start Earning?</h2>
            <p className="cta-subtitle">Join MetaGuildX today. Connect your wallet and start in under 2 minutes.</p>
            <button className="btn-primary btn-primary-large" type="button" onClick={() => void handleConnectWallet()} disabled={isLoading}>
              Connect Wallet & Start
            </button>
            <p className="cta-note">Powered by OPBNB Blockchain | USDT Payments | Fully Decentralized</p>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <img src={logoMark} alt="MGX" className="footer-brand-image" />
              <span>MetaGuildX</span>
            </div>

            <div className="footer-links">
              <a href="#how-it-works">How It Works</a>
              <a href="#packages">Packages</a>
              <a href="https://opbnb.bscscan.com" target="_blank" rel="noreferrer">
                BSCScan
              </a>
            </div>

            <div className="footer-copy">� 2025 MetaGuildX. Powered by OPBNB Blockchain.</div>
          </div>
        </footer>

        {showWalletSelection ? (
          <div className="flow-modal-overlay" role="presentation">
            <div className="flow-modal-card">
              <div className="flow-modal-header">
                <div>
                  <p className="section-label">Step 2</p>
                  <h3>Select Wallet</h3>
                </div>
                <button type="button" className="secondary-button" onClick={() => setShowWalletSelection(false)}>
                  Close
                </button>
              </div>
                  <p className="text-secondary">Choose the wallet provider for step 1. This step only connects the wallet and may show a small gas estimate. No USDT approval or registration happens here.</p>
              <div className="wallet-choice-grid">
                <button
                  type="button"
                  className={`wallet-choice-card ${selectedWalletOption === "metamask" ? "selected" : ""}`}
                  onClick={() => void handleSelectWalletOption("metamask")}
                  disabled={isLoading}
                >
                  <strong>MetaMask</strong>
                  <span>Use biometric or password confirmation, then approve the connection.</span>
                </button>
                <button
                  type="button"
                  className={`wallet-choice-card ${selectedWalletOption === "walletconnect" ? "selected" : ""}`}
                  onClick={() => void handleSelectWalletOption("walletconnect")}
                  disabled={isLoading}
                >
                  <strong>WalletConnect</strong>
                  <span>Listed for future support. Use MetaMask for the live registration flow.</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
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
            <span>MetaGuildX</span>
          </div>
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label="Toggle menu"
          >
            {mobileNavOpen ? "X" : "Menu"}
          </button>
        </div>

        <div
          className={`sidebar-overlay nav-overlay ${mobileNavOpen ? "open" : ""}`}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden={mobileNavOpen ? "false" : "true"}
        />

        <header className="dashboard-topbar">
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
        <section className={`tab-nav dashboard-menu dashboard-nav ${mobileNavOpen ? "mobile-open" : ""}`}>
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
              <p className="text-lg font-semibold">Home</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "income" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("income")}
            >
              <p className="text-lg font-semibold">Earnings</p>
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
              <p className="text-lg font-semibold">Network</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "upgrade" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("upgrade")}
            >
              <p className="text-lg font-semibold">Upgrade</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "rebirth" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("rebirth")}
            >
              <p className="text-lg font-semibold">Rebirth</p>
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
              <p className="text-lg font-semibold">Wallet</p>
            </button>

            <button
              type="button"
              className={`bg-gray-900 p-4 rounded-xl text-center cursor-pointer hover:bg-gray-800 transition duration-200 ease-in-out ${
                dashboardView === "support" ? "ring-1 ring-blue-500 bg-gray-800" : ""
              }`}
              onClick={() => setDashboardView("support")}
            >
              <p className="text-lg font-semibold">Support</p>
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
              <div className="summary-strip">
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
                  ?
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
                <div className="overview-row overview-row-primary grid grid-cols-1 xl:grid-cols-2 gap-4 w-full max-w-full">
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
              <div className="summary-strip referrals-summary-strip premium-network-stats w-full max-w-full">
                <article className="summary-chip premium-network-card">
                  <span>Direct Referrals</span>
                  <strong>{snapshot.directReferrals}</strong>
                </article>
                <article className="summary-chip premium-network-card">
                  <span>Total Team</span>
                  <strong>{totalTeamLabel}</strong>
                </article>
                <article className="summary-chip premium-network-card">
                  <span>Left | Right</span>
                  <strong>{snapshot.leftBranchNodes} | {snapshot.rightBranchNodes}</strong>
                </article>
                <article className="summary-chip premium-network-card team-business">
                  <span>?? Team Business</span>
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
                              <span aria-hidden="true">??</span>
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
                                  <td className="referrals-col-user referral-cell-strong"><span className="referral-user-pill">#{node.userId}</span></td>
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
                <article className="stat-card premium-earnings-stat" title="Display only � Network activity"><p className="stat-card-label">Crossline Income</p><p className="stat-card-value">${networkBonusDisplay}</p></article>
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
                              <strong>{item.primary}</strong> � {item.timestampLabel ?? "Live"}<br />
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
                        <span aria-hidden="true">??</span>
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
                            <td className="referrals-col-user referral-cell-strong">#{node.userId}</td>
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
                            {row.isUnlocked ? "? Active" : "?? Locked"}
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
                            }
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
                                      <span className="text-sm font-medium text-white">?? Auto-Upgrade Escrow</span>
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
                      <div className="section-header">
                        <span className="section-badge purple">STAKING POSITION</span>
                        <button type="button" className="btn-refresh-reward" onClick={handleRefreshRewards} disabled={isLoading || !snapshot.walletAddress}>
                          Refresh
                        </button>
                      </div>
                      <StakingSummary />
                      {displayedStakePositions.length > 0 ? (
                        <div className="stake-position-list compact wallet-staking-position-list">
                          {displayedStakePositions.map((position) => (
                            <article key={`stake-view-position-${position.index}`} className="stake-position-item compact wallet-staking-position-card">
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
                          <span className="green">{displayedMgxAllocated} MGX</span>
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
                              onClick={() => setStakeForm((current) => ({ ...current, amount: displayedMgxAllocated }))}
                            >
                              MAX
                            </button>
                            <div className="transfer-token-pill">MGX</div>
                          </div>
                          <p>BALANCE: {displayedMgxAllocated} MGX</p>
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
                                detail: `You can stake up to ${displayedMgxAllocated} MGX right now. Reduce the amount and try again.`
                              });
                              return;
                            }

                            runWalletAction(
                              () =>
                                metaguildx.stakeTokens({
                                  amount: Number(stakeForm.amount),
                                  durationKey: stakeForm.durationKey,
                                  autoCompound: stakeForm.autoCompound
                                }),
                              "Submitting stake...",
                              "Stake updated",
                              () => ({
                                title: "? Stake confirmed",
                                detail: "Position updated"
                              })
                            );
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
                                disabled={isLoading || !snapshot.walletAddress || !canUseIndexedStakingActions || parseDisplayNumber(position.pendingReward) <= 0}
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
                  <div className="wallet-action-buttons premium-action-grid">
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("mgxboxes"); }}>
                      <span className="premium-action-icon">??</span>
                      <span className="premium-action-title">Inner ? Wallet</span>
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
                      <span className="premium-action-icon">??</span>
                      <span className="premium-action-title">Reward ? Wallet</span>
                      <span className="premium-action-subtitle">Claim platform rewards</span>
                    </button>
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("stake"); }}>
                      <span className="premium-action-icon">??</span>
                      <span className="premium-action-title">Staking</span>
                      <span className="premium-action-subtitle">Stake MGX tokens</span>
                      {parseDisplayNumber(displayedPersonalStaked) > 0 ? (
                        <span className="premium-action-badge">{`${displayedPersonalStaked} MGX staked`}</span>
                      ) : null}
                    </button>
                    <button type="button" className="btn-action premium-action-card" onClick={() => { setDashboardView("wallet"); setWalletSubView("cashback"); }}>
                      <span className="premium-action-icon">??</span>
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
                      <span className="token-name">MGX Allocated (Free)</span>
                      <span className="token-sub">Available for staking</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{displayedMgxAllocated}</span>
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
                      <span className="token-sub">Token balance</span>
                    </div>
                    <div className="token-amount">
                      <span className="amount-main">{mgxWalletBalanceDisplay}</span>
                      <span className="amount-sub">MGX</span>
                    </div>
                  </div>
                </div>

                <div className="wallet-section balance-section">
                  <div className="section-header">
                    <span className="section-badge blue">Recent Wallet Activity</span>
                    {snapshot.connectedWalletHistoryCursor ? (
                      <button type="button" className="btn-load-more" onClick={handleLoadMoreHistory} disabled={isConnectedWalletHistoryLoading}>
                        {isConnectedWalletHistoryLoading ? "Loading..." : "Load More"}
                      </button>
                    ) : null}
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
                              {isCompleted ? "?" : isActive ? "?" : "??"}
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
                            {isCompleted ? "? DONE" : isActive ? "ACTIVE" : "?? LOCKED"}
                          </span>
                        </div>

                        {isCompleted ? (
                          <div className="upgrade-milestone-complete">
                            <div className="upgrade-milestone-meta">
                              <span className="upgrade-milestone-meta-label">?? Upgraded</span>
                              <span className="upgrade-milestone-cost">{`Cost Paid: ${milestoneCostLabel}`}</span>
                            </div>
                            <div className="upgrade-milestone-progress" aria-hidden="true">
                              <span className="upgrade-milestone-progress-fill" style={{ width: "100%" }} />
                            </div>
                            <div className="upgrade-milestone-meta">
                              <span className="upgrade-milestone-complete-copy">Milestone Complete! ??</span>
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
                              ?? Upgrade Now
                            </button>
                          </>
                        ) : null}

                        {isActive && isMaxMilestone ? <div className="upgrade-max-state">You're at Maximum Package ???</div> : null}
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

          {dashboardView === "support" ? (
            <SupportPage
              userId={snapshot.userId}
              walletAddress={snapshot.walletAddress}
            />
          ) : null}

          {dashboardView === "register" ? (
            <section className="panel dashboard-view w-full max-w-full">
              <p className="section-label">Register</p>
              <div className="dashboard-grid detailed grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-full">
                <article className="dashboard-card action-card">
                  <h3>Package Activation</h3>
                  <p>Registration and Package 1 activation still use the same on-chain transaction, but the UI now guides the flow in separate steps.</p>
                  <div className="flow-badges">
                    <span className="flow-badge flow-badge-locked">{snapshot.walletAddress ? "Wallet connected" : "Connect wallet first"}</span>
                    <span className="flow-badge">Package 1</span>
                    <span className="flow-badge">Auto box opening</span>
                  </div>
                  <label className="field">
                    <span>Sponsor ID</span>
                    <input
                      value={referralSponsorId !== null ? String(referralSponsorId) : registerForm.sponsorId}
                      onChange={(event) => {
                        if (referralSponsorId !== null) {
                          return;
                        }
                        setRegisterForm((current) => ({ ...current, sponsorId: event.target.value }));
                      }}
                      readOnly={referralSponsorId !== null}
                      disabled={referralSponsorId !== null}
                    />
                  </label>
                  {referralSponsorId !== null ? (
                    <div className="info-card">
                      <strong>Referral Sponsor Locked</strong>
                      <span>This registration came through a referral link.</span>
                      <span>Sponsor ID {referralSponsorId} will be used automatically.</span>
                    </div>
                  ) : null}
                  <div className="section-card-body empty-state register-flow-card">
                    <p className="text-lg font-semibold">Package 1: ${snapshot.packagePrices[0] ?? 10}</p>
                    <p className="text-sm text-gray-300 register-flow-note">
                      Review the package details, then open the transaction confirmation popup. MetaMask will handle USDT approval first and registration immediately after that.
                    </p>
                    <button
                      className="btn-primary-large"
                      type="button"
                      onClick={() => setShowActivationConfirm(true)}
                      disabled={isLoading || !snapshot.walletAddress}
                    >
                      {isLoading ? "Waiting for MetaMask..." : "Activate Package 1"}
                    </button>
                  </div>
                  <div className="info-card">
                    <strong>Activation Rule</strong>
                    <span>First package only: Package 1 (${snapshot.packagePrices[0]})</span>
                    <span>Current running box: Box {snapshot.currentBoxId} (${snapshot.currentBoxPrice})</span>
                    <span>Boxes open one by one only after the current box is sold out.</span>
                    <span>You will receive MGX according to the current running box price and your allocated box.</span>
                  </div>
                  {regStep > 0 ? (
                    <div className="reg-steps">
                      <div className={`reg-step ${regStep >= 1 ? "active" : ""} ${regStep > 1 ? "done" : ""} ${regStep < 1 ? "pending" : ""}`}>
                        <div className="reg-step-icon">{regStep > 1 ? "OK" : regStep === 1 ? <div className="spinner" /> : "1"}</div>
                        <span className="reg-step-text">Approving USDT</span>
                      </div>
                      <div className={`reg-step ${regStep >= 2 ? "active" : ""} ${regStep > 2 ? "done" : ""} ${regStep < 2 ? "pending" : ""}`}>
                        <div className="reg-step-icon">{regStep > 2 ? "OK" : regStep === 2 ? <div className="spinner" /> : "2"}</div>
                        <span className="reg-step-text">Confirm in MetaMask</span>
                      </div>
                      <div className={`reg-step ${regStep >= 3 ? "active" : ""} ${regStep > 3 ? "done" : ""} ${regStep < 3 ? "pending" : ""}`}>
                        <div className="reg-step-icon">{regStep > 3 ? "OK" : regStep === 3 ? <div className="spinner" /> : "3"}</div>
                        <span className="reg-step-text">Registering on OPBNB</span>
                      </div>
                      <div className={`reg-step ${regStep >= 4 ? "done" : "pending"}`}>
                        <div className="reg-step-icon">{regStep >= 4 ? "OK" : "4"}</div>
                        <span className="reg-step-text">Welcome to MetaGuildX!</span>
                      </div>
                      </div>
                    ) : null}
                    {registrationSummary ? (
                      <div className="info-card registration-breakdown-card">
                        <strong>Registration Complete</strong>
                        <span>Total Paid: {registrationSummary.paid}</span>
                        <span>MGX Reward Received: {registrationSummary.mgxReward}</span>
                        {!isAdminRoute ? <span>Earnings are distributed across the network.</span> : null}
                        {isAdminRoute ? (
                          <>
                            <ul className="metric-list compact registration-breakdown-list">
                              <li>Direct Income (Sponsor): {registrationSummary.breakdown.directIncome} (46%)</li>
                              <li>Level Income (Distributed): {registrationSummary.breakdown.levelIncome} (40%)</li>
                              <li>Cashback Pool: {registrationSummary.breakdown.cashbackPool} (4%)</li>
                              <li>Creator Fee: {registrationSummary.breakdown.creatorFee} (10%)</li>
                            </ul>
                            {registrationSummary.distribution ? (
                              <div className="registration-verification-card">
                                <strong>Distribution Verification</strong>
                                <ul className="metric-list compact registration-breakdown-list">
                                  <li>Direct Income {"->"} Sponsor wallet</li>
                                  <li>Wallet: {registrationSummary.distribution.sponsorWallet}</li>
                                  <li>Balance: {registrationSummary.distribution.directIncome}</li>
                                  <li>Cashback Pool Total: {registrationSummary.distribution.cashbackPool}</li>
                                  <li>Creator Fee: {registrationSummary.distribution.creatorFee}</li>
                                  <li>Level Income: {registrationSummary.distribution.levelIncome}</li>
                                  <li>Platform Reserve: {registrationSummary.distribution.platformReserve}</li>
                                </ul>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        <span>
                          Tx Explorer:{" "}
                          <a
                            href={`${activeNetworkConfig.blockExplorerUrls[0] || "https://opbnb-testnet.bscscan.com"}/tx/${registrationSummary.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {registrationSummary.txHash.slice(0, 10)}...
                          </a>
                        </span>
                      </div>
                    ) : null}
                </article>
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
    );
  }

  return screen === "dashboard" ? renderDashboard() : renderLanding();
}

export default App;





























