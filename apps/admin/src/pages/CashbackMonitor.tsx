import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { NETWORK } from "../config/contracts";
import {
  getCashbackMonitorData,
  type CashbackClaimRecord,
  type CashbackMonitorData,
  type SurrenderedUserRecord
} from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

const PAGE_SIZE = 20;

function formatUsdt(amount: number) {
  return `${amount.toFixed(1)} USDT`;
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function exportSurrenderedCsv(rows: SurrenderedUserRecord[]) {
  const header =
    "UserID,Wallet,SurrenderDate,SurrenderValue,CashbackEarned,PoolSharePercent";
  const data = rows.map((row) =>
    [
      row.userId,
      row.wallet,
      formatDateTime(row.surrenderDate),
      row.surrenderValue.toFixed(1),
      row.cashbackEarned.toFixed(1),
      row.poolSharePercent.toFixed(2)
    ].join(",")
  );
  const blob = new Blob([[header, ...data].join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metaguildx-surrendered-users.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function exportClaimsCsv(rows: CashbackClaimRecord[]) {
  const header = "Date,UserID,Wallet,Amount,TxHash";
  const data = rows.map((row) =>
    [
      formatDateTime(row.timestamp),
      row.userId,
      row.wallet,
      row.amount.toFixed(1),
      row.txHash
    ].join(",")
  );
  const blob = new Blob([[header, ...data].join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "metaguildx-claim-history.csv";
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

export function CashbackMonitor() {
  const [data, setData] = useState<CashbackMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "value" | "earned">("date");
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await getCashbackMonitorData();
      setData(nextData);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load cashback data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const rows = [...(data?.surrenderedUsers ?? [])];
    rows.sort((a, b) => {
      if (sortBy === "value") {
        return b.surrenderValue - a.surrenderValue;
      }
      if (sortBy === "earned") {
        return b.cashbackEarned - a.cashbackEarned;
      }
      return b.surrenderDate - a.surrenderDate;
    });

    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!query) {
        return true;
      }
      return row.wallet.toLowerCase().includes(query) || String(row.userId).includes(query);
    });
  }, [data?.surrenderedUsers, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Failed to load cashback data: {error}</span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-full bg-red-500 px-4 py-2 font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl border border-emerald-500/15 bg-emerald-500/5 p-6 text-sm text-emerald-50">
        <h2 className="text-lg font-semibold text-white">Surrender Rules</h2>
        <div className="mt-4 grid gap-2 text-emerald-50/90">
          <div>✓ Minimum 3 months after registration</div>
          <div>✓ Maximum 6 months window</div>
          <div>✓ Only once per User ID</div>
          <div>✓ After surrender: 4% of new joins flows into cashback distribution</div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2">
            Eligible now: {data?.eligibleToSurrender ?? 0}
          </div>
          <div className="rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-amber-100">
            Missed window: {data?.missedWindow ?? 0}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Pool Balance"
          value={formatUsdt(data?.totalPoolBalance ?? 0)}
          tone="text-emerald-300"
          loading={loading}
        />
        <SummaryCard
          label="Total Surrendered Users"
          value={String(data?.totalSurrenderedUsers ?? 0)}
          tone="text-red-300"
          loading={loading}
        />
        <SummaryCard
          label="Total Cashback Paid Out"
          value={formatUsdt(data?.totalCashbackPaidOut ?? 0)}
          tone="text-blue-300"
          loading={loading}
        />
        <SummaryCard
          label="Daily Release Rate"
          value={formatUsdt(data?.dailyReleaseRate ?? 0)}
          tone="text-fuchsia-300"
          loading={loading}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Surrendered Users</h2>
              <p className="mt-2 text-sm text-gray-400">
                Derived from `UserSurrendered` events and on-chain user profiles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportSurrenderedCsv(filteredUsers)}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Export Surrendered Users CSV
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by wallet or user ID"
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
            />
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "date" | "value" | "earned")
              }
              className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="date">Sort by Surrender Date</option>
              <option value="value">Sort by Surrender Value</option>
              <option value="earned">Sort by Cashback Earned</option>
            </select>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Surrender Date</th>
                  <th className="px-4 py-3 font-medium">Surrender Value</th>
                  <th className="px-4 py-3 font-medium">Cashback Earned</th>
                  <th className="px-4 py-3 font-medium">Pool Share %</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                {loading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="h-5 animate-pulse rounded-xl bg-gray-800" />
                        </td>
                      </tr>
                    ))
                  : visibleUsers.map((row) => (
                      <tr key={row.userId} className="hover:bg-gray-800/60">
                        <td className="px-4 py-4 font-medium text-white">{row.userId}</td>
                        <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                        <td className="px-4 py-4 text-gray-400">{formatDateTime(row.surrenderDate)}</td>
                        <td className="px-4 py-4 text-gray-300">{row.surrenderValue.toFixed(1)}</td>
                        <td className="px-4 py-4 text-blue-300">{row.cashbackEarned.toFixed(1)}</td>
                        <td className="px-4 py-4 text-gray-300">{row.poolSharePercent.toFixed(2)}%</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                              row.status === "Active Receiver"
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-gray-500/15 text-gray-300"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                {!loading && visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      No users have surrendered yet
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Claim History</h2>
                <p className="mt-2 text-sm text-gray-400">Latest 50 cashback claim events.</p>
              </div>
              <button
                type="button"
                onClick={() => exportClaimsCsv(data?.claimHistory ?? [])}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                Export Claim History CSV
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
              <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
                <thead className="bg-gray-950/70 text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">User ID</th>
                    <th className="px-4 py-3 font-medium">Wallet</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                  {(data?.claimHistory ?? []).map((claim) => (
                    <tr key={`${claim.txHash}-${claim.userId}`}>
                      <td className="px-4 py-4 text-gray-400">{formatDateTime(claim.timestamp)}</td>
                      <td className="px-4 py-4 text-white">{claim.userId}</td>
                      <td className="px-4 py-4 text-gray-300">{shortAddress(claim.wallet)}</td>
                      <td className="px-4 py-4 text-blue-300">{claim.amount.toFixed(1)}</td>
                      <td className="px-4 py-4">
                        <a
                          href={`${NETWORK.explorer}/tx/${claim.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-300 transition hover:text-blue-200"
                        >
                          {shortAddress(claim.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                  {!loading && (data?.claimHistory.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                        No cashback claims yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Cashback Pool Growth</h2>
            <div className="mt-6 h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading cashback data...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.poolGrowth ?? []}>
                    <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => formatUsdt(Number(value))}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "16px"
                      }}
                    />
                    <Line type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
