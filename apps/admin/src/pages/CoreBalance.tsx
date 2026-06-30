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

const REGISTERED_TX_CACHE_KEY = "mgx_admin_core_balance_registered_txs_v1";
const USDT_IN_CACHE_KEY = "mgx_admin_core_balance_usdt_in_v1";
const USDT_OUT_CACHE_KEY = "mgx_admin_core_balance_usdt_out_v1";

type IncrementalCache<T> = {
  lastScannedBlock: number;
  data: T[];
  timestamp: number;
};

type CachedTransferRow = {
  counterparty: string;
  amount: string;
  blockNumber: number;
  txHash: string;
};

function readIncrementalCache<T>(key: string): IncrementalCache<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IncrementalCache<T>;
    if (typeof parsed.lastScannedBlock !== "number" || !Array.isArray(parsed.data)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeIncrementalCache<T>(key: string, lastScannedBlock: number, data: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ lastScannedBlock, data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable - silently skip caching
  }
}

async function queryFilterWithRetry(contract: Contract, filter: any, start: number, end: number, retries = 3): Promise<any[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await contract.queryFilter(filter, start, end);
    } catch (err: any) {
      const isLimitErr =
        err?.code === -32005 ||
        err?.error?.code === -32005 ||
        /limit exceeded/i.test(err?.message ?? "") ||
        /limit exceeded/i.test(err?.error?.message ?? "");
      if (isLimitErr && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return [];
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

async function queryTransferLogs(
  usdt: Contract,
  filter: ReturnType<Contract["filters"]["Transfer"]>,
  currentBlock: number,
  cacheKey: string,
  counterpartyField: "from" | "to"
) {
  const cached = readIncrementalCache<CachedTransferRow>(cacheKey);
  const results: TransferRow[] =
    cached?.data.map((row) => ({
      ...row,
      amount: BigInt(row.amount)
    })) ?? [];
  const fromBlock = Math.max(NETWORK.startBlock, (cached?.lastScannedBlock ?? NETWORK.startBlock - 1) + 1);

  if (fromBlock > currentBlock) {
    return results;
  }

  for (let start = fromBlock; start <= currentBlock; start += 9_999) {
    const end = Math.min(start + 9_998, currentBlock);
    const chunk = await queryFilterWithRetry(usdt, filter, start, end);
    for (const log of chunk as EventLog[]) {
      results.push({
        counterparty: String(log.args[counterpartyField]),
        amount: BigInt(log.args.value),
        blockNumber: log.blockNumber,
        txHash: log.transactionHash
      });
    }
  }

  writeIncrementalCache<CachedTransferRow>(
    cacheKey,
    currentBlock,
    results.map((row) => ({
      ...row,
      amount: row.amount.toString()
    }))
  );
  return results;
}

async function queryRegisteredTxHashes(core: Contract, currentBlock: number) {
  const cached = readIncrementalCache<string>(REGISTERED_TX_CACHE_KEY);
  const hashes = new Set<string>(cached?.data ?? []);
  const fromBlock = Math.max(NETWORK.startBlock, (cached?.lastScannedBlock ?? NETWORK.startBlock - 1) + 1);

  if (fromBlock > currentBlock) {
    return hashes;
  }

  for (let start = fromBlock; start <= currentBlock; start += 9_999) {
    const end = Math.min(start + 9_998, currentBlock);
    const chunk = await queryFilterWithRetry(core, core.filters.UserRegistered(), start, end);
    for (const log of chunk) {
      hashes.add(log.transactionHash.toLowerCase());
    }
  }

  writeIncrementalCache(REGISTERED_TX_CACHE_KEY, currentBlock, [...hashes]);
  return hashes;
}

async function loadFailedDistributionRows(core: Contract) {
  const failedRows: FailedDistributionRow[] = [];
  try {
    const ids = await core.getFailedUserIds();
    for (const id of ids as bigint[]) {
      const uid = Number(id);
      const isFailed = await core.failedDistribution(uid);
      if (isFailed) {
        const [profile, failedPackageLevelRaw] = await Promise.all([
          core.usersById(uid),
          core.failedDistributionPackageLevel(uid).catch(() => 0n)
        ]);
        failedRows.push({
          userId: uid,
          wallet: String(profile.account),
          packageLevel: Number(failedPackageLevelRaw) || Number(profile.packageLevel)
        });
      }
    }
  } catch {
    // failedDistribution not available on older impl - ignore
  }
  return failedRows;
}

async function loadCoreBalanceEssentials(): Promise<CoreBalanceData> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { batchMaxCount: 1, staticNetwork: true });
  const usdt = new Contract(CONTRACTS.USDT, ABIS.USDT, provider);
  const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
  const [actualBalance, failedRows] = await Promise.all([
    usdt.balanceOf(CONTRACTS.MetaGuildXCore),
    loadFailedDistributionRows(core)
  ]);

  return {
    actualBalance: BigInt(actualBalance),
    totalIn: 0n,
    totalOut: 0n,
    expectedBalance: BigInt(actualBalance),
    mismatch: 0n,
    recentIn: [],
    recentOut: [],
    stuckRows: [],
    failedRows
  };
}

async function loadCoreBalanceData(baseData?: CoreBalanceData): Promise<CoreBalanceData> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { batchMaxCount: 1, staticNetwork: true });
  const usdt = new Contract(CONTRACTS.USDT, ABIS.USDT, provider);
  const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
  const currentBlock = await provider.getBlockNumber();
  const [registrationTxHashesResult, inLogsResult, outLogsResult] = await runWithConcurrency<Set<string> | TransferRow[]>(
    [
      () => queryRegisteredTxHashes(core, currentBlock),
      () => queryTransferLogs(usdt, usdt.filters.Transfer(null, CONTRACTS.MetaGuildXCore), currentBlock, USDT_IN_CACHE_KEY, "from"),
      () => queryTransferLogs(usdt, usdt.filters.Transfer(CONTRACTS.MetaGuildXCore, null), currentBlock, USDT_OUT_CACHE_KEY, "to")
    ],
    2
  );
  const registrationTxHashes = registrationTxHashesResult as Set<string>;
  const inLogs = inLogsResult as TransferRow[];
  const outLogs = outLogsResult as TransferRow[];

  const recentIn = [...inLogs]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, PAGE_SIZE);

  const recentOut = [...outLogs]
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, PAGE_SIZE);

  const totalIn = inLogs.reduce((sum, log) => sum + log.amount, 0n);
  const totalOut = outLogs.reduce((sum, log) => sum + log.amount, 0n);
  const expectedBalance = totalIn - totalOut;
  const groupedByTx = new Map<string, StuckDistributionRow>();

  for (const log of inLogs) {
    const current = groupedByTx.get(log.txHash) ?? {
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      totalIn: 0n,
      totalOut: 0n,
      isRegistrationTx: false,
      stuckAmount: 0n
    };
    current.totalIn += log.amount;
    current.blockNumber = Math.max(current.blockNumber, log.blockNumber);
    groupedByTx.set(log.txHash, current);
  }

  for (const log of outLogs) {
    const current = groupedByTx.get(log.txHash) ?? {
      blockNumber: log.blockNumber,
      txHash: log.txHash,
      totalIn: 0n,
      totalOut: 0n,
      isRegistrationTx: false,
      stuckAmount: 0n
    };
    current.totalOut += log.amount;
    current.blockNumber = Math.max(current.blockNumber, log.blockNumber);
    groupedByTx.set(log.txHash, current);
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

  const actualBalance = baseData?.actualBalance ?? BigInt(await usdt.balanceOf(CONTRACTS.MetaGuildXCore));
  const failedRows = baseData?.failedRows ?? await loadFailedDistributionRows(core);
  const stuckRows = failedRows.length > 0 ? heuristicStuckRows : [];

  return {
    actualBalance,
    totalIn,
    totalOut,
    expectedBalance,
    mismatch: actualBalance - expectedBalance,
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
      const essentials = await loadCoreBalanceEssentials();
      setData(essentials);
      setLoading(false);
      const nextData = await loadCoreBalanceData(essentials);
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

      {data && hasFailedDistributions ? (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-red-200">Distribution Pending Check</h2>
              <p className="mt-2 text-sm text-red-100">
                Recoverable income distributions are pending retry on-chain.{" "}
                {latestStuckRow ? `Latest related TX: ${shortAddress(latestStuckRow.txHash)}.` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const firstFailed = data.failedRows[0];
                if (firstFailed) void handleRetry(firstFailed.userId);
              }}
              disabled={!isOwner || data.failedRows.length === 0}
              className="rounded-full bg-red-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-400"
            >
              Retry Now
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
          <h2 className="text-xl font-semibold text-white">Distribution Pending</h2>
          <p className="mt-2 text-sm text-gray-400">
            These users are registered and placed; only income distribution is pending. Admin can retry each one.
          </p>
          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <thead className="bg-gray-950/70 text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 font-medium">Pending Package</th>
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
