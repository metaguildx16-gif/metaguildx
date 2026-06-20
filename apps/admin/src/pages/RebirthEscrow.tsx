import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider, type EventLog } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { ToastStack, type ToastMessage } from "../components/Toast";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { useOwner } from "../hooks/useOwner";

async function batchQueryFilter(contract: Contract, filter: ReturnType<Contract['filters'][string]>, fromBlock: number, toBlock: number, batchSize = 9_000): Promise<EventLog[]> {
  const results: EventLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += batchSize) {
    const end = Math.min(start + batchSize - 1, toBlock);
    const logs = await queryFilterWithRetry(contract, filter, start, end);
    results.push(...(logs as EventLog[]));
    if (start + batchSize <= toBlock) await new Promise((r) => setTimeout(r, 300));
  }
  return results;
}
import { sendTransaction } from "../utils/txHelper";
import { shortAddress } from "../utils/packageUtils";

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


type CompletedRebirthRow = {
  originalUserId: number;
  rebirthUserId: number;
  wallet: string;
  sponsorId: number;
  incomeEarned: number;
  timestamp: number;
};

type NearRebirthRow = {
  userId: number;
  wallet: string;
  birthPackage: number;
  currentEscrowRaw: bigint;
  currentEscrow: number;
  progress: number;
  estimatedBlocks: number;
};

type PendingEscrowRow = {
  userId: number;
  wallet: string;
  amountRaw: bigint;
  amount: number;
};

type RebirthEscrowData = {
  totalRebirths: number;
  totalNearRebirth: number;
  totalFrozenRaw: bigint;
  completed: CompletedRebirthRow[];
  near: NearRebirthRow[];
  pending: PendingEscrowRow[];
};

function getEthereum() {
  return window.ethereum as
    | (Eip1193Provider & {
        on?: (event: string, listener: (args: unknown) => void) => void;
        removeListener?: (event: string, listener: (args: unknown) => void) => void;
      })
    | undefined;
}

function formatUsdt(value: number) {
  return `${value.toFixed(2)} USDT`;
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

async function loadRebirthEscrowData(): Promise<RebirthEscrowData> {
  const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { batchMaxCount: 1, staticNetwork: true });
  const core = new Contract(
    CONTRACTS.MetaGuildXCore,
    [...ABIS.MetaGuildXCore, "function getPackagePriceByLevel(uint256) view returns (uint256)"],
    provider
  );
  const income = new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider);
  const upgrade = new Contract(CONTRACTS.MetaGuildXUpgrade, ABIS.MetaGuildXUpgrade, provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const nextUserId = await core.nextUserId();
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(NETWORK.startBlock, 149800000);
  const registrationLogs = await batchQueryFilter(core, core.filters.UserRegistered(), fromBlock, currentBlock);
  const rebirthLogs = await batchQueryFilter(core, core.filters.RebirthUserCreated(), fromBlock, currentBlock);
  const [allDirectLogs, allLevelLogs, allCrossLogs] = await Promise.all([
    batchQueryFilter(router, router.filters.DirectIncomeRecorded(), fromBlock, currentBlock),
    batchQueryFilter(router, router.filters.LevelIncomeRecorded(), fromBlock, currentBlock),
    batchQueryFilter(router, router.filters.CrossLineIncomeRecorded(), fromBlock, currentBlock)
  ]) as [EventLog[], EventLog[], EventLog[]];


  const registrationEvents = registrationLogs as EventLog[];
  const rebirthEvents = rebirthLogs as EventLog[];
  const avgBlockGap =
    registrationEvents.length > 1
      ? Math.max(
          1,
          Math.round(
            (registrationEvents[registrationEvents.length - 1].blockNumber - registrationEvents[0].blockNumber) /
              (registrationEvents.length - 1)
          )
        )
      : 150;

  const rebirthTargetRaw = BigInt(await core.getPackagePriceByLevel(1));
  const rebirthBlocks = await Promise.all(
    rebirthEvents.map((event) => provider.getBlock(event.blockNumber))
  );

  const eventMeta = new Map<number, { timestamp: number; txHash: string }>();
  rebirthEvents.forEach((event, index) => {
    const rebirthUserId = Number(event.args.newUserId);
    eventMeta.set(rebirthUserId, {
      timestamp: rebirthBlocks[index]?.timestamp ?? 0,
      txHash: event.transactionHash
    });
  });

  const completed: CompletedRebirthRow[] = [];
  const near: NearRebirthRow[] = [];
  const pending: PendingEscrowRow[] = [];
  let totalFrozenRaw = 0n;

  for (let userId = 1; userId < Number(nextUserId); userId += 1) {
    const [profile, rebirthIds, rebirthEscrowRaw] = await Promise.all([
      core.usersById(userId),
      upgrade.getRebirthIds(userId),
      income.rebirthEscrow(userId)
    ]);

    const wallet = String(profile.account);
    const birthPackage = Number(profile.originalPackageLevel);
    const escrowRaw = BigInt(rebirthEscrowRaw);

    if (escrowRaw > 0n) {
      totalFrozenRaw += escrowRaw;
      pending.push({
        userId,
        wallet,
        amountRaw: escrowRaw,
        amount: Number(escrowRaw) / 10
      });
    }

    if ((rebirthIds as bigint[]).length > 0) {
      for (const rebirthId of rebirthIds as bigint[]) {
        const rebirthUserId = Number(rebirthId);
        const meta = eventMeta.get(rebirthUserId);
        const rebirthTxHash = meta?.txHash ?? null;
        const rebirthProfile = await core.usersById(rebirthUserId);
        const sponsorId = Number(rebirthProfile.sponsorId);

        let txIncomeRaw = 0n;

        if (rebirthTxHash) {
          const directLogs = allDirectLogs;
          const levelLogs = allLevelLogs;
          const crossLogs = allCrossLogs;

          for (const log of directLogs as EventLog[]) {
            if (
              log.transactionHash.toLowerCase() === rebirthTxHash.toLowerCase() &&
              Number(log.args.fromUserId) === rebirthUserId &&
              Number(log.args.toUserId) === sponsorId
            ) {
              txIncomeRaw += BigInt(log.args.amount);
            }
          }

          for (const log of levelLogs as EventLog[]) {
            if (
              log.transactionHash.toLowerCase() === rebirthTxHash.toLowerCase() &&
              Number(log.args.fromUserId) === rebirthUserId &&
              Number(log.args.toUserId) === sponsorId
            ) {
              txIncomeRaw += BigInt(log.args.amount);
            }
          }

          for (const log of crossLogs as EventLog[]) {
            if (
              log.transactionHash.toLowerCase() === rebirthTxHash.toLowerCase() &&
              Number(log.args.fromUserId) === rebirthUserId &&
              Number(log.args.toUserId) === sponsorId
            ) {
              txIncomeRaw += BigInt(log.args.amount);
            }
          }
        }

        completed.push({
          originalUserId: userId,
          rebirthUserId,
          wallet,
          sponsorId,
          incomeEarned: Number(txIncomeRaw) / 10,
          timestamp: meta?.timestamp ?? 0
        });
      }
      continue;
    }

    if (birthPackage !== 1 || escrowRaw <= 0n) {
      continue;
    }

    const progress = rebirthTargetRaw > 0n ? Math.min(Number((escrowRaw * 100n) / rebirthTargetRaw), 100) : 0;
    if (progress < 50) {
      continue;
    }

    const remainingRaw = rebirthTargetRaw > escrowRaw ? rebirthTargetRaw - escrowRaw : 0n;
    const estimatedBlocks = Math.ceil(Number(remainingRaw) / 4) * avgBlockGap;

    near.push({
      userId,
      wallet,
      birthPackage,
      currentEscrowRaw: escrowRaw,
      currentEscrow: Number(escrowRaw) / 10,
      progress,
      estimatedBlocks
    });
  }

  completed.sort((a, b) => b.timestamp - a.timestamp);
  near.sort((a, b) => b.progress - a.progress || a.estimatedBlocks - b.estimatedBlocks);
  pending.sort((a, b) => b.amount - a.amount);

  return {
    totalRebirths: completed.length,
    totalNearRebirth: near.length,
    totalFrozenRaw,
    completed,
    near,
    pending
  };
}

export function RebirthEscrowPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [data, setData] = useState<RebirthEscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasingUserId, setReleasingUserId] = useState<number | null>(null);
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

  const refresh = async () => {
    setLoading(true);
    try {
      setData(await loadRebirthEscrowData());
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to load rebirth escrow", "error");
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    void refresh();
  }, []);

  const handleRelease = async (row: PendingEscrowRow) => {
    if (!isOwner) {
      addToast("Unauthorized: owner wallet required", "error");
      return;
    }

    const confirmed = window.confirm(
      `Release ${formatUsdt(row.amount)} rebirth escrow for User #${row.userId}?`
    );
    if (!confirmed) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      addToast("MetaMask not found", "error");
      return;
    }

    setReleasingUserId(row.userId);
    addToast("Confirm release in MetaMask...", "info");
    const provider = new BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const income = new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, signer);

    await sendTransaction(
      () => income.adminReleaseRebirthEscrow(row.userId, row.amountRaw),
      (message) => {
        addToast(message, "success");
        void refresh();
      },
      (message) => addToast(message, "error"),
      `Rebirth escrow released for User #${row.userId}`
    );
    setReleasingUserId(null);
  };

  const totalFrozenDisplay = useMemo(
    () => formatUsdt(Number(data?.totalFrozenRaw ?? 0n) / 10),
    [data]
  );

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Total Rebirths Done</p>
          <h2 className="mt-4 text-3xl font-bold text-white">
            {loading ? "Loading..." : data?.totalRebirths ?? 0}
          </h2>
        </article>
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Users Near Rebirth (&gt;50%)</p>
          <h2 className="mt-4 text-3xl font-bold text-amber-300">
            {loading ? "Loading..." : data?.totalNearRebirth ?? 0}
          </h2>
        </article>
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Total Rebirth Escrow Frozen</p>
          <h2 className="mt-4 text-3xl font-bold text-fuchsia-300">
            {loading ? "Loading..." : totalFrozenDisplay}
          </h2>
        </article>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Completed Rebirths</h2>
            <p className="mt-2 text-sm text-gray-400">Original users that already created rebirth IDs.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-full bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-500"
          >
            Refresh
          </button>
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">Original ID</th>
                <th className="px-4 py-3 font-medium">Rebirth ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Sponsor</th>
                <th className="px-4 py-3 font-medium">Income Earned</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.completed ?? []).map((row) => (
                <tr key={`${row.originalUserId}-${row.rebirthUserId}`} className="hover:bg-gray-800/60">
                  <td className="px-4 py-4 text-white">#{row.originalUserId}</td>
                  <td className="px-4 py-4 text-fuchsia-300">#{row.rebirthUserId}</td>
                  <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                  <td className="px-4 py-4 text-gray-300">User #{row.sponsorId}</td>
                  <td className="px-4 py-4 text-cyan-300">{formatUsdt(row.incomeEarned)}</td>
                  <td className="px-4 py-4 text-gray-300">{row.timestamp ? formatDateTime(row.timestamp) : "--"}</td>
                </tr>
              ))}
              {!loading && (data?.completed.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No rebirths recorded yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Near Rebirth (&gt;50%)</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Birth Pkg</th>
                <th className="px-4 py-3 font-medium">Current Escrow</th>
                <th className="px-4 py-3 font-medium">Progress %</th>
                <th className="px-4 py-3 font-medium">Estimated Blocks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.near ?? []).map((row) => (
                <tr key={row.userId} className="hover:bg-gray-800/60">
                  <td className="px-4 py-4 text-white">#{row.userId}</td>
                  <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                  <td className="px-4 py-4 text-gray-300">{row.birthPackage}</td>
                  <td className="px-4 py-4 text-fuchsia-300">{formatUsdt(row.currentEscrow)}</td>
                  <td className="px-4 py-4 text-amber-300">{row.progress.toFixed(0)}%</td>
                  <td className="px-4 py-4 text-gray-300">~{row.estimatedBlocks} blocks</td>
                </tr>
              ))}
              {!loading && (data?.near.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No users above 50% rebirth progress
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Pending Rebirth Escrow</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Exact Amount</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.pending ?? []).map((row) => (
                <tr key={row.userId} className="hover:bg-gray-800/60">
                  <td className="px-4 py-4 text-white">#{row.userId}</td>
                  <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                  <td className="px-4 py-4 text-fuchsia-300">{formatUsdt(row.amount)}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => void handleRelease(row)}
                      disabled={!isOwner || releasingUserId === row.userId}
                      className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-gray-950 disabled:opacity-50"
                    >
                      {releasingUserId === row.userId ? "Releasing..." : "Release"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && (data?.pending.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No pending rebirth escrow
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
