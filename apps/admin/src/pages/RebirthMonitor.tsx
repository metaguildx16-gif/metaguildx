import { Contract, JsonRpcProvider } from "ethers";
import { useEffect, useState } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { getRebirthMonitorData, type RebirthMonitorData } from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

type NearRebirthRow = {
  userId: number;
  wallet: string;
  birthPackage: number;
  progress: number;
  packageOneIncome: number;
};

function formatUsdt(amount: number) {
  return `${amount.toFixed(2)} USDT`;
}

export function RebirthMonitor() {
  const [data, setData] = useState<RebirthMonitorData | null>(null);
  const [nearRebirth, setNearRebirth] = useState<NearRebirthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [rebirthData, nearRebirthRows] = await Promise.all([
          getRebirthMonitorData(),
          getNearRebirthData()
        ]);
        setData(rebirthData);
        setNearRebirth(nearRebirthRows);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Total Rebirths</h2>
        {loading ? <div className="mt-4 h-10 w-28 animate-pulse rounded-2xl bg-gray-800" /> : <div className="mt-4 text-4xl font-bold text-white">{data?.totalRebirths ?? 0}</div>}
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Recent Rebirths</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Original</th>
                <th className="px-4 py-3 font-medium">Rebirth ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.recentRebirths ?? []).map((row) => (
                <tr key={`${row.originalUserId}-${row.rebirthUserId}-${row.timestamp}`}>
                  <td className="px-4 py-4 text-white">#{row.originalUserId}</td>
                  <td className="px-4 py-4 text-gray-300">#{row.rebirthUserId}</td>
                  <td className="px-4 py-4 text-gray-300">{row.wallet}</td>
                  <td className="px-4 py-4 text-blue-300">{formatUsdt(row.income)}</td>
                </tr>
              ))}
              {!loading && (data?.recentRebirths.length ?? 0) === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No rebirth records yet</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Near Rebirth (&gt;50%)</h2>
        <div className="mt-6 space-y-3">
          {nearRebirth.map((row) => {
            const progressBarClass = row.progress >= 75 ? "bg-emerald-500" : "bg-yellow-500";
            return (
              <article key={row.userId} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">User #{row.userId}</div>
                    <div className="text-gray-400">{shortAddress(row.wallet)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-300">{row.progress.toFixed(0)}%</div>
                    <div className="text-gray-400">Rebirth progress</div>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                  <div className={`h-full rounded-full ${progressBarClass}`} style={{ width: `${Math.min(row.progress, 100)}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-gray-300 sm:grid-cols-5">
                  <span>User ID: #{row.userId}</span>
                  <span>Wallet: {shortAddress(row.wallet)}</span>
                  <span>Birth Pkg: {row.birthPackage}</span>
                  <span>Progress: {row.progress.toFixed(0)}%</span>
                  <span>Pkg1 Income: {formatUsdt(row.packageOneIncome)}</span>
                </div>
              </article>
            );
          })}
          {!loading && nearRebirth.length === 0 ? <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-10 text-center text-gray-500">No users near rebirth yet</div> : null}
        </div>
      </section>
    </div>
  );
}

async function getNearRebirthData(): Promise<NearRebirthRow[]> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { staticNetwork: true });
  const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
  const income = new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider);
  const upgrade = new Contract(CONTRACTS.MetaGuildXUpgrade, ABIS.MetaGuildXUpgrade, provider);

  const nextUserId = Number(await core.nextUserId());
  const threshold = 500n;
  const fiftyPct = 250n;
  const nearRows: NearRebirthRow[] = [];

  for (let userId = 1; userId < nextUserId; userId += 1) {
    const [profile, rebirthIds, packageOneIncome] = await Promise.all([
      core.usersById(userId),
      upgrade.getRebirthIds(userId),
      income["totalEarnings(uint256,uint256)"](BigInt(userId), 1n)
    ]);

    const originalPkg = Number(profile.originalPackageLevel ?? 0);
    if (originalPkg !== 1) {
      continue;
    }

    if ((rebirthIds as bigint[]).length > 0) {
      continue;
    }

    const packageOneIncomeBigInt = BigInt(packageOneIncome);
    if (packageOneIncomeBigInt < fiftyPct) {
      continue;
    }

    nearRows.push({
      userId,
      wallet: String(profile.account),
      birthPackage: originalPkg,
      progress: Number((packageOneIncomeBigInt * 100n) / threshold),
      packageOneIncome: Number(packageOneIncomeBigInt) / 10
    });
  }

  return nearRows.sort((a, b) => b.progress - a.progress).slice(0, 25);
}
