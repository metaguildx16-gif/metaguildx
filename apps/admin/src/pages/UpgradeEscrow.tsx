import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { ToastStack, type ToastMessage } from "../components/Toast";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { useOwner } from "../hooks/useOwner";
import { sendTransaction } from "../utils/txHelper";
import { shortAddress } from "../utils/packageUtils";

type UpgradeEscrowRow = {
  userId: number;
  wallet: string;
  packageLevel: number;
  xSlot: number;
  progress: number;
  frozenRaw: bigint;
  frozenAmount: number;
  status: "Ready to upgrade" | `In progress ${number}%` | "No escrow";
};

type UpgradeEscrowData = {
  rows: UpgradeEscrowRow[];
  totalFrozenRaw: bigint;
  usersWithFrozenEscrow: number;
  usersNearUpgrade: number;
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

function withTimeout<T>(promise: Promise<T>, ms = 15_000) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Timeout")), ms);
    })
  ]);
}

async function safeBigIntRead(read: () => Promise<bigint>) {
  try {
    return BigInt(await read());
  } catch {
    return 0n;
  }
}

async function getUpgradeEscrowOnly(income: Contract, userId: number, packageLevel: number) {
  try {
    const currentPkgEscrow = await income.escrowBalances(userId, BigInt(packageLevel));
    return BigInt(currentPkgEscrow);
  } catch {
    return 0n;
  }
}

async function mapInBatches<T, R>(items: T[], batchSize: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map((item) => mapper(item)))));
  }
  return results;
}

async function loadUpgradeEscrowData(): Promise<UpgradeEscrowData> {
  return withTimeout(
    (async () => {
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
      let totalFrozenRaw = 0n;
      let usersWithFrozenEscrow = 0;
      let usersNearUpgrade = 0;

      const userIds = Array.from({ length: Math.max(nextUserId - 1, 0) }, (_, index) => index + 1);
      const rows = await mapInBatches(userIds, 12, async (userId) => {
        const profile = await core.usersById(userId);
        const packageLevel = Number(profile.packageLevel);
        const packagePriceRaw = packageLevel > 0 ? BigInt(await core.getPackagePriceByLevel(packageLevel)) : 0n;
        const thresholdRaw = packagePriceRaw * 2n;
        const frozenRaw = await getUpgradeEscrowOnly(income, userId, packageLevel);
        const progress = thresholdRaw > 0n ? Math.min(Number((frozenRaw * 100n) / thresholdRaw), 100) : 0;
        const xSlot = packagePriceRaw > 0n
          ? Number(frozenRaw / packagePriceRaw)
          : 0;

        let status: UpgradeEscrowRow["status"] = "No escrow";
        if (frozenRaw > 0n) {
          status = progress >= 100 ? "Ready to upgrade" : `In progress ${progress}%`;
          totalFrozenRaw += frozenRaw;
          usersWithFrozenEscrow += 1;
          if (progress >= 80) {
            usersNearUpgrade += 1;
          }
        }

        return {
          userId,
          wallet: String(profile.account),
          packageLevel,
          xSlot,
          progress,
          frozenRaw,
          frozenAmount: Number(frozenRaw) / 10,
          status
        } satisfies UpgradeEscrowRow;
      });

      rows.sort((a, b) => {
        if (a.frozenRaw === 0n && b.frozenRaw > 0n) {
          return 1;
        }
        if (b.frozenRaw === 0n && a.frozenRaw > 0n) {
          return -1;
        }
        return b.progress - a.progress || b.frozenAmount - a.frozenAmount || a.userId - b.userId;
      });

      return {
        rows,
        totalFrozenRaw,
        usersWithFrozenEscrow,
        usersNearUpgrade
      };
    })()
  );
}

export function UpgradeEscrowPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [data, setData] = useState<UpgradeEscrowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      setData(await loadUpgradeEscrowData());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load upgrade escrow";
      setLoadError(message);
      addToast(message, "error");
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

  const handleReleaseEscrow = async (row: UpgradeEscrowRow) => {
    if (!isOwner) {
      addToast("Unauthorized: owner wallet required", "error");
      return;
    }
    if (row.frozenRaw <= 0n) {
      addToast("No escrow to release", "warning");
      return;
    }

    const confirmed = window.confirm(
      `Release ${formatUsdt(row.frozenAmount)} frozen escrow for User #${row.userId}?`
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
      () => income.adminReleaseEscrow(row.userId, row.frozenRaw),
      (message) => {
        addToast(message, "success");
        void refresh();
      },
      (message) => addToast(message, "error"),
      `Escrow released for User #${row.userId}`
    );
    setReleasingUserId(null);
  };

  const totalFrozenDisplay = useMemo(
    () => formatUsdt(Number(data?.totalFrozenRaw ?? 0n) / 10),
    [data]
  );

  if (!loading && loadError) {
    return (
      <div className="space-y-6">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6 text-center">
          <h2 className="text-xl font-semibold text-white">Failed to load escrow data</h2>
          <p className="mt-2 text-sm text-gray-400">{loadError}. Click Refresh to try again.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-full bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Refresh
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Users with Frozen Escrow</p>
          <h2 className="mt-4 text-3xl font-bold text-white">
            {loading ? "Loading..." : data?.usersWithFrozenEscrow ?? 0}
          </h2>
        </article>
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Total Frozen USDT</p>
          <h2 className="mt-4 text-3xl font-bold text-cyan-300">
            {loading ? "Loading..." : totalFrozenDisplay}
          </h2>
        </article>
        <article className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
          <p className="text-sm text-gray-400">Users Near Upgrade (&gt;80%)</p>
          <h2 className="mt-4 text-3xl font-bold text-amber-300">
            {loading ? "Loading..." : data?.usersNearUpgrade ?? 0}
          </h2>
        </article>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Auto-Upgrade Escrow Monitor</h2>
            <p className="mt-2 text-sm text-gray-400">
              Tracks frozen package escrow and upgrade readiness across all users.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Refresh
          </button>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">User ID</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">xSlot</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Frozen Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.rows ?? []).map((row) => {
                const progressColor =
                  row.progress >= 100 ? "bg-emerald-500" : row.progress >= 80 ? "bg-amber-400" : "bg-blue-500";
                return (
                  <tr key={row.userId} className="hover:bg-gray-800/60">
                    <td className="px-4 py-4 text-white">#{row.userId}</td>
                    <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                    <td className="px-4 py-4 text-gray-300">Pkg {row.packageLevel}</td>
                    <td className="px-4 py-4 text-cyan-300">{row.xSlot}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-800">
                          <div
                            className={`h-full rounded-full ${progressColor}`}
                            style={{ width: `${Math.min(row.progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-300">{row.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white">{formatUsdt(row.frozenAmount)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          row.status === "Ready to upgrade"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : row.status === "No escrow"
                              ? "bg-gray-700/60 text-gray-300"
                              : "bg-blue-500/15 text-blue-300"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => void handleReleaseEscrow(row)}
                        disabled={!isOwner || row.frozenRaw <= 0n || releasingUserId === row.userId}
                        className="rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-gray-950 disabled:opacity-50"
                      >
                        {releasingUserId === row.userId ? "Releasing..." : "Release Escrow"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && (data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No upgrade escrow rows found
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
