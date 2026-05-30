import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits, type Eip1193Provider } from "ethers";
import { useEffect, useState, type ReactNode } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { getStakingMonitorData, type StakingMonitorData } from "../hooks/useContractData";
import { shortAddress } from "../utils/packageUtils";

type StakePositionState = {
  amount: bigint;
  lockStartedAt: bigint;
  lockDuration: bigint;
};

function getEthereum() {
  return window.ethereum as
    | (Eip1193Provider & {
        on?: (event: string, listener: (args: unknown) => void) => void;
        removeListener?: (event: string, listener: (args: unknown) => void) => void;
      })
    | undefined;
}

function formatMgx(amount: number) {
  return `${amount.toFixed(2)} MGX`;
}

function formatMgxFromRaw(amount: bigint) {
  return `${Number(formatUnits(amount, 18)).toFixed(2)} MGX`;
}

function formatTreasuryAddress(address?: string, configured?: boolean) {
  if (!address || !configured || /^0x0{40}$/i.test(address)) {
    return "Not configured";
  }
  return shortAddress(address);
}

function formatDate(timestamp: bigint) {
  if (timestamp === 0n) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(Number(timestamp) * 1000));
}

function formatUnixDate(timestamp: number) {
  if (!timestamp) {
    return "Never";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}

function formatDaysRemaining(days: number): string {
  if (!days || days <= 0) return "0 days";
  if (days > 3650) return "∞";
  if (days > 365) {
    return `${Math.floor(days / 365)} years`;
  }
  return `${Math.floor(days)} days`;
}

const REWARD_INTERVAL = 86400;

function getAdminCountdown(stakers: StakingMonitorData["topStakers"]) {
  if (!stakers.length) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const earliestNext = stakers.reduce((min, staker) => {
    if (!staker.rewardDebt || staker.rewardDebt <= 0) {
      return min;
    }
    const nextReward = staker.rewardDebt + REWARD_INTERVAL;
    return nextReward < min ? nextReward : min;
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(earliestNext)) {
    return null;
  }

  return Math.max(earliestNext - now, 0);
}

function formatRewardCountdown(seconds: number | null) {
  if (seconds === null) {
    return "No reward data";
  }
  if (seconds <= 0) {
    return "Reward ready to claim!";
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `Next reward in ${h}h ${m}m ${s}s`;
}

function StatCard({
  title,
  accentClass,
  children
}: {
  title: string;
  accentClass: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
      <h3 className={`text-sm font-medium uppercase tracking-[0.2em] ${accentClass}`}>{title}</h3>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

export function StakingMonitor() {
  const [data, setData] = useState<StakingMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [stakePosition, setStakePosition] = useState<StakePositionState | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState("");
  const [withdrawError, setWithdrawError] = useState("");

  const loadMonitor = async () => {
    setLoading(true);
    try {
      const nextData = await getStakingMonitorData();
      setData(nextData);
    } finally {
      setLoading(false);
    }
  };

  const loadStakePosition = async (address: string | null) => {
    setPositionLoading(true);
    setWithdrawError("");
    setWithdrawSuccess("");
    if (!address) {
      setStakePosition(null);
      setPositionLoading(false);
      return;
    }

    try {
      const provider = new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId);
      const staking = new Contract(CONTRACTS.MGXStaking, ABIS.MGXStaking, provider);
      const position = await staking.getStakePosition(address);
      const amount = BigInt(position.amount);
      setStakePosition({
        amount,
        lockStartedAt: BigInt(position.lockStartedAt),
        lockDuration: BigInt(position.lockDuration)
      });
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Failed to load stake position");
      setStakePosition(null);
    } finally {
      setPositionLoading(false);
    }
  };

  useEffect(() => {
    void loadMonitor();
  }, []);

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
    void loadStakePosition(walletAddress);
  }, [walletAddress]);

  useEffect(() => {
    setCountdown(getAdminCountdown(data?.topStakers ?? []));
  }, [data?.topStakers]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown(getAdminCountdown(data?.topStakers ?? []));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [data?.topStakers]);

  const unlockTime = stakePosition ? stakePosition.lockStartedAt + (stakePosition.lockDuration * 86400n) : 0n;
  const now = Math.floor(Date.now() / 1000);
  const isLocked = unlockTime > 0n ? BigInt(now) < unlockTime : false;
  const daysLeft = isLocked ? Math.max(0, Math.ceil((Number(unlockTime) - now) / 86400)) : 0;
  const hasStake = (stakePosition?.amount ?? 0n) > 0n;
  const canWithdraw = hasStake && !isLocked && withdrawAmount.trim().length > 0 && !withdrawLoading;

  const handleWithdraw = async () => {
    if (!canWithdraw) {
      return;
    }

    const ethereum = getEthereum();
    if (!ethereum) {
      setWithdrawError("MetaMask not found");
      return;
    }

    try {
      const parsedAmount = parseUnits(withdrawAmount, 18);
      if (parsedAmount <= 0n) {
        setWithdrawError("Enter a valid withdrawal amount");
        return;
      }
      if (stakePosition && parsedAmount > stakePosition.amount) {
        setWithdrawError("Withdrawal amount exceeds your staked balance");
        return;
      }

      const confirmMessage = `Release ${Number(formatUnits(parsedAmount, 18)).toFixed(2)} MGX from your stake?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }

      setWithdrawLoading(true);
      setWithdrawError("");
      setWithdrawSuccess("");

      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const core = new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, signer);
      const tx = await core.withdrawStake(parsedAmount);
      await tx.wait();

      setWithdrawSuccess(`Withdraw submitted successfully: ${tx.hash}`);
      setWithdrawAmount("");
      await Promise.all([loadStakePosition(walletAddress), loadMonitor()]);
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Withdraw failed");
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Staked" accentClass="text-cyan-300">
          {loading ? <div className="h-10 w-28 animate-pulse rounded-2xl bg-gray-800" /> : <h3 className="text-3xl font-bold text-white">{formatMgx(data?.totalStaked ?? 0)}</h3>}
        </StatCard>
        <StatCard title="Reward Liquidity" accentClass="text-emerald-300">
          {loading ? <div className="h-10 w-28 animate-pulse rounded-2xl bg-gray-800" /> : <h3 className="text-3xl font-bold text-white">{formatMgx(data?.contractBalance ?? 0)}</h3>}
        </StatCard>
        <StatCard title="Total Stakers" accentClass="text-yellow-300">
          {loading ? <div className="h-10 w-20 animate-pulse rounded-2xl bg-gray-800" /> : <h3 className="text-3xl font-bold text-white">{String(data?.totalStakers ?? 0)}</h3>}
        </StatCard>
        <StatCard title="Reward Cycle" accentClass="text-blue-300">
          {loading ? (
            <div className="h-10 w-28 animate-pulse rounded-2xl bg-gray-800" />
          ) : (
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">{formatRewardCountdown(countdown)}</h3>
              <p className="text-sm text-gray-400">Earliest next reward window across Top Stakers, based on each position&apos;s reward debt.</p>
            </div>
          )}
        </StatCard>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Treasury & Auto Top-Up Status</h2>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <StatCard title="Treasury Status" accentClass="text-cyan-300">
            <div className="grid gap-3 text-sm">
              <StatRow
                label="Treasury Wallet"
                value={data ? formatTreasuryAddress(data.treasury, data.treasuryConfigured) : "-"}
              />
              <StatRow label="Treasury Balance" value={formatMgx(data?.treasuryBalance ?? 0)} />
              <StatRow label="Allowance to Staking" value={formatMgx(data?.allowanceToStaking ?? 0)} />
              <StatRow label="Remaining Capacity" value={formatMgx(Math.max((data?.allowanceToStaking ?? 0) - (data?.contractBalance ?? 0), 0))} />
            </div>
          </StatCard>

          <StatCard title="Auto Top-Up Config" accentClass="text-yellow-300">
            <div className="grid gap-3 text-sm">
              <StatRow label="Threshold" value={formatMgx(data?.minBalanceThreshold ?? 0)} />
              <StatRow label="Top-Up Amount" value={formatMgx(data?.topUpAmount ?? 0)} />
              <StatRow label="Cooldown" value={`${((data?.topUpCooldown ?? 0) / 3600).toFixed(0)} hours`} />
              <StatRow label="Last Top-Up" value={formatUnixDate(data?.lastTopUpTime ?? 0)} />
            </div>
          </StatCard>

          <StatCard title="System Health" accentClass="text-emerald-300">
            <div className="grid gap-3 text-sm">
              <StatRow label="Contract Balance" value={formatMgx(data?.contractBalance ?? 0)} />
              <StatRow label="Daily Emission" value={formatMgx(data?.dailyEmission ?? 0)} />
              <StatRow label="Days Remaining" value={<span title={`${(data?.daysRemaining ?? 0).toFixed(2)} days exact`}>{formatDaysRemaining(data?.daysRemaining ?? 0)}</span>} />
              <StatRow
                label="Reward Rate"
                value={
                  data
                    ? `${data.rewardRateApyPercent.toFixed(2)}% APY (${data.rewardRateDailyPercent.toFixed(2)}% daily)`
                    : "-"
                }
              />
            </div>
          </StatCard>

          <StatCard title="Burn Status" accentClass="text-red-400">
            <div className="grid gap-3 text-sm">
              <StatRow label="Total Burned" value={<span className="text-red-400">{formatMgx(data?.burnedMGX ?? 0)}</span>} />
              <StatRow label="% of Supply" value={<span className="text-red-400">{`${(data?.burnPercent ?? 0).toFixed(4)}%`}</span>} />
            </div>
          </StatCard>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Withdraw Stake</h2>
            <p className="mt-2 text-sm text-gray-400">
              {walletAddress ? `Connected wallet: ${shortAddress(walletAddress)}` : "Connect a wallet to view your stake position."}
            </p>
          </div>
          {positionLoading ? <div className="h-10 w-24 animate-pulse rounded-2xl bg-gray-800" /> : null}
        </div>

        {!walletAddress ? (
          <p className="mt-6 rounded-2xl border border-dashed border-gray-700 px-4 py-6 text-sm text-gray-400">
            Connect your wallet to view staking details.
          </p>
        ) : !hasStake ? (
          <p className="mt-6 rounded-2xl border border-dashed border-gray-700 px-4 py-6 text-sm text-gray-400">
            You have no active stake.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-gray-400">My Stake Position</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
                  <span className="text-gray-400">Staked</span>
                  <span className="font-medium text-white">{formatMgxFromRaw(stakePosition?.amount ?? 0n)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
                  <span className="text-gray-400">Lock Period</span>
                  <span className="font-medium text-white">{Math.round(Number(stakePosition?.lockDuration ?? 0n) / 86400)} days</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
                  <span className="text-gray-400">Lock Started</span>
                  <span className="font-medium text-white">{formatDate(stakePosition?.lockStartedAt ?? 0n)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
                  <span className="text-gray-400">Unlocks On</span>
                  <span className="font-medium text-white">{formatDate(unlockTime)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-800 px-4 py-3">
                  <span className="text-gray-400">Status</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${isLocked ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>
                    {isLocked ? `Locked (${daysLeft} days remaining)` : "Ready to withdraw"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-gray-950/60 p-5">
              <label className="block text-sm font-medium text-gray-300" htmlFor="withdraw-amount">
                Amount to withdraw
              </label>
              <input
                id="withdraw-amount"
                type="number"
                min="0"
                step="0.000001"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="0.00"
                className="mt-3 w-full rounded-2xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => void handleWithdraw()}
                disabled={!canWithdraw}
                className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {withdrawLoading ? "Withdrawing..." : "Withdraw"}
              </button>
              {withdrawSuccess ? <p className="mt-4 text-sm text-emerald-300">{withdrawSuccess}</p> : null}
              {withdrawError ? <p className="mt-4 text-sm text-rose-300">{withdrawError}</p> : null}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-800 bg-gray-900/90 p-6">
        <h2 className="text-xl font-semibold text-white">Top Stakers</h2>
        <div className="mt-6 overflow-hidden rounded-3xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
            <thead className="bg-gray-950/70 text-gray-400">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Staked</th>
                <th className="px-4 py-3 font-medium">Lock</th>
                <th className="px-4 py-3 font-medium">Pending Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900/70">
              {(data?.topStakers ?? []).map((row) => (
                <tr key={row.userId}>
                  <td className="px-4 py-4 text-white">#{row.userId}</td>
                  <td className="px-4 py-4 text-gray-300">{shortAddress(row.wallet)}</td>
                  <td className="px-4 py-4 text-blue-300">{formatMgx(row.staked)}</td>
                  <td className="px-4 py-4 text-gray-300">{row.lockDurationDays} days</td>
                  <td className="px-4 py-4 text-emerald-300">{formatMgx(row.pendingReward)}</td>
                </tr>
              ))}
              {!loading && (data?.topStakers.length ?? 0) === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No active stakers yet</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
