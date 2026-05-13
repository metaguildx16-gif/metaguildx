import { Contract, JsonRpcProvider } from "ethers";
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
  progress: number;
  escrowType: "Package Escrow" | "Rebirth Escrow" | "Package + Rebirth Escrow";
  status: "Ready to upgrade" | "Ready to rebirth" | "Accumulating";
};

async function getEscrowStatusRows(): Promise<EscrowStatusRow[]> {
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
    let packageEscrowRaw = 0n;

    for (let pkg = 1; pkg <= 10; pkg += 1) {
      try {
        const bucketEscrow = await income.escrowBalances(userId, BigInt(pkg));
        packageEscrowRaw += BigInt(bucketEscrow);
      } catch {
        // Ignore unsupported bucket reads and continue summing remaining buckets.
      }
    }

    let rebirthEscrowRaw = 0n;
    try {
      rebirthEscrowRaw = BigInt(await income.rebirthEscrow(userId));
    } catch {
      // Ignore environments where rebirth escrow is unavailable.
    }

    const escrowRaw = packageEscrowRaw + rebirthEscrowRaw;
    if (escrowRaw <= 0n) {
      continue;
    }

    const packageLevel = Number(profile.packageLevel);
    const packagePrice = BigInt(await core.getPackagePriceByLevel(packageLevel));
    const upgradeCost = packagePrice * 2n;
    const isRebirthOnly = rebirthEscrowRaw > 0n && packageEscrowRaw == 0n;
    const isPackageOnly = packageEscrowRaw > 0n && rebirthEscrowRaw == 0n;
    const target = isRebirthOnly ? rebirthTarget : isPackageOnly ? upgradeCost : upgradeCost + rebirthTarget;
    const progress = target > 0n ? Math.min(Number((escrowRaw * 100n) / target), 100) : 0;
    const escrow = Number(escrowRaw) / 10;
    const escrowType =
      isRebirthOnly ? "Rebirth Escrow" : isPackageOnly ? "Package Escrow" : "Package + Rebirth Escrow";
    const status =
      isRebirthOnly
        ? (rebirthEscrowRaw >= rebirthTarget ? "Ready to rebirth" : "Accumulating")
        : escrowRaw >= upgradeCost
          ? "Ready to upgrade"
          : "Accumulating";

    rows.push({
      userId,
      wallet: String(profile.account),
      packageLevel,
      escrow,
      progress,
      escrowType,
      status
    });
  }

  return rows.sort((a, b) => b.progress - a.progress || b.escrow - a.escrow).slice(0, 50);
}

export function UpgradeMonitor() {
  const location = useLocation();
  const escrowOnly = location.pathname === "/escrow";
  const [data, setData] = useState<UpgradeMonitorData | null>(null);
  const [escrowRows, setEscrowRows] = useState<EscrowStatusRow[]>([]);
  const [balances, setBalances] = useState<ContractBalances | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [upgradeData, nextEscrowRows] = await Promise.all([
          getUpgradeMonitorData(),
          getEscrowStatusRows()
        ]);
        setData(upgradeData);
        setEscrowRows(nextEscrowRows);
        await loadBalances();
      } catch (error) {
        console.error("UpgradeMonitor load error:", error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

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
                  <div className="text-right">
                    <div className="font-semibold text-white">{formatUsdt(row.escrow)}</div>
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
