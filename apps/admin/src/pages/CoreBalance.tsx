import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider, type EventLog } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { ToastStack, type ToastMessage } from "../components/Toast";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { useOwner } from "../hooks/useOwner";
import { sendTransaction } from "../utils/txHelper";
import { shortAddress } from "../utils/packageUtils";

const PAGE_SIZE = 20;

type TransferRow = {
  counterparty: string;
  amount: bigint;
  blockNumber: number;
  txHash: string;
};

type CoreBalanceData = {
  actualBalance: bigint;
  totalIn: bigint;
  totalOut: bigint;
  expectedBalance: bigint;
  mismatch: bigint;
  recentIn: TransferRow[];
  recentOut: TransferRow[];
  stuckRows: StuckDistributionRow[];
  failedRows: FailedDistributionRow[];
};

type StuckDistributionRow = {
  blockNumber: number;
  txHash: string;
  totalIn: bigint;
  totalOut: bigint;
  isRegistrationTx: boolean;
  stuckAmount: bigint;
};

type FailedDistributionRow = {
  userId: number;
  wallet: string;
  packageLevel: number;
};

function getEthereum() {
  return window.ethereum as
    | (Eip1193Provider & {
        on?: (event: string, listener: (args: unknown) => void) => void;
        removeListener?: (event: string, listener: (args: unknown) => void) => void;
      })
    | undefined;
}

function formatUsdt(amount: bigint) {
  return `${(Number(amount) / 1e18).toFixed(2)} USDT`;
}

function formatSignedUsdt(amount: bigint) {
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  return `${sign}${(Number(absolute) / 1e18).toFixed(2)} USDT`;
}

async function queryTransferLogs(
  usdt: Contract,
  filter: ReturnType<Contract["filters"]["Transfer"]>,
  currentBlock: number
) {
  const results: EventLog[] = [];
  for (let start = NETWORK.startBlock; start <= currentBlock; start += 49_000) {
    const end = Math.min(start + 48_999, currentBlock);
    const chunk = await usdt.queryFilter(filter, start, end);
    results.push(...(chunk as EventLog[]));
  }
  return results;
}

async function loadCoreBalanceData(): Promise<CoreBalanceData> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
  const usdt = new Contract(CONTRACTS.USDT, ABIS.USDT, provider);
  const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
  const currentBlock = await provider.getBlockNumber();
  const registrationTxHashes = new Set<string>();
  for (let start = NETWORK.startBlock; start <= currentBlock; start += 49_000) {
    const end = Math.min(start + 48_999, currentBlock);
    const chunk = await core.queryFilter(core.filters.UserRegistered(), start, end);
    for (const log of chunk) {
      registrationTxHashes.add(log.transactionHash.toLowerCase());
    }
  }

  const [inLogs, outLogs, actualBalance] = await Promise.all([
    queryTransferLogs(usdt, usdt.filters.Transfer(null, CONTRACTS.MetaGuildXCore), currentBlock),
    queryTransferLogs(usdt, usdt.filters.Transfer(CONTRACTS.MetaGuildXCore, null), currentBlock),
    usdt.balanceOf(CONTRACTS.MetaGuildXCore)
  ]);

  const recentIn = [...inLogs]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, PAGE_SIZE)
    .map((log) => ({
      counterparty: String(log.args.from),
      amount: BigInt(log.args.value),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash
    }));

  const recentOut = [...outLogs]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, PAGE_SIZE)
    .map((log) => ({
      counterparty: String(log.args.to),
      amount: BigInt(log.args.value),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash
    }));

  const totalIn = inLogs.reduce((sum, log) => sum + BigInt(log.args.value), 0n);
  const totalOut = outLogs.reduce((sum, log) => sum + BigInt(log.args.value), 0n);
  const expectedBalance = totalIn - totalOut;
  const groupedByTx = new Map<string, StuckDistributionRow>();

  for (const log of inLogs) {
    const current = groupedByTx.get(log.transactionHash) ?? {
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      totalIn: 0n,
      totalOut: 0n,
      isRegistrationTx: false,
      stuckAmount: 0n
    };
    current.totalIn += BigInt(log.args.value);
    current.blockNumber = Math.max(current.blockNumber, log.blockNumber);
    groupedByTx.set(log.transactionHash, current);
  }

  for (const log of outLogs) {
    const current = groupedByTx.get(log.transactionHash) ?? {
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      totalIn: 0n,
      totalOut: 0n,
      isRegistrationTx: false,
      stuckAmount: 0n
    };
    current.totalOut += BigInt(log.args.value);
    current.blockNumber = Math.max(current.blockNumber, log.blockNumber);
    groupedByTx.set(log.transactionHash, current);
  }

  const heuristicStuckRows = [...groupedByTx.values()]
    .map((row) => {
      const isRegistrationTx = registrationTxHashes.has(row.txHash.toLowerCase());
      const isStuck = row.totalIn > 0n && row.totalOut === 0n && isRegistrationTx;
      return {
        ...row,
        isRegistrationTx,
        stuckAmount: isStuck ? row.totalIn : 0n
      };
    })
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, PAGE_SIZE);

  const failedRows: FailedDistributionRow[] = [];
  try {
    const ids = await core.getFailedUserIds();
    for (const id of ids as bigint[]) {
      const uid = Number(id);
      const isFailed = await core.failedDistribution(uid);
      if (isFailed) {
        const profile = await core.usersById(uid);
        failedRows.push({
          userId: uid,
          wallet: String(profile.account),
          packageLevel: Number(profile.packageLevel)
        });
      }
    }
  } catch {
    // failedDistribution not available on older impl — ignore
  }

  const stuckRows = failedRows.length > 0 ? heuristicStuckRows : [];

  return {
    actualBalance: BigInt(actualBalance),
    totalIn,
    totalOut,
    expectedBalance,
    mismatch: BigInt(actualBalance) - expectedBalance,
    recentIn,
    recentOut,
    stuckRows,
    failedRows
  };
}

function TransferTable({
  title,
  direction,
  rows
}: {
  title: string;
  direction: "from" | "to";
  rows: TransferRow[];
}) {
  return (
    <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
        <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
          <thead className="bg-gray-950/70 text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">{direction === "from" ? "From" : "To"}</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Block</th>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900/70">
            {rows.map((row, index) => (
              <tr key={`${row.txHash}-${row.counterparty}-${row.blockNumber}-${index}`} className="hover:bg-gray-800/60">
                <td className="px-4 py-4 text-gray-300">{shortAddress(row.counterparty)}</td>
                <td className="px-4 py-4 text-cyan-300">{formatUsdt(row.amount)}</td>
                <td className="px-4 py-4 text-gray-300">{row.blockNumber}</td>
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                  No transfers found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function CoreBalancePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [data, setData] = useState<CoreBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { isOwner } = useOwner(walletAddress);

  const addToast = (message: string, type: ToastMessage["type"]) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) {
      return;
    }

    const syncWallet = async () => {
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      setWalletAddress(accounts[0] ?? null);
    };

    void syncWallet();

    const handleAccountsChanged = (accounts: unknown) => {
      setWalletAddress(((accounts as string[]) ?? [])[0] ?? null);
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const nextData = await loadCoreBalanceData();
      setData(nextData);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load core balance", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const hasMismatch = useMemo(() => Boolean(data && data.mismatch !== 0n), [data]);
  const hasFailedDistributions = useMemo(() => (data?.failedRows.length ?? 0) > 0, [data]);
  const stuckAmount = useMemo(() => {
    if (!data) {
      return 0n;
    }
    return data.actualBalance - data.expectedBalance;
  }, [data]);
  const latestStuckRow = useMemo(
    () =>
      hasFailedDistributions
        ? (data?.stuckRows ?? []).find((row) => row.stuckAmount > 0n) ?? (data?.stuckRows ?? [])[0] ?? null
        : null,
    [data, hasFailedDistributions]
  );

  const handleSweep = async () => {
    if (!isOwner) {
      addToast("Unauthorized: owner wallet required", "error");
      return;
    }

    const confirmed = window.confirm(
      `Sweep ${data ? formatUsdt(data.actualBalance) : "current Core balance"} to creator wallet?`
    );
    if (!confirmed) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      addToast("MetaMask not found", "error");
      return;
    }

    setSweeping(true);
    addToast("Confirm sweep in MetaMask...", "info");
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);

    await sendTransaction(
      () => core.adminSweepToCreator(CONTRACTS.USDT),
      (message) => {
        addToast(message, "success");
        void refresh();
      },
      (message) => addToast(message, "error"),
      "Core balance swept to creator"
    );
    setSweeping(false);
  };

  const handleRetry = async (userId: number) => {
    if (!isOwner) {
      addToast("Unauthorized: owner wallet required", "error");
      return;
    }

    const confirmed = window.confirm(`Retry income distribution for User #${userId}?`);
    if (!confirmed) return;

    const ethereum = getEthereum();
    if (!ethereum) {
      addToast("MetaMask not found", "error");
      return;
    }

    addToast(`Retrying distribution for User #${userId}...`, "info");
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);

    await sendTransaction(
      () => core.adminRetryDistribution(userId),
      (message) => {
        addToast(message, "success");
        void refresh();
      },
      (message) => addToast(message, "error"),
      `Distribution retried for User #${userId}`
    );
  };

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
          <p className="text-sm text-gray-400">Core USDT Balance</p>
          <h2 className="mt-4 text-3xl font-bold text-cyan-300">
            {loading ? "Loading..." : formatUsdt(data?.actualBalance ?? 0n)}
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 rounded-full bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Refresh
          </button>
        </article>

        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Total In</p>
          <h2 className="mt-4 text-3xl font-bold text-emerald-300">
            {loading ? "Loading..." : formatUsdt(data?.totalIn ?? 0n)}
          </h2>
        </article>

        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Total Out</p>
          <h2 className="mt-4 text-3xl font-bold text-amber-300">
            {loading ? "Loading..." : formatUsdt(data?.totalOut ?? 0n)}
          </h2>
        </article>

        <article className={`rounded-3xl border p-6 ${hasMismatch ? "border-red-500/30 bg-red-500/10" : "border-gray-800 bg-gray-900/90"}`}>
          <p className="text-sm text-gray-400">Net Check</p>
          <h2 className={`mt-4 text-3xl font-bold ${hasMismatch ? "text-red-300" : "text-emerald-300"}`}>
            {loading ? "Loading..." : formatSignedUsdt(data?.mismatch ?? 0n)}
          </h2>
          <p className="mt-3 text-sm text-gray-300">
            Expected {loading ? "--" : formatUsdt(data?.expectedBalance ?? 0n)}
          </p>
        </article>
      </section>

      {hasMismatch ? (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Stuck Amount Warning</h2>
              <p className="mt-2 text-sm text-red-100">
                Actual Core balance does not match the transfer-derived balance.
                Stuck amount: {formatSignedUsdt(stuckAmount)}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSweep()}
              disabled={!isOwner || sweeping || !data || data.actualBalance === 0n}
              className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-gray-950 disabled:opacity-50"
            >
              {sweeping ? "Sweeping..." : "Sweep to Creator"}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-sm text-emerald-100">
          Balance check passed. Actual Core balance matches the transfer-derived balance.
        </section>
      )}

      {data && hasFailedDistributions && data.actualBalance > 0n && latestStuckRow ? (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Stuck Distribution Check</h2>
              <p className="mt-2 text-sm text-red-100">
                Active failed distributions detected on-chain.
                Latest related TX: {shortAddress(latestStuckRow.txHash)}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSweep()}
              disabled={!isOwner || sweeping || data.actualBalance === 0n}
              className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-gray-950 disabled:opacity-50"
            >
              {sweeping ? "Sweeping..." : "Sweep to Creator"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <TransferTable title="Recent USDT Transfers To Core" direction="from" rows={data?.recentIn ?? []} />
        <TransferTable title="Recent USDT Transfers From Core" direction="to" rows={data?.recentOut ?? []} />
      </div>

      {(data?.failedRows.length ?? 0) > 0 ? (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-xl font-semibold text-white">Failed Distributions</h2>
          <p className="mt-2 text-sm text-gray-400">
            These users registered but income distribution failed. Admin can retry each one.
          </p>
          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/70">
                {(data?.failedRows ?? []).map((row, index) => (
                  <tr key={`${row.userId}-${index}`} className="hover:bg-gray-800/60">
                    <td className="px-4 py-4 text-white">#{row.userId}</td>
                    <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                    <td className="px-4 py-4 text-amber-300">Pkg {row.packageLevel}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void handleRetry(row.userId)}
                        disabled={!isOwner}
                        className="rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-red-400"
                      >
                        Retry Distribution
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Stuck Distribution Check</h2>
        <p className="mt-2 text-sm text-gray-400">
          Uses active failed distributions from Core as the source of truth.
          If no failed distributions exist, this section stays clear.
        </p>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Block</th>
                <th className="px-4 py-3 font-medium">TX</th>
                <th className="px-4 py-3 font-medium">IN</th>
                <th className="px-4 py-3 font-medium">OUT</th>
                <th className="px-4 py-3 font-medium">Stuck?</th>
                <th className="px-4 py-3 font-medium">Explorer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.stuckRows ?? []).map((row, index) => (
                <tr key={`${row.txHash}-${index}`} className="hover:bg-gray-800/60">
                  <td className="px-4 py-4 text-gray-300">{row.blockNumber}</td>
                  <td className="px-4 py-4 text-gray-300">{shortAddress(row.txHash)}</td>
                  <td className="px-4 py-4 text-emerald-300">{formatUsdt(row.totalIn)}</td>
                  <td className="px-4 py-4 text-amber-300">{formatUsdt(row.totalOut)}</td>
                  <td className="px-4 py-4">
                    {row.stuckAmount > 0n ? (
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-red-500/15 text-red-300">
                        Stuck {formatUsdt(row.stuckAmount)}
                      </span>
                    ) : row.totalIn > 0n && row.totalOut === 0n ? (
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-amber-500/15 text-amber-300">
                        Transfer only
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-300">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <a
                      href={`${NETWORK.explorer}/tx/${row.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-300 transition hover:text-blue-200"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
              {!loading && !hasFailedDistributions ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-emerald-300">
                    No stuck distributions ✅
                  </td>
                </tr>
              ) : null}
              {!loading && hasFailedDistributions && (data?.stuckRows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    Failed distributions exist, but no matching transfer rows were found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
