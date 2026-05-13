import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllTransactions,
  type TransactionRecord
} from "../hooks/useContractData";
import { NETWORK } from "../config/contracts";
import { shortAddress } from "../utils/packageUtils";

const PAGE_SIZE = 25;

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

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

function badgeTone(type: TransactionRecord["type"]) {
  switch (type) {
    case "Registration":
      return "bg-emerald-500/15 text-emerald-200";
    case "Income":
      return "bg-blue-500/15 text-blue-200";
    case "Upgrade":
      return "bg-fuchsia-500/15 text-fuchsia-200";
    case "Rebirth":
      return "bg-orange-500/15 text-orange-200";
    case "Reactivation":
      return "bg-amber-500/15 text-amber-200";
    case "Cashback":
      return "bg-amber-500/15 text-amber-200";
    case "Placement":
      return "bg-gray-500/15 text-gray-200";
  }
}

function exportCsv(rows: TransactionRecord[]) {
  const header = "Type,UserID,Wallet,Amount,Details,DateTime,TxHash";
  const data = rows.map((row) =>
    [
      row.type,
      row.userId,
      row.wallet,
      row.amount === null ? "-" : row.amount.toFixed(1),
      `"${row.details}"`,
      formatDateTime(row.timestamp),
      row.txHash
    ].join(",")
  );
  const blob = new Blob([[header, ...data].join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `metaguildx-transactions-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TransactionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextRows = await getAllTransactions();
      setRows(nextRows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load transactions"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions();
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const startUnix = startDate
      ? Math.floor(new Date(`${startDate}T00:00:00`).getTime() / 1000)
      : null;
    const endUnix = endDate
      ? Math.floor(new Date(`${endDate}T23:59:59`).getTime() / 1000)
      : null;

    return rows.filter((row) => {
      const matchesType = typeFilter === "All" || row.type === typeFilter;
      const matchesSearch =
        !query ||
        row.wallet.toLowerCase().includes(query) ||
        row.txHash.toLowerCase().includes(query) ||
        String(row.userId).includes(query);
      const matchesStart = startUnix === null || row.timestamp >= startUnix;
      const matchesEnd = endUnix === null || row.timestamp <= endUnix;
      return matchesType && matchesSearch && matchesStart && matchesEnd;
    });
  }, [endDate, rows, search, startDate, typeFilter]);

  useEffect(() => {
    setPage(1);
    setPageInput("1");
  }, [typeFilter, search, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return {
      total: filteredRows.length,
      registrations: filteredRows.filter((row) => row.type === "Registration").length,
      income: filteredRows.filter((row) => row.type === "Income").length,
      upgrades: filteredRows.filter((row) => row.type === "Upgrade").length,
      today: filteredRows.filter((row) => row.timestamp >= now - 86400).length
    };
  }, [filteredRows]);

  const setQuickRange = (days: number | null) => {
    if (days === null) {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          <span>Failed to load transactions: {error}</span>
          <button
            type="button"
            onClick={() => void loadTransactions()}
            className="rounded-full bg-red-500 px-4 py-2 font-medium text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="flex flex-wrap gap-3">
        <div className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200">
          Total Txs: {stats.total}
        </div>
        <div className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200">
          Registrations: {stats.registrations}
        </div>
        <div className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200">
          Income Credits: {stats.income}
        </div>
        <div className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200">
          Upgrades: {stats.upgrades}
        </div>
        <div className="rounded-full border border-gray-800 bg-gray-900 px-4 py-2 text-sm text-gray-200">
          Today: {stats.today}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Transaction Log</h2>
            <p className="mt-2 text-sm text-gray-400">
              Unified blockchain activity from registrations, income credits, upgrades, reactivations, cashback, and placements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(filteredRows)}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1fr_0.7fr_0.7fr]">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
          >
            {["All", "Registration", "Income", "Upgrade", "Rebirth", "Reactivation", "Cashback", "Placement"].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )
            )}
          </select>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by wallet, user ID, or tx hash"
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
          />

          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setQuickRange(1)}
            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
          >
            Last 24h
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(7)}
            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(30)}
            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => setQuickRange(null)}
            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
          >
            All time
          </button>
          <div className="flex items-center rounded-full border border-gray-800 bg-gray-950 px-4 py-2 text-sm text-gray-400">
            Showing {visibleRows.length} of {filteredRows.length} transactions
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-5 animate-pulse rounded-xl bg-gray-800" />
                      </td>
                    </tr>
                  ))
                : visibleRows.map((row, index) => (
                    <tr key={`${row.txHash}-${row.type}-${row.userId}-${index}`} className="hover:bg-gray-800/60">
                      <td className="px-4 py-4 text-gray-500">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeTone(row.type)}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/users?search=${row.userId}`)}
                          className="font-medium text-white transition hover:text-blue-300"
                        >
                          {row.userId}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-300">
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(row.wallet)}
                          className="transition hover:text-white"
                        >
                          {shortAddress(row.wallet)}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-300">
                        {row.amount === null ? "-" : `${row.amount.toFixed(1)} USDT`}
                      </td>
                      <td className="px-4 py-4 text-gray-300">{row.details}</td>
                      <td className="px-4 py-4 text-gray-400" title={formatDateTime(row.timestamp)}>
                        {formatRelativeTime(row.timestamp)}
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={`${NETWORK.explorer}/tx/${row.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-300 transition hover:text-blue-200"
                        >
                          {shortAddress(row.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
              {!loading && visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No transactions found. Try changing filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => {
                const next = Math.max(1, page - 1);
                setPage(next);
                setPageInput(String(next));
              }}
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                setPageInput(String(next));
              }}
              className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200 disabled:opacity-50"
            >
              Next
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Jump to page</span>
              <input
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                className="w-20 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2 text-white outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(
                    totalPages,
                    Math.max(1, Number.parseInt(pageInput || "1", 10) || 1)
                  );
                  setPage(next);
                  setPageInput(String(next));
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-white"
              >
                Go
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
