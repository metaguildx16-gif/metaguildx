import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getIncomeMonitorData,
  type IncomeMonitorData,
  type IncomeEventRecord,
  type UserIncomeRow
} from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 30_000;

const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

function formatUsdt(amount: number) {
  return `${amount.toFixed(1)} USDT`;
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

function incomeTone(type: string) {
  if (type === "direct") {
    return "text-emerald-300";
  }
  if (type === "level") {
    return "text-blue-300";
  }
  if (type === "spillover") {
    return "text-fuchsia-300";
  }
  return "text-gray-300";
}

function downloadCsv(rows: UserIncomeRow[]) {
  const header = "UserID,Wallet,Direct,Level,Spillover,Total";
  const data = rows.map((row) =>
    [
      row.userId,
      row.wallet,
      row.direct.toFixed(1),
      row.level.toFixed(1),
      row.spillover.toFixed(1),
      row.total.toFixed(1)
    ].join(",")
  );

  const blob = new Blob([[header, ...data].join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metaguildx-income.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({
  label,
  value,
  tone,
  loading
}: {
  label: string;
  value: string;
  tone: string;
  loading: boolean;
}) {
  return (
    <article className="rounded-3xl border border-gray-800 bg-gray-800/80 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      {loading ? (
        <div className="mt-4 h-10 w-28 animate-pulse rounded-2xl bg-gray-700" />
      ) : (
        <h3 className={`mt-4 text-3xl font-bold ${tone}`}>{value}</h3>
      )}
    </article>
  );
}

export function IncomeMonitor() {
  const navigate = useNavigate();
  const [data, setData] = useState<IncomeMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"total" | "direct" | "userId">("total");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await getIncomeMonitorData();
      setData(nextData);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load income data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => {
      void loadData();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const filteredUsers = useMemo(() => {
    const rows = [...(data?.perUser ?? [])];
    rows.sort((a, b) => {
      if (sortBy === "direct") {
        return b.direct - a.direct;
      }
      if (sortBy === "userId") {
        return a.userId - b.userId;
      }
      return b.total - a.total;
    });

    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) {
        return true;
      }
      return row.wallet.toLowerCase().includes(query) || String(row.userId).includes(query);
    });
  }, [data?.perUser, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pieData = useMemo(
    () =>
      data
        ? [
            { name: "Direct (46%)", value: data.totalDirect },
            { name: "Level (40%)", value: data.totalLevel },
            { name: "Spillover", value: data.totalSpillover },
            { name: "Cashback Pool (4%)", value: data.cashbackTotal },
            { name: "Creator Fee (10%)", value: data.creatorTotal }
          ]
        : [],
    [data]
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Failed to load income data: {error}</span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-full bg-red-500 px-4 py-2 font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Direct Income Distributed"
          value={formatUsdt(data?.totalDirect ?? 0)}
          tone="text-emerald-300"
          loading={loading}
        />
        <SummaryCard
          label="Total Level Income Distributed"
          value={formatUsdt(data?.totalLevel ?? 0)}
          tone="text-blue-300"
          loading={loading}
        />
        <SummaryCard
          label="Total Spillover Income"
          value={formatUsdt(data?.totalSpillover ?? 0)}
          tone="text-fuchsia-300"
          loading={loading}
        />
        <SummaryCard
          label="Platform Reserve Balance"
          value={formatUsdt(data?.platformReserve ?? 0)}
          tone="text-orange-300"
          loading={loading}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Income Per User</h2>
              <p className="mt-2 text-sm text-gray-400">
                Grouped from actual `IncomeCredited` events in the core contract.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(filteredUsers)}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Export CSV
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by wallet or user ID"
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "total" | "direct" | "userId")}
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
            >
              <option value="total">Sort by Total</option>
              <option value="direct">Sort by Direct Income</option>
              <option value="userId">Sort by User ID</option>
            </select>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Direct</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Spillover</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                {loading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={8} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded-xl bg-gray-800" />
                        </td>
                      </tr>
                    ))
                  : visibleUsers.map((row, index) => (
                      <tr key={`${row.userId}-${index}`} className="hover:bg-gray-800/60">
                        <td className="px-4 py-4 font-medium text-white">{row.userId}</td>
                        <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                        <td className="px-4 py-4 text-emerald-300">{row.direct.toFixed(1)}</td>
                        <td className="px-4 py-4 text-blue-300">{row.level.toFixed(1)}</td>
                        <td className="px-4 py-4 text-fuchsia-300">{row.spillover.toFixed(1)}</td>
                        <td className="px-4 py-4 font-semibold text-white">{row.total.toFixed(1)}</td>
                        <td className="px-4 py-4 text-gray-300">Level {row.packageLevel}</td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/tree?userId=${row.userId}`)}
                            className="rounded-full border border-gray-700 px-3 py-2 text-xs text-gray-200 transition hover:border-gray-500 hover:text-white"
                          >
                            View Tree
                          </button>
                        </td>
                      </tr>
                    ))}
                {!loading && visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No income distributed yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Income Type Breakdown</h2>
            <p className="mt-2 text-sm text-gray-400">
              Direct, level, spillover, cashback pool, and creator fee proportions.
            </p>
            <div className="mt-6 h-80">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading income data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatUsdt(Number(value))}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "16px"
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Spillover + Reserve Snapshot</h2>
            <div className="mt-5 space-y-3 text-sm text-gray-300">
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3">
                Spillover distributed:{" "}
                <span className="font-semibold text-fuchsia-300">
                  {formatUsdt(data?.totalSpillover ?? 0)}
                </span>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3">
                Platform reserve:{" "}
                <span className="font-semibold text-orange-300">
                  {formatUsdt(data?.platformReserve ?? 0)}
                </span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <h2 className="text-xl font-semibold text-white">Level Income by Level</h2>
          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Total Distributed</th>
                  <th className="px-4 py-3 font-medium">Recipients</th>
                  <th className="px-4 py-3 font-medium">Avg per User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                {(data?.levelBreakdown ?? []).map((row, index) => (
                  <tr key={`${row.level}-${index}`}>
                    <td className="px-4 py-4 text-white">Level {row.level}</td>
                    <td className="px-4 py-4 text-blue-300">{row.totalDistributed.toFixed(1)}</td>
                    <td className="px-4 py-4 text-gray-300">{row.recipients}</td>
                    <td className="px-4 py-4 text-gray-300">{row.avgPerUser.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <h2 className="text-xl font-semibold text-white">Live Income Feed</h2>
          <p className="mt-2 text-sm text-gray-400">
            Auto-refreshes every 30 seconds from recent income credit events.
          </p>

          <div className="mt-6 space-y-3">
            {(data?.recentFeed ?? []).map((event: IncomeEventRecord, index) => (
              <div
                key={`${event.txHash}-${index}-${event.incomeType}`}
                className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm"
              >
                <p className="text-gray-400">{formatRelativeTime(event.timestamp)}</p>
                <p className={`mt-2 font-medium ${incomeTone(event.incomeType)}`}>
                  User #{event.userId} received {event.amount.toFixed(1)} USDT {event.incomeType} income
                  {event.incomeType === "level" && event.level
                    ? ` on level ${event.level}`
                    : ""}
                  {event.fromUserId ? ` from User #${event.fromUserId}` : ""}
                </p>
              </div>
            ))}
            {!loading && (data?.recentFeed.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-8 text-center text-sm text-gray-500">
                No income distributed yet
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
