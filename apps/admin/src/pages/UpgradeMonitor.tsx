import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider } from "ethers";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { getUpgradeMonitorData, type UpgradeMonitorData } from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

function formatUsdt(amount: number) {
  return `${amount.toFixed(2)} USDT`;
}

type ContractBalances = {
  core: number;
  router: number;
  income: number;
};

type EscrowStatusRow = {
  userId: number;
  wallet: string;
  packageLevel: number;
  escrow: number;
  waitingIncome: number;
  rebirthEscrow: number;
  progress: number;
  escrowType: "Package Escrow" | "Rebirth Escrow" | "Package Escrow + Waiting Income";
  status: "Ready to upgrade" | "Ready to rebirth" | "Accumulating";
};

type StrandedEscrowRow = {
  userId: number;
  wallet: string;
  currentPkg: number;
  strandedPkg: number;
  amountRaw: bigint;
  amount: number;
};

type EthereumLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum() {
  return (window as Window & { ethereum?: EthereumLike }).ethereum;
}

async function getEscrowStatusRows(): Promise<EscrowStatusRow[]> {
  console.log("getEscrowStatusRows START");
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
  const core = new Contract(
    CONTRACTS.MetaGuildXCore,
    [
      ...ABIS.MetaGuildXCore,
      "function getPackagePriceByLevel(uint256) view returns (uint256)"
    ],
    provider
  );
  const income = new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider);
  const nextUserId = Number(await core.nextUserId());
  const rows: EscrowStatusRow[] = [];
  const rebirthTarget = BigInt(await core.getPackagePriceByLevel(1));

  for (let userId = 1; userId < nextUserId; userId += 1) {
    const profile = await core.usersById(userId);
    const packageLevel = Number(profile.packageLevel);
    const packagePrice = BigInt(await core.getPackagePriceByLevel(packageLevel));
    const upgradeCost = packagePrice * 2n;

    let currentPkgEscrowRaw = 0n;
    try {
      currentPkgEscrowRaw = BigInt(await income.escrowBalances(userId, BigInt(packageLevel)));
    } catch {}

    let waitingIncomeRaw = 0n;
    for (let pkg = packageLevel + 1; pkg <= 10; pkg += 1) {
      try {
        waitingIncomeRaw += BigInt(await income.escrowBalances(userId, BigInt(pkg)));
      } catch {}
    }

    let rebirthEscrowRaw = 0n;
    try {
      rebirthEscrowRaw = BigInt(await income.rebirthEscrow(userId));
    } catch {}

    const totalEscrowRaw = currentPkgEscrowRaw + waitingIncomeRaw + rebirthEscrowRaw;
    if (totalEscrowRaw <= 0n) continue;

    const isRebirthOnly = rebirthEscrowRaw > 0n && currentPkgEscrowRaw === 0n && waitingIncomeRaw === 0n;
    const progressEscrow = isRebirthOnly ? rebirthEscrowRaw : currentPkgEscrowRaw;
    const progressTarget = isRebirthOnly ? rebirthTarget : upgradeCost;
    const progress = progressTarget > 0n ? Math.min(Number((progressEscrow * 100n) / progressTarget), 100) : 0;
    const status = isRebirthOnly
      ? (rebirthEscrowRaw >= rebirthTarget ? "Ready to rebirth" : "Accumulating")
      : currentPkgEscrowRaw >= upgradeCost ? "Ready to upgrade" : "Accumulating";
    const escrowType = isRebirthOnly
      ? "Rebirth Escrow"
      : waitingIncomeRaw > 0n ? "Package Escrow + Waiting Income" : "Package Escrow";

    console.log("User", userId, "currentPkg:", currentPkgEscrowRaw.toString(), "waiting:", waitingIncomeRaw.toString(), "progress:", progress);
    rows.push({
      userId,
      wallet: String(profile.account),
      packageLevel,
      escrow: Number(currentPkgEscrowRaw) / 10,
      waitingIncome: Number(waitingIncomeRaw) / 10,
      rebirthEscrow: Number(rebirthEscrowRaw) / 10,
      progress,
      escrowType,
      status
    });
  }

  return rows.sort((a, b) => b.progress - a.progress || b.escrow - a.escrow).slice(0, 50);
}

async function getStrandedEscrowRows(): Promise<StrandedEscrowRow[]> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
  const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
  const income = new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider);
  const nextUserId = Number(await core.nextUserId());
  const rows: StrandedEscrowRow[] = [];
  console.log("[StrandedEscrow] scan start", {
    core: CONTRACTS.MetaGuildXCore,
    income: CONTRACTS.MetaGuildXIncome,
    nextUserId
  });

  for (let userId = 1; userId < nextUserId; userId += 1) {
    let currentPkg = 0;
    let wallet = "";

    try {
      currentPkg = Number(await core.getUserPackageLevel(userId));
      if (currentPkg <= 1) {
        continue;
      }

      try {
        wallet = String(await core.getUserWallet(userId));
      } catch {
        const profile = await core.usersById(userId);
        wallet = String(profile.account);
      }
    } catch {
      continue;
    }

    for (let pkg = 1; pkg < currentPkg; pkg += 1) {
      try {
        const amountRaw = BigInt(await income.escrowBalances(userId, pkg));
        if (amountRaw > 0n) {
          console.log("[StrandedEscrow] found", {
            userId,
            wallet,
            currentPkg,
            strandedPkg: pkg,
            amountRaw: amountRaw.toString()
          });
          rows.push({
            userId,
            wallet,
            currentPkg,
            strandedPkg: pkg,
            amountRaw,
            amount: Number(amountRaw) / 10
          });
        }
      } catch {
        // Keep scanning other packages/users if one read fails.
      }
    }
  }

  console.log("[StrandedEscrow] scan complete", rows);
  return rows.sort((a, b) => b.amount - a.amount || a.userId - b.userId || a.strandedPkg - b.strandedPkg);
}

export function UpgradeMonitor() {
  const location = useLocation();
  const escrowOnly = location.pathname === "/escrow";
  const [data, setData] = useState<UpgradeMonitorData | null>(null);
  const [escrowRows, setEscrowRows] = useState<EscrowStatusRow[]>([]);
  const [strandedRows, setStrandedRows] = useState<StrandedEscrowRow[]>([]);
  const [balances, setBalances] = useState<ContractBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [strandedLoading, setStrandedLoading] = useState(false);
  const [releaseUserId, setReleaseUserId] = useState<number | null>(null);
  const [strandedError, setStrandedError] = useState("");

  const loadBalances = async () => {
    const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
    const usdt = new Contract(CONTRACTS.USDT, ABIS.USDT, provider);
    const [coreRaw, routerRaw, incomeRaw] = await Promise.all([
      usdt.balanceOf(CONTRACTS.MetaGuildXCore),
      usdt.balanceOf(CONTRACTS.IncomeRouter),
      usdt.balanceOf(CONTRACTS.MetaGuildXIncome)
    ]);

    setBalances({
      core: Number(coreRaw) / 1e18,
      router: Number(routerRaw) / 1e18,
      income: Number(incomeRaw) / 1e18
    });
  };

  const loadStrandedEscrow = async () => {
    setStrandedLoading(true);
    setStrandedError("");
    try {
      const rows = await getStrandedEscrowRows();
      console.log("[StrandedEscrow] state update", rows.length, rows);
      setStrandedRows(rows);
    } catch (error) {
      setStrandedError(error instanceof Error ? error.message : "Failed to load stranded escrow");
    } finally {
      setStrandedLoading(false);
    }
  };

  const handleReleaseStrandedEscrow = async (userId: number) => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setStrandedError("MetaMask not found");
      return;
    }

    const confirmed = window.confirm(`Release all stranded escrow for User #${userId}?`);
    if (!confirmed) {
      return;
    }

    setReleaseUserId(userId);
    setStrandedError("");
    try {
      const browserProvider = new BrowserProvider(ethereum as Eip1193Provider);
      await browserProvider.send("eth_requestAccounts", []);
      const signer = await browserProvider.getSigner();
      const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);
      const tx = await core.adminReleaseStrandedEscrow(userId);
      await tx.wait();
      await Promise.all([loadStrandedEscrow(), loadBalances()]);
    } catch (error) {
      setStrandedError(error instanceof Error ? error.message : "Failed to release stranded escrow");
    } finally {
      setReleaseUserId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      
      // Run both independently - one failure won't block the other
      const [upgradeResult, escrowResult, strandedResult] = await Promise.allSettled([
        getUpgradeMonitorData(),
        getEscrowStatusRows(),
        getStrandedEscrowRows()
      ]);

      if (upgradeResult.status === "fulfilled") {
        setData(upgradeResult.value);
      } else {
        console.error("getUpgradeMonitorData failed:", upgradeResult.reason);
      }

      if (escrowResult.status === "fulfilled") {
        console.log("escrowRows loaded:", escrowResult.value.length, escrowResult.value);
        setEscrowRows(escrowResult.value);
      } else {
        console.error("getEscrowStatusRows failed:", escrowResult.reason);
      }

      if (strandedResult.status === "fulfilled") {
        console.log("[StrandedEscrow] initial load", strandedResult.value.length, strandedResult.value);
        setStrandedRows(strandedResult.value);
      } else {
        console.error("getStrandedEscrowRows failed:", strandedResult.reason);
        setStrandedError(strandedResult.reason instanceof Error ? strandedResult.reason.message : "Failed to load stranded escrow");
      }

      try {
        await loadBalances();
      } catch (e) {
        console.error("loadBalances failed:", e);
      }

      setLoading(false);
    };
    void load();
  }, []);

  const totalStrandedUsdt = strandedRows.reduce((total, row) => total + row.amount, 0);

  return (
    <div className="space-y-6">
      {!escrowOnly ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Recent Upgrades</h2>
            <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
              <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
                <thead className="bg-gray-950/70 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">From</th>
                    <th className="px-4 py-3 font-medium">To</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                  {(data?.recentUpgrades ?? []).map((row, index) => (
                    <tr key={`${row.userId}-${row.timestamp}-${index}`}>
                      <td className="px-4 py-4 text-white">#{row.userId}</td>
                      <td className="px-4 py-4 text-gray-300">Pkg {row.fromLevel}</td>
                      <td className="px-4 py-4 text-gray-300">Pkg {row.toLevel}</td>
                      <td className="px-4 py-4 text-blue-300">{formatUsdt(row.amount)}</td>
                    </tr>
                  ))}
                  {!loading && (data?.recentUpgrades.length ?? 0) === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No upgrades found yet</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Near Upgrade (&gt;50%)</h2>
            <div className="mt-6 space-y-3">
              {(data?.nearUpgrade ?? []).map((row) => (
                <article key={row.userId} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">User #{row.userId}</div>
                      <div className="text-gray-400">{shortAddress(row.wallet)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-300">{row.percent.toFixed(0)}%</div>
                      <div className="text-gray-400">Escrow progress</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(row.percent, 100)}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-gray-300">
                    <span>Escrow {formatUsdt(row.escrow)}</span>
                    <span>Need {formatUsdt(row.needed)}</span>
                  </div>
                </article>
              ))}
              {!loading && (data?.nearUpgrade.length ?? 0) === 0 ? <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-10 text-center text-gray-500">No users are near upgrade yet</div> : null}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <h2 className="text-xl font-semibold text-white">Escrow Monitor</h2>
          <p className="mt-1 text-sm text-gray-400">Package escrow and rebirth escrow across all users</p>

          <div className="mt-6 rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Contract Balances</h3>
                <p className="mt-1 text-sm text-gray-300">Quick check for stuck USDT across system contracts.</p>
              </div>
              <button
                type="button"
                onClick={() => void loadBalances()}
                className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4">
                <p className="text-sm text-gray-400">Core USDT</p>
                <h4 className="mt-3 text-2xl font-semibold text-cyan-300">
                  {balances ? formatUsdt(balances.core) : "Loading..."}
                </h4>
              </article>
              <article className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4">
                <p className="text-sm text-gray-400">Router USDT</p>
                <h4 className="mt-3 text-2xl font-semibold text-amber-300">
                  {balances ? formatUsdt(balances.router) : "Loading..."}
                </h4>
              </article>
              <article className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4">
                <p className="text-sm text-gray-400">Income USDT</p>
                <h4 className="mt-3 text-2xl font-semibold text-emerald-300">
                  {balances ? formatUsdt(balances.income) : "Loading..."}
                </h4>
              </article>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Stranded Escrow</h3>
                <p className="mt-1 text-sm text-gray-300">
                  Lower-package escrow held by users whose current package has already advanced.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-amber-500/20 bg-gray-950/70 px-4 py-3 text-sm">
                  <span className="text-gray-400">Total stranded </span>
                  <span className="font-semibold text-amber-300">{formatUsdt(totalStrandedUsdt)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStrandedEscrow()}
                  disabled={strandedLoading}
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {strandedLoading ? "Scanning..." : "Refresh Scan"}
                </button>
              </div>
            </div>

            {strandedError ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {strandedError}
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-2xl border border-gray-800">
              <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
                <thead className="bg-gray-950/70 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">User ID</th>
                    <th className="px-4 py-3 font-medium">Wallet</th>
                    <th className="px-4 py-3 font-medium">Current Pkg</th>
                    <th className="px-4 py-3 font-medium">Stranded Pkg</th>
                    <th className="px-4 py-3 font-medium">Amount (USDT)</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-950/50">
                  {strandedRows.map((row) => (
                    <tr key={`${row.userId}-${row.strandedPkg}`}>
                      <td className="px-4 py-4 font-medium text-white">#{row.userId}</td>
                      <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                      <td className="px-4 py-4 text-gray-300">Pkg {row.currentPkg}</td>
                      <td className="px-4 py-4 text-amber-300">Pkg {row.strandedPkg}</td>
                      <td className="px-4 py-4 font-semibold text-white">{formatUsdt(row.amount)}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => void handleReleaseStrandedEscrow(row.userId)}
                          disabled={releaseUserId === row.userId}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {releaseUserId === row.userId ? "Releasing..." : "Release"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!strandedLoading && strandedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        No stranded escrow found
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Escrow Status</h2>
            <p className="mt-1 text-sm text-gray-400">Users with frozen escrow balance</p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {escrowRows.map((row) => {
            const progressColor =
              row.progress >= 75 ? "bg-emerald-500" : row.progress >= 50 ? "bg-amber-400" : "bg-blue-500";

            return (
              <article key={row.userId} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-medium text-white">User #{row.userId}</div>
                    <div className="text-gray-400">{shortAddress(row.wallet)}</div>
                    <div className="text-gray-400">{`Package ${row.packageLevel}`}</div>
                    <div className="text-gray-400">{row.escrowType}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-semibold text-white">
                      {formatUsdt(row.escrow)}
                      <span className="ml-1 text-xs text-gray-400">pkg escrow</span>
                    </div>
                    {row.waitingIncome > 0 && (
                      <div className="text-xs text-amber-400">
                        +{formatUsdt(row.waitingIncome)} waiting
                      </div>
                    )}
                    {row.rebirthEscrow > 0 && (
                      <div className="text-xs text-purple-400">
                        +{formatUsdt(row.rebirthEscrow)} rebirth
                      </div>
                    )}
                    <div className="text-gray-400">{`${row.progress}% progress`}</div>
                    <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${row.status === "Ready to upgrade" ? "bg-emerald-500/15 text-emerald-300" : "bg-blue-500/15 text-blue-300"}`}>
                      {row.status}
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${Math.min(row.progress, 100)}%` }} />
                </div>
              </article>
            );
          })}
          {!loading && escrowRows.length === 0 ? <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-10 text-center text-gray-500">No users with frozen escrow</div> : null}
        </div>
      </section>
    </div>
  );
}
