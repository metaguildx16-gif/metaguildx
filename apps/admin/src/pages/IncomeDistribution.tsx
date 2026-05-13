import { useEffect, useMemo, useState } from "react";
import { NETWORK } from "../config/contracts";
import {
  getIncomeDistributionData,
  type IncomeDistributionData
} from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

const REFRESH_INTERVAL_MS = 10_000;

function formatUsdt(amount: number) {
  return `${amount.toFixed(2)} USDT`;
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(Math.floor(Date.now() / 1000) - timestamp, 0);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function IncomeDistribution() {
  const [data, setData] = useState<IncomeDistributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getIncomeDistributionData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load distribution monitor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => void loadData(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.perUser ?? []).filter((row) => {
      if (!query) return true;
      return row.wallet.toLowerCase().includes(query) || String(row.userId).includes(query);
    });
  }, [data?.perUser, search]);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Failed to load income distribution monitor: {error}</span>
          <button type="button" onClick={() => void loadData()} className="rounded-full bg-red-500 px-4 py-2 font-medium text-white">
            Retry
          </button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Direct Today", formatUsdt(data?.summaryToday.direct ?? 0), "text-emerald-300"],
          ["Level Today", formatUsdt(data?.summaryToday.level ?? 0), "text-blue-300"],
          ["Creator Fallback", formatUsdt(data?.summaryToday.creatorFallback ?? 0), "text-amber-300"],
          ["Cashback Pool Today", formatUsdt(data?.summaryToday.cashbackPool ?? 0), "text-fuchsia-300"],
          ["Creator Fee Today", formatUsdt(data?.summaryToday.creatorFee ?? 0), "text-orange-300"],
          ["Router Balance", formatUsdt(data?.routerBalance ?? 0), "text-cyan-300"],
          ["Total Distributions", String(data?.totalDistributions ?? 0), "text-white"],
          ["Failed Distributions", String(data?.failedDistributions ?? 0), "text-emerald-300"]
        ].map(([label, value, tone]) => (
          <article key={label} className="rounded-3xl border border-gray-800 bg-gray-900/90 p-5">
            <p className="text-sm text-gray-400">{label}</p>
            {loading ? <div className="mt-4 h-10 w-28 animate-pulse rounded-2xl bg-gray-800" /> : <h3 className={`mt-4 text-3xl font-bold ${tone}`}>{value}</h3>}
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Live Distribution Feed</h2>
              <p className="mt-2 text-sm text-gray-400">Auto-refreshes every 10 seconds from registration-linked income events.</p>
            </div>
            {data?.lastDistributionAt ? (
              <div className="rounded-full border border-gray-800 bg-gray-950 px-4 py-2 text-xs text-gray-400">
                Last distribution {formatRelativeTime(data.lastDistributionAt)}
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {(data?.feed ?? []).map((event, index) => (
              <article
                key={`${
                  (
                    event as {
                      txHash?: string;
                      transactionHash?: string;
                      hash?: string;
                    }
                  ).txHash ??
                  (
                    event as {
                      txHash?: string;
                      transactionHash?: string;
                      hash?: string;
                    }
                  ).transactionHash ??
                  (
                    event as {
                      txHash?: string;
                      transactionHash?: string;
                      hash?: string;
                    }
                  ).hash
                }-${index}`}
                className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Registration Distribution</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      User #{event.userId} paid {formatUsdt(event.amount)}
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      Sponsor #{event.sponsorId} • {shortAddress(event.wallet)} • {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                  <a href={`${NETWORK.explorer}/tx/${event.txHash}`} target="_blank" rel="noreferrer" className="rounded-full border border-gray-700 px-4 py-2 text-sm text-blue-300">
                    {shortAddress(event.txHash)}
                  </a>
                </div>

                <div className="mt-5 space-y-3">
                  {event.lines.map((line, index) => (
                    <div key={`${event.txHash}-${line.label}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-sm">
                      <div>
                        <div className="font-medium text-white">{line.label}</div>
                        <div className="text-gray-400">{line.recipient}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-white">{formatUsdt(line.amount)}</div>
                        <div className={line.status === "fallback" ? "text-amber-300" : "text-emerald-300"}>
                          {line.status === "fallback" ? "Fallback to creator" : "Sent"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-800 bg-gray-900/70 px-4 py-3 text-sm">
                  <span className="text-gray-400">Total distributed</span>
                  <span className="font-semibold text-emerald-300">{formatUsdt(event.totalDistributed)}</span>
                </div>
              </article>
            ))}

            {!loading && (data?.feed.length ?? 0) === 0 ? (
              <div className="rounded-3xl border border-gray-800 bg-gray-950/60 px-4 py-10 text-center text-sm text-gray-500">
                No distribution events found yet
              </div>
            ) : null}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Distribution Summary Today</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Direct Income", data?.summaryToday.direct ?? 0],
                ["Level Income", data?.summaryToday.level ?? 0],
                ["Spillover", data?.summaryToday.spillover ?? 0],
                ["Crossline", data?.summaryToday.crossline ?? 0],
                ["Creator Fallback", data?.summaryToday.creatorFallback ?? 0],
                ["Creator Fee", data?.summaryToday.creatorFee ?? 0],
                ["Cashback Pool", data?.summaryToday.cashbackPool ?? 0],
                ["Total", data?.summaryToday.total ?? 0]
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-3 text-gray-300">
                  <span>{label}</span>
                  <span className="font-semibold text-white">{formatUsdt(Number(value))}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Creator Wallet Monitor</h2>
            <div className="mt-5 space-y-3 rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm text-gray-300">
              <div>Creator Wallet: <span className="font-mono text-xs text-white">{data?.creatorWallet ?? "-"}</span></div>
              <div>Received Today: <span className="text-amber-300">{formatUsdt(data?.creatorToday ?? 0)}</span></div>
              <div>Total All Time: <span className="text-amber-300">{formatUsdt(data?.creatorAllTime ?? 0)}</span></div>
            </div>
          </article>

          <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Per-User Income Received</h2>
                <p className="mt-2 text-sm text-gray-400">Search by user ID or wallet address.</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user"
                className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              />
            </div>

            <div className="mt-6 space-y-3">
              {filteredUsers.slice(0, 12).map((row) => (
                <div key={row.userId} className="rounded-2xl border border-gray-800 bg-gray-950/60 px-4 py-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">User #{row.userId}</div>
                      <div className="text-gray-400">{shortAddress(row.wallet)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-white">{formatUsdt(row.total)}</div>
                      <div className="text-gray-400">Total received</div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 text-gray-300">
                    <div>Direct: {formatUsdt(row.direct)}</div>
                    <div>Level: {formatUsdt(row.level)}</div>
                    <div>Spillover: {formatUsdt(row.spillover)}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
