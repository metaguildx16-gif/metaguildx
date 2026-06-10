import { BrowserProvider, verifyMessage, type Eip1193Provider } from "ethers";
import { useEffect, useState } from "react";
import { NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminRoute } from "./components/AdminRoute";
import { NetworkBadge } from "./components/NetworkBadge";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { BinaryTreePage } from "./pages/BinaryTree";
import { CashbackMonitor } from "./pages/CashbackMonitor";
import { ContractControl } from "./pages/ContractControl";
import { CoreBalancePage } from "./pages/CoreBalance";
import { FinancialReports } from "./pages/FinancialReports";
import { IncomeDistribution } from "./pages/IncomeDistribution";
import { IncomeMonitor } from "./pages/IncomeMonitor";
import { RebirthEscrowPage } from "./pages/RebirthEscrow";
import { RebirthMonitor } from "./pages/RebirthMonitor";
import { StakingMonitor } from "./pages/StakingMonitor";
import { SupportTicketsPage } from "./pages/SupportTickets";
import { TransactionsPage } from "./pages/Transactions";
import { UpgradeEscrowPage } from "./pages/UpgradeEscrow";
import { UpgradeMonitor } from "./pages/UpgradeMonitor";
import { Users } from "./pages/Users";

const navigation = [
  { to: "/", label: "Overview", icon: "OV" },
  { to: "/users", label: "Users", icon: "US" },
  { to: "/activity", label: "Activity", icon: "AC" },
  { to: "/income", label: "Income Log", icon: "IL" },
  { to: "/income-monitor", label: "Income Monitor", icon: "IM" },
  { to: "/rebirths", label: "Rebirth", icon: "RB" },
  { to: "/rebirth-escrow", label: "Rebirth Escrow", icon: "RE" },
  { to: "/upgrades", label: "Upgrade", icon: "UP" },
  { to: "/upgrade-escrow", label: "Upgrade Escrow", icon: "UE" },
  { to: "/escrow", label: "Escrow", icon: "ES" },
  { to: "/staking", label: "Staking", icon: "ST" },
  { to: "/cashback", label: "Cashback", icon: "CA" },
  { to: "/core-balance", label: "Core Balance", icon: "CB" },
  { to: "/support", label: "Support", icon: "SP" },
  { to: "/tree", label: "Tree", icon: "TR" },
  { to: "/reports", label: "Reports", icon: "RP" },
  { to: "/transactions", label: "Transactions", icon: "TX" },
  { to: "/control", label: "Settings", icon: "ST" }
] as const;

const titles: Record<string, string> = {
  "/": "Overview",
  "/users": "Users",
  "/activity": "Activity",
  "/income": "Income Log",
  "/income-monitor": "Income Monitor",
  "/rebirths": "Rebirth",
  "/rebirth-escrow": "Rebirth Escrow",
  "/upgrades": "Upgrade",
  "/upgrade-escrow": "Upgrade Escrow",
  "/escrow": "Escrow",
  "/staking": "Staking",
  "/cashback": "Cashback",
  "/core-balance": "Core Balance",
  "/support": "Support",
  "/tree": "Tree",
  "/reports": "Reports",
  "/transactions": "Transactions",
  "/control": "Settings"
};

const OWNER_ADDRESS = "0xb1F4D1b91eE4159491652230A2d82EDBB9107ACe";
const ADMIN_AUTH_WALLET_KEY = "mgx_admin_wallet";
const ADMIN_AUTH_TIMESTAMP_KEY = "mgx_admin_auth_timestamp";
const ADMIN_AUTH_EXPIRY_MS = 24 * 60 * 60 * 1000;

function AdminLayoutShell() {
  const location = useLocation();
  const pageTitle = titles[location.pathname] ?? "MetaGuildX Admin";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-800 bg-gray-900/95 px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/20 text-sm font-semibold shadow-glow">
            MGX
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
              MetaGuildX
            </p>
            <p className="mt-1 text-lg font-semibold text-white">Admin</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-2 overflow-y-auto pr-1">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                ].join(" ")
              }
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gray-950/70 text-xs font-semibold">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-gray-800 pt-5">
          <NetworkBadge compact />
          <div className="rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-xs text-gray-400">
            Version 0.1.0
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-gray-500">
                Owner Back Office
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {pageTitle}
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <NetworkBadge />
              <WalletConnect />
            </div>
          </div>
          <div className="border-t border-gray-800 px-4 py-3 lg:hidden">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {navigation.map((item) => (
                <NavLink
                  key={`mobile-${item.to}`}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    [
                      "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition",
                      isActive
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white"
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getEthereum() {
  return window.ethereum as
    | {
        request: (payload: { method: string }) => Promise<unknown>;
        on?: (event: string, listener: (args: unknown) => void) => void;
        removeListener?: (event: string, listener: (args: unknown) => void) => void;
      }
    | undefined;
}

function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_AUTH_WALLET_KEY);
  window.localStorage.removeItem(ADMIN_AUTH_TIMESTAMP_KEY);
}

function AccessDenied({
  walletAddress,
  error,
  busy,
  onAuthenticate
}: {
  walletAddress: string | null;
  error: string | null;
  busy: boolean;
  onAuthenticate: () => Promise<void>;
}) {
  const isOwnerWallet = walletAddress?.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-6 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-gray-800 bg-gray-900/90 p-8 shadow-2xl shadow-black/40">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">MetaGuildX Admin</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {isOwnerWallet ? "Owner verification required" : "Access denied"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-gray-400">
          {isOwnerWallet
            ? "Sign a message with the owner wallet to unlock the admin console."
            : "Only the designated owner wallet can access the admin dashboard."}
        </p>
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950/70 px-4 py-4 text-sm text-gray-300">
          <div>Required owner: {OWNER_ADDRESS}</div>
          <div className="mt-2">Connected wallet: {walletAddress ?? "No wallet connected"}</div>
        </div>
        <button
          type="button"
          onClick={() => void onAuthenticate()}
          disabled={busy}
          className="mt-6 rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Verifying..." : isOwnerWallet ? "Verify Owner Wallet" : "Connect Owner Wallet"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    const syncWallet = async () => {
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      const nextWallet = accounts[0] ?? null;
      setWalletAddress(nextWallet);

      if (!nextWallet || nextWallet.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
        clearAdminSession();
        setIsAuthenticated(false);
        return;
      }

      const savedWallet = window.localStorage.getItem(ADMIN_AUTH_WALLET_KEY);
      const savedTimestamp = Number(window.localStorage.getItem(ADMIN_AUTH_TIMESTAMP_KEY) ?? "0");
      const hasValidSession =
        savedWallet?.toLowerCase() === nextWallet.toLowerCase() &&
        Number.isFinite(savedTimestamp) &&
        Date.now() - savedTimestamp <= ADMIN_AUTH_EXPIRY_MS;

      setIsAuthenticated(hasValidSession);
    };

    void syncWallet();

    const handleAccountsChanged = (accounts: unknown) => {
      const nextWallet = ((accounts as string[]) ?? [])[0] ?? null;
      setWalletAddress(nextWallet);
      setAuthError(null);

      if (!nextWallet || nextWallet.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
        clearAdminSession();
        setIsAuthenticated(false);
        return;
      }

      const savedWallet = window.localStorage.getItem(ADMIN_AUTH_WALLET_KEY);
      const savedTimestamp = Number(window.localStorage.getItem(ADMIN_AUTH_TIMESTAMP_KEY) ?? "0");
      const hasValidSession =
        savedWallet?.toLowerCase() === nextWallet.toLowerCase() &&
        Number.isFinite(savedTimestamp) &&
        Date.now() - savedTimestamp <= ADMIN_AUTH_EXPIRY_MS;
      setIsAuthenticated(hasValidSession);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const authenticateOwner = async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setAuthError("MetaMask not found");
      return;
    }

    setAuthBusy(true);
    setAuthError(null);

    try {
      const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      if (address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
        clearAdminSession();
        setIsAuthenticated(false);
        throw new Error("Only the owner wallet can access the admin app");
      }

      const timestamp = Date.now();
      const message = `MetaGuildX Admin Authentication\nWallet: ${address}\nTimestamp: ${timestamp}`;
      const signature = await signer.signMessage(message);
      const recoveredAddress = verifyMessage(message, signature);

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Signature verification failed");
      }

      window.localStorage.setItem(ADMIN_AUTH_WALLET_KEY, address.toLowerCase());
      window.localStorage.setItem(ADMIN_AUTH_TIMESTAMP_KEY, timestamp.toString());
      setIsAuthenticated(true);
    } catch (error) {
      clearAdminSession();
      setIsAuthenticated(false);
      setAuthError(error instanceof Error ? error.message : "Admin authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  if (!walletAddress || walletAddress.toLowerCase() !== OWNER_ADDRESS.toLowerCase() || !isAuthenticated) {
    return (
      <AccessDenied
        walletAddress={walletAddress}
        error={authError}
        busy={authBusy}
        onAuthenticate={authenticateOwner}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AdminLayoutShell />}>
        <Route
          path="/"
          element={<Dashboard />}
        />
        <Route
          path="/users"
          element={<Users />}
        />
        <Route
          path="/activity"
          element={<TransactionsPage />}
        />
        <Route
          path="/tree"
          element={<BinaryTreePage />}
        />
        <Route
          path="/income"
          element={<IncomeDistribution />}
        />
        <Route
          path="/income-monitor"
          element={<IncomeMonitor />}
        />
        <Route
          path="/reports"
          element={<FinancialReports />}
        />
        <Route
          path="/upgrades"
          element={<UpgradeMonitor />}
        />
        <Route
          path="/upgrade-escrow"
          element={<UpgradeEscrowPage />}
        />
        <Route
          path="/escrow"
          element={<UpgradeMonitor />}
        />
        <Route
          path="/rebirths"
          element={<RebirthMonitor />}
        />
        <Route
          path="/rebirth-escrow"
          element={<RebirthEscrowPage />}
        />
        <Route
          path="/staking"
          element={<StakingMonitor />}
        />
        <Route
          path="/transactions"
          element={<TransactionsPage />}
        />
        <Route
          path="/cashback"
          element={<CashbackMonitor />}
        />
        <Route
          path="/core-balance"
          element={<CoreBalancePage />}
        />
        <Route
          path="/support"
          element={<SupportTicketsPage />}
        />
        <Route
          path="/control"
          element={
            <AdminRoute walletAddress={walletAddress}>
              <ContractControl />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
