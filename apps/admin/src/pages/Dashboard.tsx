import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useState } from "react";
import { useContractData } from "../hooks/useContractData";
import { NETWORK } from "../config/contracts";

type EthereumLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(Math.floor(Date.now() / 1000) - timestamp, 0);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} mins ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} hrs ago`;
  }
  return `${Math.floor(seconds / 86400)} days ago`;
}

function formatAmount(value: number | null | undefined) {
  if (value === null) {
    return "--";
  }
  return `${(value ?? 0).toFixed(1)} USDT`;
}

function StatCard({
  icon,
  label,
  value,
  tone,
  loading
}: {
  icon: string;
  label: string;
  value: string;
  tone: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-3xl border border-gray-800 bg-gray-800/80 p-5 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          {loading ? (
            <div className="mt-4 h-10 w-28 animate-pulse rounded-2xl bg-gray-700" />
          ) : (
            <h3 className="mt-4 text-3xl font-bold text-white">{value}</h3>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-3 text-2xl ${tone}`}>{icon}</div>
      </div>
    </article>
  );
}

export function Dashboard() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { stats, chartData, recentRegistrations, loading, error, retry, lastUpdated } =
    useContractData(walletAddress);

  useEffect(() => {
    const ethereum = window.ethereum as EthereumLike | undefined;
    if (!ethereum) {
      return;
    }

    void ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: unknown) => {
        const nextAddress = (accounts as string[])[0] ?? null;
        setWalletAddress(nextAddress);
      })
      .catch(() => {
        setWalletAddress(null);
      });
  }, []);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Contract not connected: {error}</span>
          <button
            type="button"
            onClick={() => void retry()}
            className="rounded-full bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-400"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon="👥"
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          tone="bg-blue-500/15 text-blue-300"
          loading={loading}
        />
        <StatCard
          icon="💵"
          label="Total USDT Volume"
          value={formatAmount(stats.totalVolume)}
          tone="bg-emerald-500/15 text-emerald-300"
          loading={loading}
        />
        <StatCard
          icon="📈"
          label="Today Registrations"
          value={stats.todayRegistrations.toLocaleString()}
          tone="bg-fuchsia-500/15 text-fuchsia-300"
          loading={loading}
        />
        <StatCard
          icon="💎"
          label="Creator Wallet Balance"
          value={formatAmount(stats.creatorIncome)}
          tone="bg-amber-500/15 text-amber-300"
          loading={loading}
        />
        <StatCard
          icon="🏦"
          label="Cashback Pool"
          value={formatAmount(stats.cashbackPool)}
          tone="bg-orange-500/15 text-orange-300"
          loading={loading}
        />
        <StatCard
          icon="🚪"
          label="Surrendered Users"
          value={stats.surrenderedUsers.toLocaleString()}
          tone="bg-rose-500/15 text-rose-300"
          loading={loading}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Daily Registrations (Last 30 Days)
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Live event data grouped from UserRegistered logs.
              </p>
            </div>
            {lastUpdated ? (
              <span className="text-xs text-gray-500">
                Updated {formatRelativeTime(Math.floor(lastUpdated / 1000))}
              </span>
            ) : null}
          </div>

          <div className="mt-6 h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-gray-800 text-sm text-gray-500">
                Loading chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "16px",
                      color: "#e2e8f0"
                    }}
                  />
                  <Bar dataKey="registrations" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Recent Registrations
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Latest 10 joins from blockchain events.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">USDT</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded-xl bg-gray-800" />
                        </td>
                      </tr>
                    ))
                  : recentRegistrations.map((event, index) => (
                      <tr key={`${event.txHash}-${index}`} className="hover:bg-gray-800/60">
                        <td className="px-4 py-4 font-medium text-white">
                          {event.userId}
                        </td>
                        <td className="px-4 py-4 text-gray-300">
                          {shortAddress(event.wallet)}
                        </td>
                        <td className="px-4 py-4 text-gray-300">
                          L{event.packageLevel}
                        </td>
                        <td className="px-4 py-4 text-gray-300">
                          {(event.amount ?? 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-4 text-gray-400">
                          {formatRelativeTime(event.timestamp)}
                        </td>
                        <td className="px-4 py-4">
                          <a
                            className="text-blue-300 transition hover:text-blue-200"
                            href={`${NETWORK.explorer}/tx/${event.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                {!loading && recentRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No registrations found
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
