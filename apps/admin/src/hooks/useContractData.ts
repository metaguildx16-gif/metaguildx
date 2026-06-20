import { Contract, JsonRpcProvider, type EventLog } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { ABIS, CONTRACTS, NETWORK } from "../config/contracts";
import { getPackagePrice } from "../utils/packageUtils";

const ALL_USERS_CACHE_KEY = "mgx_admin_all_users_v1";
const INCOME_MONITOR_CACHE_KEY = "mgx_admin_income_monitor_v1";
const INCOME_DISTRIBUTION_CACHE_KEY = "mgx_admin_income_distribution_v1";
const REBIRTH_MONITOR_CACHE_KEY = "mgx_admin_rebirth_monitor_v1";
const ALL_TRANSACTIONS_CACHE_KEY = "mgx_admin_all_transactions_v1";

function readBlockCache<T>(key: string): { lastBlock: number; data: T[] } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.lastBlock !== "number" || !Array.isArray(parsed.data)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBlockCache<T>(key: string, lastBlock: number, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ lastBlock, data }));
  } catch {
    // localStorage full or unavailable - silently skip caching
  }
}

type CachedEventLog = {
  transactionHash: string;
  blockNumber: number;
  argsArray: string[];
  argsNamed: Record<string, string>;
  fragmentName?: string;
};

function stringifyLogValue(value: unknown) {
  return typeof value === "bigint" ? value.toString() : String(value ?? "");
}

function parseLogValue(value: string) {
  return /^-?\d+$/.test(value) ? BigInt(value) : value;
}

function getLogCacheKey(contract: Contract, filter: any, fromBlock: number) {
  const address = String(contract.target ?? "unknown").toLowerCase();
  const topics = (filter?.topics ?? [])
    .map((topic: unknown) => Array.isArray(topic) ? topic.join("_") : String(topic ?? "null"))
    .join("-");
  return `mgx_admin_logs_v1_${NETWORK.chainId}_${address}_${fromBlock}_${topics}`;
}

function serializeEventLog(log: EventLog): CachedEventLog {
  const args = log.args as any;
  const argsArray = Array.from(args ?? []).map(stringifyLogValue);
  const argsNamed = Object.fromEntries(
    Object.keys(args ?? {})
      .filter((key) => Number.isNaN(Number(key)))
      .map((key) => [key, stringifyLogValue(args[key])])
  );
  return {
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    argsArray,
    argsNamed,
    fragmentName: log.fragment?.name
  };
}

function hydrateEventLog(log: CachedEventLog): EventLog {
  const args: any = log.argsArray.map(parseLogValue);
  for (const [key, value] of Object.entries(log.argsNamed)) {
    args[key] = parseLogValue(value);
  }
  return {
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    args,
    fragment: { name: log.fragmentName ?? "" }
  } as EventLog;
}

async function queryFilterWithRetry(contract: Contract, filter: any, start: number, end: number, retries = 3): Promise<any[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await contract.queryFilter(filter, start, end);
    } catch (err: any) {
      const isLimitErr = err?.code === -32005 || /limit exceeded/i.test(err?.message ?? "");
      if (isLimitErr && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return [];
}



const blockTimestampCache = new Map<number, number>();

async function getCachedBlockTimestamp(provider: JsonRpcProvider, blockNumber: number): Promise<number> {
  if (blockTimestampCache.has(blockNumber)) return blockTimestampCache.get(blockNumber)!;
  const block = await provider.getBlock(blockNumber);
  const ts = block?.timestamp ?? 0;
  blockTimestampCache.set(blockNumber, ts);
  return ts;
}

async function batchQueryFilter(contract: Contract, filter: ReturnType<Contract['filters'][string]>, fromBlock: number, toBlock: number, batchSize = 10000): Promise<EventLog[]> {
  const cacheKey = getLogCacheKey(contract, filter, fromBlock);
  const cached = readBlockCache<CachedEventLog>(cacheKey);
  const results: EventLog[] = (cached?.data ?? []).map(hydrateEventLog);
  const scanFrom = Math.max(fromBlock, (cached?.lastBlock ?? fromBlock - 1) + 1);

  if (scanFrom > toBlock) {
    return results;
  }

  for (let start = scanFrom; start <= toBlock; start += batchSize) {
    const end = Math.min(start + batchSize - 1, toBlock);
    const logs = await queryFilterWithRetry(contract, filter, start, end);
    results.push(...(logs as EventLog[]));
    if (start + batchSize <= toBlock) await new Promise((r) => setTimeout(r, 200));
  }

  writeBlockCache(cacheKey, toBlock, results.map(serializeEventLog));
  return results;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit = 2): Promise<T[]> {
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
const PLATFORM_SCALE = 10;
const REFRESH_INTERVAL_MS = 30_000;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export type DashboardEvent = {
  userId: number;
  sponsorId: number;
  wallet: string;
  packageLevel: number;
  amount: number;
  txHash: string;
  blockNumber: number;
  timestamp: number;
};

export type UserSummary = {
  userId: number;
  wallet: string;
  sponsorId: number;
  packageLevel: number;
  packagePrice: number;
  directIncomeReceived: number;
  joinedAt: number;
  surrendered: boolean;
  directReferrals: number;
  totalTeamBusiness: number;
  txHash: string;
  blockNumber: number;
};

export type UserTreePosition = {
  parentId: number;
  leftChildId: number;
  rightChildId: number;
  depth: number;
  position: "Root" | "Left leg" | "Right leg";
  leftCount: number;
  rightCount: number;
};

export type TreeNodeRecord = {
  id: number;
  parent: number;
  left: number;
  right: number;
  depth: number;
  packageLevel: number;
  wallet: string;
  surrendered: boolean;
};

export type UserDetail = UserSummary & {
  referrerWallet: string | null;
  totalIncomeReceived: number;
  currentPackageLevel: number;
  reactivationCount: number;
  treePosition: UserTreePosition;
};

export type IncomeEventRecord = {
  userId: number;
  fromUserId: number;
  amount: number;
  incomeType: "direct" | "level" | "spillover" | "crossline" | "cashback" | "staking" | string;
  level?: number;
  timestamp: number;
  txHash: string;
  wallet: string;
};

export type UserIncomeRow = {
  userId: number;
  wallet: string;
  packageLevel: number;
  direct: number;
  level: number;
  spillover: number;
  total: number;
};

export type LevelIncomeBreakdownRow = {
  level: number;
  totalDistributed: number;
  recipients: number;
  avgPerUser: number;
};

export type IncomeMonitorData = {
  totalDirect: number;
  totalLevel: number;
  totalSpillover: number;
  platformReserve: number;
  cashbackTotal: number;
  creatorTotal: number;
  perUser: UserIncomeRow[];
  levelBreakdown: LevelIncomeBreakdownRow[];
  recentFeed: IncomeEventRecord[];
};

export type TransactionRecord = {
  type:
    | "Registration"
    | "Income"
    | "Upgrade"
    | "Rebirth"
    | "Reactivation"
    | "Cashback"
    | "Placement";
  userId: number;
  wallet: string;
  amount: number | null;
  details: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
};

export type CashbackClaimRecord = {
  userId: number;
  wallet: string;
  amount: number;
  settlementAmount: number;
  timestamp: number;
  txHash: string;
  blockNumber: number;
};

export type SurrenderedUserRecord = {
  userId: number;
  wallet: string;
  surrenderDate: number;
  surrenderValue: number;
  cashbackEarned: number;
  poolSharePercent: number;
  status: "Active Receiver" | "Fully Paid";
  joinedAt: number;
};

export type PoolGrowthPoint = {
  date: string;
  balance: number;
};

export type CashbackMonitorData = {
  totalPoolBalance: number;
  totalSurrenderedUsers: number;
  totalCashbackPaidOut: number;
  dailyReleaseRate: number;
  surrenderedUsers: SurrenderedUserRecord[];
  claimHistory: CashbackClaimRecord[];
  poolGrowth: PoolGrowthPoint[];
  eligibleToSurrender: number;
  missedWindow: number;
};

export type IncomeDistributionLine = {
  label: string;
  recipient: string;
  amount: number;
  status: "sent" | "fallback";
};

export type IncomeDistributionEvent = {
  txHash: string;
  timestamp: number;
  userId: number;
  sponsorId: number;
  wallet: string;
  amount: number;
  lines: IncomeDistributionLine[];
  totalDistributed: number;
};

export type IncomeDistributionData = {
  feed: IncomeDistributionEvent[];
  summaryToday: {
    direct: number;
    level: number;
    spillover: number;
    crossline: number;
    creatorFallback: number;
    creatorFee: number;
    cashbackPool: number;
    total: number;
  };
  perUser: UserIncomeRow[];
  creatorWallet: string;
  creatorToday: number;
  creatorAllTime: number;
  routerBalance: number;
  totalDistributions: number;
  failedDistributions: number;
  lastDistributionAt: number | null;
};

export type FinancialReportPoint = {
  month: string;
  registrations: number;
  income: number;
};

export type FinancialReportsData = {
  registrationVolume: number;
  upgradeVolume: number;
  totalCollected: number;
  creatorFeeEarned: number;
  directIncomeDistributed: number;
  levelIncomeDistributed: number;
  totalIncomeDistributed: number;
  cashbackPoolBalance: number;
  totalEscrowFrozen: number;
  contractUsdtBalance: number;
  monthly: FinancialReportPoint[];
};

export type UpgradeMonitorRow = {
  userId: number;
  fromLevel: number;
  toLevel: number;
  amount: number;
  timestamp: number;
};

export type NearUpgradeRow = {
  userId: number;
  wallet: string;
  escrow: number;
  needed: number;
  percent: number;
};

export type UpgradeMonitorData = {
  recentUpgrades: UpgradeMonitorRow[];
  nearUpgrade: NearUpgradeRow[];
};

export type RebirthMonitorRow = {
  originalUserId: number;
  rebirthUserId: number;
  wallet: string;
  timestamp: number;
  income: number;
};

export type RebirthMonitorData = {
  totalRebirths: number;
  recentRebirths: RebirthMonitorRow[];
};

export type StakingMonitorRow = {
  userId: number;
  wallet: string;
  staked: number;
  lockDurationDays: number;
  pendingReward: number;
  startTime: number;
  rewardDebt: number;
};

export type StakingMonitorData = {
  totalStaked: number;
  rewardPool: number;
  totalStakers: number;
  topStakers: StakingMonitorRow[];
  treasury: string;
  treasuryConfigured: boolean;
  treasuryBalance: number;
  allowanceToStaking: number;
  contractBalance: number;
  minBalanceThreshold: number;
  topUpAmount: number;
  topUpCooldown: number;
  lastTopUpTime: number;
  rewardRate: number;
  rewardRateDailyPercent: number;
  rewardRateApyPercent: number;
  dailyEmission: number;
  daysRemaining: number;
  burnedMGX: number;
  burnPercent: number;
};

export type DashboardStats = {
  totalUsers: number;
  totalVolume: number;
  todayRegistrations: number;
  creatorIncome: number | null;
  cashbackPool: number;
  surrenderedUsers: number;
};

export type ChartPoint = {
  date: string;
  registrations: number;
};

type HookState = {
  stats: DashboardStats;
  chartData: ChartPoint[];
  recentRegistrations: DashboardEvent[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
};

const initialState: HookState = {
  stats: {
    totalUsers: 0,
    totalVolume: 0,
    todayRegistrations: 0,
    creatorIncome: null,
    cashbackPool: 0,
    surrenderedUsers: 0
  },
  chartData: [],
  recentRegistrations: [],
  loading: true,
  error: null,
  lastUpdated: null
};

function getProvider() {
  return new JsonRpcProvider(NETWORK.rpc, NETWORK.chainId, { batchMaxCount: 1, staticNetwork: true });
}

function isConfigured(address: string) {
  return address !== NULL_ADDRESS;
}

function formatPlatformAmount(value: bigint | number) {
  const amount = typeof value === "number" ? value : Number(value);
  return amount / PLATFORM_SCALE;
}

function formatTokenAmount(value: bigint | number) {
  const amount = typeof value === "number" ? value : Number(value);
  return amount / 1e18;
}

function startOfTodayUnix() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  return Math.floor(start.getTime() / 1000);
}

function formatDay(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function formatMonth(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleString("en-US", { month: "short" })} ${date.getFullYear()}`;
}

async function getRegistrationEvents(provider: JsonRpcProvider) {
  if (!isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [] as DashboardEvent[];
  }

  const core = new Contract(
    CONTRACTS.MetaGuildXCore,
    ABIS.MetaGuildXCore,
    provider
  );
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_registration_events_v1";
  const cached = readBlockCache<DashboardEvent>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;

  if (fromBlock > currentBlock) {
    return (cached?.data ?? []).sort((a, b) => b.timestamp - a.timestamp);
  }

  const logs = await batchQueryFilter(core, core.filters.UserRegistered(), fromBlock, currentBlock);

  const blocks = await Promise.all(
    logs.map((log) => provider.getBlock(log.blockNumber))
  );

  const newEvents = (logs as EventLog[])
    .map((log, index) => {
      const args = log.args;
      const block = blocks[index];
      if (!args || !block) {
        return null;
      }

      return {
        userId: Number(args.userId),
        sponsorId: Number(args.sponsorId),
        wallet: String(args.account),
        packageLevel: Number(args.packageLevel),
        amount: formatPlatformAmount(args.amount),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: block.timestamp
      } satisfies DashboardEvent;
    })
    .filter((item): item is DashboardEvent => item !== null);

  const merged = [...(cached?.data ?? []), ...newEvents];
  writeBlockCache(CACHE_KEY, currentBlock, merged);

  return merged.sort((a, b) => b.timestamp - a.timestamp);
}

function getCoreContract(provider: JsonRpcProvider) {
  return new Contract(CONTRACTS.MetaGuildXCore, ABIS.MetaGuildXCore, provider);
}

function getIncomeContract(provider: JsonRpcProvider) {
  return new Contract(CONTRACTS.MetaGuildXIncome, ABIS.MetaGuildXIncome, provider);
}

async function safeBigIntRead(read: () => Promise<bigint>) {
  try {
    return BigInt(await read());
  } catch {
    return 0n;
  }
}

async function safeUserProfileRead(core: Contract, userId: number) {
  try {
    return await core.usersById(userId);
  } catch {
    return {
      id: BigInt(userId),
      account: NULL_ADDRESS,
      sponsorId: 0n,
      packageLevel: 0n,
      originalPackageLevel: 0n,
      totalContribution: 0n,
      totalEarnings: 0n,
      directReferrals: 0n,
      totalTeamBusiness: 0n,
      rebirthCount: 0n,
      xCount: 0n,
      joinedAt: 0n,
      surrendered: false
    };
  }
}

async function getUpgradeEscrowOnly(income: Contract, userId: number) {
  const totalEscrow = await safeBigIntRead(() => income.getTotalEscrow(userId));
  if (totalEscrow === 0n) {
    return 0n;
  }

  const rebirthEscrow = await safeBigIntRead(() => income.rebirthEscrow(userId));
  return totalEscrow > rebirthEscrow ? totalEscrow - rebirthEscrow : 0n;
}

function getUpgradeContract(provider: JsonRpcProvider) {
  return new Contract(CONTRACTS.MetaGuildXUpgrade, ABIS.MetaGuildXUpgrade, provider);
}

function getBinaryTreeContract(provider: JsonRpcProvider) {
  return new Contract(CONTRACTS.BinaryTree, ABIS.BinaryTree, provider);
}

async function getNodeSubtreeSize(
  tree: Contract,
  nodeId: number,
  depth = 0
): Promise<number> {
  if (!nodeId || depth >= 20) {
    return 0;
  }

  const node = await tree.nodes(nodeId);
  if (Number(node.userId) === 0) {
    return 0;
  }

  const [left, right] = await Promise.all([
    getNodeSubtreeSize(tree, Number(node.leftChildId), depth + 1),
    getNodeSubtreeSize(tree, Number(node.rightChildId), depth + 1)
  ]);

  return 1 + left + right;
}

export async function getAllUsers(): Promise<UserSummary[]> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("MetaGuildXCore address is not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const currentBlock = await provider.getBlockNumber();
  const cachedUsers = readBlockCache<UserSummary>(ALL_USERS_CACHE_KEY);
  if (cachedUsers && cachedUsers.lastBlock >= currentBlock) {
    return cachedUsers.data;
  }

  const events = await getRegistrationEvents(provider);
  const directIncomeLogs = isConfigured(CONTRACTS.IncomeRouter)
    ? await batchQueryFilter(router, router.filters.DirectIncomeRecorded(), NETWORK.startBlock, currentBlock)
    : [];
  const directIncomeByUserId = (directIncomeLogs as EventLog[]).reduce((map, log) => {
    const toUserId = Number(log.args.toUserId);
    const amount = formatPlatformAmount(log.args.amount);
    map.set(toUserId, (map.get(toUserId) ?? 0) + amount);
    return map;
  }, new Map<number, number>());

  const users = await Promise.all(
    events.map(async (event) => {
      const profile = await core.usersById(event.userId);
      return {
        userId: event.userId,
        wallet: event.wallet,
        sponsorId: Number(profile.sponsorId),
        packageLevel: Number(profile.packageLevel),
        packagePrice: getPackagePrice(Number(profile.packageLevel)),
        directIncomeReceived: directIncomeByUserId.get(event.userId) ?? 0,
        joinedAt: Number(profile.joinedAt || event.timestamp),
        surrendered: Boolean(profile.surrendered),
        directReferrals: Number(profile.directReferrals),
        totalTeamBusiness: formatPlatformAmount(profile.totalTeamBusiness),
        txHash: event.txHash,
        blockNumber: event.blockNumber
      } satisfies UserSummary;
    })
  );

  const sortedUsers = users.sort((a, b) => b.userId - a.userId);
  writeBlockCache(ALL_USERS_CACHE_KEY, currentBlock, sortedUsers);
  return sortedUsers;
}

export async function getUserTreePosition(
  userId: number
): Promise<UserTreePosition> {
  if (!isConfigured(CONTRACTS.BinaryTree)) {
    return {
      parentId: 0,
      leftChildId: 0,
      rightChildId: 0,
      depth: 0,
      position: "Root",
      leftCount: 0,
      rightCount: 0
    };
  }

  const provider = getProvider();
  const tree = getBinaryTreeContract(provider);
  const node = await tree.nodes(userId);
  const parentId = Number(node.parentId);
  const leftChildId = Number(node.leftChildId);
  const rightChildId = Number(node.rightChildId);
  const depth = Number(node.depth);

  let position: UserTreePosition["position"] = "Root";
  if (parentId !== 0) {
    const parentNode = await tree.nodes(parentId);
    position = Number(parentNode.leftChildId) === userId ? "Left leg" : "Right leg";
  }

  const [leftCount, rightCount] = await Promise.all([
    getNodeSubtreeSize(tree, leftChildId),
    getNodeSubtreeSize(tree, rightChildId)
  ]);

  return {
    parentId,
    leftChildId,
    rightChildId,
    depth,
    position,
    leftCount,
    rightCount
  };
}

export async function getTreeRootUserId(): Promise<number> {
  if (!isConfigured(CONTRACTS.BinaryTree)) {
    throw new Error("BinaryTree address is not configured");
  }

  const provider = getProvider();
  const tree = getBinaryTreeContract(provider);
  return Number(await tree.rootUserId());
}

export async function getTreeNode(userId: number): Promise<TreeNodeRecord> {
  if (!isConfigured(CONTRACTS.BinaryTree) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("Contract addresses are not configured");
  }

  const provider = getProvider();
  const tree = getBinaryTreeContract(provider);
  const core = getCoreContract(provider);

  const [node, user] = await Promise.all([tree.nodes(userId), core.usersById(userId)]);
  const resolvedId = Number(node.userId || user.id);

  if (resolvedId === 0) {
    throw new Error("Tree node not found");
  }

  return {
    id: resolvedId,
    parent: Number(node.parentId),
    left: Number(node.leftChildId),
    right: Number(node.rightChildId),
    depth: Number(node.depth),
    packageLevel: Number(user.packageLevel),
    wallet: String(user.account),
    surrendered: Boolean(user.surrendered)
  };
}

export async function getUserDetail(userId: number): Promise<UserDetail> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("MetaGuildXCore address is not configured");
  }

  const provider = getProvider();
  const [core, income, upgrade] = await Promise.all([
    Promise.resolve(getCoreContract(provider)),
    Promise.resolve(getIncomeContract(provider)),
    Promise.resolve(getUpgradeContract(provider))
  ]);

  const profile = await core.usersById(userId);
  if (Number(profile.id) === 0) {
    throw new Error("User not found");
  }

  const [treePosition, totalIncomeReceived, currentPackageLevel, reactivationCount] =
    await Promise.all([
      getUserTreePosition(userId),
      isConfigured(CONTRACTS.MetaGuildXIncome)
        ? income.getTotalAllIncome(userId)
        : Promise.resolve(0n),
      Promise.resolve(BigInt(profile.packageLevel)),
      isConfigured(CONTRACTS.MetaGuildXUpgrade)
        ? upgrade.getRebirthIds(userId).then((ids: bigint[]) => BigInt(ids.length))
        : Promise.resolve(BigInt(profile.rebirthCount))
    ]);

  let referrerWallet: string | null = null;
  const sponsorId = Number(profile.sponsorId);
  if (sponsorId !== 0) {
    const sponsorProfile = await core.usersById(sponsorId);
    referrerWallet = String(sponsorProfile.account);
  }

  return {
    userId: Number(profile.id),
    wallet: String(profile.account),
    sponsorId,
    packageLevel: Number(profile.packageLevel),
    packagePrice: getPackagePrice(Number(profile.packageLevel)),
    directIncomeReceived: formatPlatformAmount(totalIncomeReceived),
    joinedAt: Number(profile.joinedAt),
    surrendered: Boolean(profile.surrendered),
    directReferrals: Number(profile.directReferrals),
    totalTeamBusiness: formatPlatformAmount(profile.totalTeamBusiness),
    txHash: "",
    blockNumber: 0,
    referrerWallet,
    totalIncomeReceived: formatPlatformAmount(totalIncomeReceived),
    currentPackageLevel: Number(currentPackageLevel),
    reactivationCount: Number(reactivationCount),
    treePosition
  };
}

export async function getIncomeMonitorData(): Promise<IncomeMonitorData> {
  if (
    !isConfigured(CONTRACTS.MetaGuildXCore) ||
    !isConfigured(CONTRACTS.MetaGuildXIncome) ||
    !isConfigured(CONTRACTS.IncomeRouter) ||
    !isConfigured(CONTRACTS.CashbackPool)
  ) {
    throw new Error("Income monitor contracts are not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const income = getIncomeContract(provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);

  const currentBlock = await provider.getBlockNumber();
  const cachedData = readBlockCache<IncomeMonitorData>(INCOME_MONITOR_CACHE_KEY);
  if (cachedData && cachedData.lastBlock >= currentBlock && cachedData.data[0]) {
    return cachedData.data[0];
  }

  const fromBlock = NETWORK.startBlock;

  const [directLogs, levelLogs, spilloverLogs, crosslineLogs] = await runWithConcurrency<EventLog[]>(
    [
      () => batchQueryFilter(router, router.filters.DirectIncomeRecorded(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.LevelIncomeRecorded(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.SpilloverIncome(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.CrossLineIncomeRecorded(), fromBlock, currentBlock)
    ],
    2
  );
  const registrationEvents = await getRegistrationEvents(provider);
  const platformReserveRaw = await router.platformReserve();
  const cashbackRaw = await cashback.cashbackPoolBalance();
  const creatorFeeBps = await router.creatorFeeBps();
  const nextUserId = await core.nextUserId();

  const levelByTransaction = new Map<string, number>();
  for (const log of levelLogs as EventLog[]) {
    levelByTransaction.set(log.transactionHash, Number(log.args.level));
  }

  const userCache = new Map<number, { wallet: string; packageLevel: number }>();
  const resolveUser = async (userId: number) => {
    if (userCache.has(userId)) {
      return userCache.get(userId)!;
    }
    const user = await core.usersById(userId);
    const resolved = {
      wallet: String(user.account),
      packageLevel: Number(user.packageLevel)
    };
    userCache.set(userId, resolved);
    return resolved;
  };

  const routeLogs = [
    ...(directLogs as EventLog[]).map((log) => ({ type: "direct" as const, log })),
    ...(levelLogs as EventLog[]).map((log) => ({ type: "level" as const, log })),
    ...(spilloverLogs as EventLog[]).map((log) => ({ type: "spillover" as const, log })),
    ...(crosslineLogs as EventLog[]).map((log) => ({ type: "crossline" as const, log }))
  ];
  const routeBlocks = await Promise.all(routeLogs.map((entry) => provider.getBlock(entry.log.blockNumber)));
  const routeRecords = await Promise.all(
    routeLogs.map(async (entry, index): Promise<IncomeEventRecord | null> => {
      const args = entry.log.args;
      const block = routeBlocks[index];
      if (!args || !block) {
        return null;
      }
      const userId =
        entry.type === "spillover"
          ? Number(args.receiver)
          : Number(args.toUserId);
      const userMeta = await resolveUser(userId);
      return {
        userId,
        fromUserId: "fromUserId" in args ? Number(args.fromUserId) : 0,
        amount: formatPlatformAmount(args.amount),
        incomeType: entry.type,
        level: entry.type === "level" ? levelByTransaction.get(entry.log.transactionHash) : undefined,
        timestamp: block.timestamp,
        txHash: entry.log.transactionHash,
        wallet: userMeta.wallet
      };
    })
  );
  const eventRecords: IncomeEventRecord[] = routeRecords.filter((item): item is IncomeEventRecord => item !== null);

  const perUser: UserIncomeRow[] = [];
  for (let userId = 1; userId < Number(nextUserId); userId += 1) {
    const user = await resolveUser(userId);
    if (!user.wallet || user.wallet === NULL_ADDRESS) {
      continue;
    }
    const totals = await income.incomesByUser(userId);
    perUser.push({
      userId,
      wallet: user.wallet,
      packageLevel: user.packageLevel,
      direct: formatPlatformAmount(totals.direct),
      level: formatPlatformAmount(totals.level),
      spillover: formatPlatformAmount(totals.spillover),
      total:
        formatPlatformAmount(totals.direct) +
        formatPlatformAmount(totals.level) +
        formatPlatformAmount(totals.spillover) +
        formatPlatformAmount(totals.crossline)
    });
  }

  const levelRowsBase = Array.from({ length: 10 }, (_, index) => ({
    level: index + 1,
    totalDistributed: 0,
    recipients: new Set<number>()
  }));

  for (const log of levelLogs as EventLog[]) {
    const args = log.args;
    const level = Number(args.level);
    const row = levelRowsBase[level - 1];
    if (!row) {
      continue;
    }
    row.totalDistributed += formatPlatformAmount(args.amount);
    row.recipients.add(Number(args.toUserId));
  }

  const totalVolume = registrationEvents.reduce((sum, event) => sum + event.amount, 0);
  const creatorTotal = (totalVolume * Number(creatorFeeBps)) / 10_000;

  const data: IncomeMonitorData = {
    totalDirect: eventRecords
      .filter((event) => event.incomeType === "direct")
      .reduce((sum, event) => sum + event.amount, 0),
    totalLevel: eventRecords
      .filter((event) => event.incomeType === "level")
      .reduce((sum, event) => sum + event.amount, 0),
    totalSpillover: eventRecords
      .filter((event) => event.incomeType === "spillover")
      .reduce((sum, event) => sum + event.amount, 0),
    platformReserve: formatPlatformAmount(platformReserveRaw),
    cashbackTotal: formatPlatformAmount(cashbackRaw),
    creatorTotal,
    perUser: perUser.sort((a, b) => b.total - a.total),
    levelBreakdown: levelRowsBase.map((row) => ({
      level: row.level,
      totalDistributed: row.totalDistributed,
      recipients: row.recipients.size,
      avgPerUser: row.recipients.size > 0 ? row.totalDistributed / row.recipients.size : 0
    })),
    recentFeed: eventRecords.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
  };
  writeBlockCache(INCOME_MONITOR_CACHE_KEY, currentBlock, [data]);
  return data;
}

export async function getUpgradeEvents(): Promise<TransactionRecord[]> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [];
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_upgrade_events_v1";
  const cached = readBlockCache<TransactionRecord>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;

  if (fromBlock > currentBlock) {
    return (cached?.data ?? []).slice().sort((a, b) => b.timestamp - a.timestamp);
  }

  const [upgradeLogs, reactivationLogs] = await runWithConcurrency(
    [
      () => batchQueryFilter(core, core.filters.PackageUpgraded(), fromBlock, currentBlock, 9_999),
      () => batchQueryFilter(core, core.filters.RebirthUserCreated(), fromBlock, currentBlock, 9_999)
    ],
    2
  );

  const allLogs = [...upgradeLogs, ...reactivationLogs];
  const blocks = await Promise.all(allLogs.map((log) => provider.getBlock(log.blockNumber)));

  const records: TransactionRecord[] = [];

  for (let index = 0; index < allLogs.length; index++) {
    const eventLog = allLogs[index] as EventLog;
    const block = blocks[index];
    const args = eventLog.args;
    if (!args || !block) {
      continue;
    }

    if (eventLog.fragment.name === "RebirthUserCreated") {
      records.push({
        type: "Rebirth",
        userId: Number(args.originalUserId),
        wallet: String(args.wallet),
        amount: getPackagePrice(1),
        details: `Rebirth -> User ${Number(args.newUserId)}`,
        timestamp: block.timestamp,
        txHash: eventLog.transactionHash,
        blockNumber: eventLog.blockNumber
      });
      continue;
    }

    if (eventLog.fragment.name === "PackageUpgraded") {
      const user = await safeUserProfileRead(core, Number(args.userId));
      records.push({
        type: "Upgrade",
        userId: Number(args.userId),
        wallet: String(user.account),
        amount: formatPlatformAmount(args.amount),
        details: `Level ${Number(args.fromLevel)} -> Level ${Number(args.toLevel)}`,
        timestamp: block.timestamp,
        txHash: eventLog.transactionHash,
        blockNumber: eventLog.blockNumber
      });
      continue;
    }

    if ("newUserId" in args) {
      const user = await safeUserProfileRead(core, Number(args.newUserId));
      records.push({
        type: "Reactivation",
        userId: Number(args.newUserId),
        wallet: String(user.account),
        amount: getPackagePrice(1),
        details: `Reactivated from User #${Number(args.originalUserId)}`,
        timestamp: block.timestamp,
        txHash: eventLog.transactionHash,
        blockNumber: eventLog.blockNumber
      });
    }
  }

  const merged = [...(cached?.data ?? []), ...records];
  writeBlockCache(CACHE_KEY, currentBlock, merged);
  return merged.slice().sort((a, b) => b.timestamp - a.timestamp);
}

export async function getPlacementEvents(): Promise<TransactionRecord[]> {
  if (!isConfigured(CONTRACTS.BinaryTree) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [];
  }

  const provider = getProvider();
  const tree = getBinaryTreeContract(provider);
  const core = getCoreContract(provider);
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_placement_events_v1";
  const cached = readBlockCache<any>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;
  if (fromBlock > currentBlock) {
    return (cached?.data ?? []) as any;
  }
  const logs = await batchQueryFilter(tree, tree.filters.NodePlaced(), fromBlock, currentBlock);
  const blocks = await Promise.all(logs.map((log) => provider.getBlock(log.blockNumber)));

  const records: TransactionRecord[] = [];
  for (let index = 0; index < logs.length; index++) {
    const eventLog = logs[index] as EventLog;
    const block = blocks[index];
    const args = eventLog.args;
    if (!args || !block) {
      continue;
    }
    const user = await core.usersById(Number(args.userId));
    records.push({
      type: "Placement",
      userId: Number(args.userId),
      wallet: String(user.account),
      amount: null,
      details: `${Boolean(args.isLeft) ? "Left" : "Right"} of User #${Number(args.parentId)}`,
      timestamp: block.timestamp,
      txHash: eventLog.transactionHash,
      blockNumber: eventLog.blockNumber
    });
  }

  const __merged = [...(cached?.data ?? []), ...(records)];
  writeBlockCache(CACHE_KEY, currentBlock, __merged);
  return __merged as any;
}

export async function getCashbackEvents(): Promise<TransactionRecord[]> {
  if (!isConfigured(CONTRACTS.CashbackPool) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [];
  }

  const provider = getProvider();
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);
  const core = getCoreContract(provider);
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_cashback_events_v1";
  const cached = readBlockCache<any>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;
  if (fromBlock > currentBlock) {
    return (cached?.data ?? []) as any;
  }
  const [claimLogs, surrenderLogs] = await runWithConcurrency(
    [
      () => batchQueryFilter(cashback, cashback.filters.CashbackClaimed(), fromBlock, currentBlock),
      () => batchQueryFilter(cashback, cashback.filters.UserSurrendered(), fromBlock, currentBlock)
    ],
    2
  );
  const allLogs = [...claimLogs, ...surrenderLogs];
  const blocks = await Promise.all(allLogs.map((log) => provider.getBlock(log.blockNumber)));

  const records: TransactionRecord[] = [];
  for (let index = 0; index < allLogs.length; index++) {
    const eventLog = allLogs[index] as EventLog;
    const block = blocks[index];
    const args = eventLog.args;
    if (!args || !block) {
      continue;
    }

    const user = await core.usersById(Number(args.userId));
    records.push({
      type: "Cashback",
      userId: Number(args.userId),
      wallet: String(user.account),
      amount: "amount" in args ? formatPlatformAmount(args.amount) : null,
      details:
        "settlementAmount" in args
          ? `Cashback claim ${formatPlatformAmount(args.amount).toFixed(1)} USDT`
          : "Surrender registered",
      timestamp: block.timestamp,
      txHash: eventLog.transactionHash,
      blockNumber: eventLog.blockNumber
    });
  }

  const __merged = [...(cached?.data ?? []), ...(records)];
  writeBlockCache(CACHE_KEY, currentBlock, __merged);
  return __merged as any;
}

export async function getSurrenderedUsers(): Promise<SurrenderedUserRecord[]> {
  if (!isConfigured(CONTRACTS.CashbackPool) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [];
  }

  const provider = getProvider();
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);
  const core = getCoreContract(provider);
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_surrendered_users_v1";
  const cached = readBlockCache<any>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;
  if (fromBlock > currentBlock) {
    return (cached?.data ?? []) as any;
  }

  const [surrenderLogs, claimHistory] = await Promise.all([
    batchQueryFilter(cashback, cashback.filters.UserSurrendered(), fromBlock, currentBlock),
    getCashbackClaims()
  ]);
  const claimByUser = new Map<number, number>();
  for (const claim of claimHistory) {
    claimByUser.set(claim.userId, (claimByUser.get(claim.userId) ?? 0) + claim.amount);
  }

  const users = await Promise.all(
    (surrenderLogs as EventLog[]).map(async (log) => {
      const args = log.args;
        const profile = await core.usersById(Number(args.userId));
      return {
        userId: Number(args.userId),
        wallet: String(profile.account),
        surrenderDate: Number(args.timestamp),
        surrenderValue: getPackagePrice(Number(profile.packageLevel)),
        cashbackEarned: claimByUser.get(Number(args.userId)) ?? 0,
        poolSharePercent: 0,
        status: (claimByUser.get(Number(args.userId)) ?? 0) > 0 ? "Active Receiver" : "Fully Paid",
        joinedAt: Number(profile.joinedAt)
      } satisfies SurrenderedUserRecord;
    })
  );

  const totalSurrenderValue = users.reduce((sum, user) => sum + user.surrenderValue, 0);
  const __merged = [...(cached?.data ?? []), ...(users
    .map((user) => ({
      ...user,
      poolSharePercent:
        totalSurrenderValue > 0 ? (user.surrenderValue / totalSurrenderValue) * 100 : 0
    }))
    .sort((a, b) => b.surrenderDate - a.surrenderDate))];
  writeBlockCache(CACHE_KEY, currentBlock, __merged);
  return __merged as any;
}

export async function getCashbackClaims(): Promise<CashbackClaimRecord[]> {
  if (!isConfigured(CONTRACTS.CashbackPool) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    return [];
  }

  const provider = getProvider();
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);
  const core = getCoreContract(provider);
  const currentBlock = await provider.getBlockNumber();
  const CACHE_KEY = "mgx_admin_cashback_claims_v1";
  const cached = readBlockCache<any>(CACHE_KEY);
  const fromBlock = cached ? cached.lastBlock + 1 : NETWORK.startBlock;
  if (fromBlock > currentBlock) {
    return (cached?.data ?? []) as any;
  }
  const logs = await batchQueryFilter(cashback, cashback.filters.CashbackClaimed(), fromBlock, currentBlock);
  const blocks = await Promise.all(logs.map((log) => provider.getBlock(log.blockNumber)));

  const records: CashbackClaimRecord[] = [];
  for (let index = 0; index < logs.length; index++) {
    const eventLog = logs[index] as EventLog;
    const block = blocks[index];
    const args = eventLog.args;
    if (!args || !block) {
      continue;
    }
    const profile = await core.usersById(Number(args.userId));
    records.push({
      userId: Number(args.userId),
      wallet: String(profile.account),
      amount: formatPlatformAmount(args.amount),
      settlementAmount: formatPlatformAmount(args.settlementAmount),
      timestamp: block.timestamp,
      txHash: eventLog.transactionHash,
      blockNumber: eventLog.blockNumber
    });
  }

  const __merged = [...(cached?.data ?? []), ...(records.sort((a, b) => b.timestamp - a.timestamp))];
  writeBlockCache(CACHE_KEY, currentBlock, __merged);
  return __merged as any;
}

export async function getCashbackMonitorData(): Promise<CashbackMonitorData> {
  if (!isConfigured(CONTRACTS.CashbackPool) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("Cashback monitor contracts are not configured");
  }

  const provider = getProvider();
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);
  const [registrations, surrenderedUsers, claimHistory, poolBalanceRaw, surrenderedCountRaw] =
    await Promise.all([
      getRegistrationEvents(provider),
      getSurrenderedUsers(),
      getCashbackClaims(),
      cashback.cashbackPoolBalance(),
      cashback.totalSurrenderedUsers()
    ]);

  const totalCashbackPaidOut = claimHistory.reduce((sum, claim) => sum + claim.amount, 0);
  const now = Math.floor(Date.now() / 1000);
  const dailyClaims = claimHistory.filter((claim) => claim.timestamp >= now - 86400);
  const dailyReleaseRate =
    dailyClaims.length > 0
      ? dailyClaims.reduce((sum, claim) => sum + claim.amount, 0)
      : totalCashbackPaidOut / Math.max(1, 30);

  const events = [
    ...registrations.map((event) => ({
      timestamp: event.timestamp,
      delta: event.amount * 0.04
    })),
    ...claimHistory.map((claim) => ({
      timestamp: claim.timestamp,
      delta: -claim.amount
    }))
  ].sort((a, b) => a.timestamp - b.timestamp);

  let runningBalance = 0;
  const poolGrowth: PoolGrowthPoint[] = events.map((event) => {
    runningBalance += event.delta;
    return {
      date: new Date(event.timestamp * 1000).toLocaleDateString(),
      balance: Math.max(runningBalance, 0)
    };
  });

  const surrenderedSet = new Set(surrenderedUsers.map((user) => user.userId));
  const eligibleWindowStart = now - 6 * 30 * 24 * 3600;
  const eligibleWindowEnd = now - 3 * 30 * 24 * 3600;
  const eligibleToSurrender = registrations.filter(
    (registration) =>
      !surrenderedSet.has(registration.userId) &&
      registration.timestamp >= eligibleWindowStart &&
      registration.timestamp <= eligibleWindowEnd
  ).length;
  const missedWindow = registrations.filter(
    (registration) =>
      !surrenderedSet.has(registration.userId) &&
      registration.timestamp < eligibleWindowStart
  ).length;

  return {
    totalPoolBalance: formatPlatformAmount(poolBalanceRaw),
    totalSurrenderedUsers: Number(surrenderedCountRaw),
    totalCashbackPaidOut,
    dailyReleaseRate,
    surrenderedUsers,
    claimHistory: claimHistory.slice(0, 50),
    poolGrowth,
    eligibleToSurrender,
    missedWindow
  };
}

export async function getIncomeDistributionData(): Promise<IncomeDistributionData> {
  if (
    !isConfigured(CONTRACTS.MetaGuildXCore) ||
    !isConfigured(CONTRACTS.IncomeRouter) ||
    !isConfigured(CONTRACTS.MetaGuildXIncome) ||
    !isConfigured(CONTRACTS.CashbackPool) ||
    !isConfigured(CONTRACTS.USDT)
  ) {
    throw new Error("Income distribution contracts are not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const income = getIncomeContract(provider);
  const usdt = new Contract(CONTRACTS.USDT, ["function balanceOf(address) view returns (uint256)"], provider);
  const currentBlock = await provider.getBlockNumber();
  const cachedData = readBlockCache<IncomeDistributionData>(INCOME_DISTRIBUTION_CACHE_KEY);
  if (cachedData && cachedData.lastBlock >= currentBlock && cachedData.data[0]) {
    return cachedData.data[0];
  }

  const fromBlock = NETWORK.startBlock;
  const todayStart = startOfTodayUnix();

  const registrations = await getRegistrationEvents(provider);
  const [directLogs, levelLogs, spilloverLogs, crosslineLogs, residualLogs] = await runWithConcurrency<EventLog[]>(
    [
      () => batchQueryFilter(router, router.filters.DirectIncomeRecorded(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.LevelIncomeRecorded(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.SpilloverIncome(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.CrossLineIncomeRecorded(), fromBlock, currentBlock),
      () => batchQueryFilter(router, router.filters.ResidualSweptToCreator(), fromBlock, currentBlock)
    ],
    2
  );
  const creatorWallet = await router.creatorWallet();
  const creatorFeeBps = await router.creatorFeeBps();
  const cashbackBps = await router.cashbackBps();
  const routerBalanceRaw = await usdt.balanceOf(CONTRACTS.IncomeRouter);
  const nextUserId = await core.nextUserId();

  const blocks = new Map<number, number>();
  for (const log of [
    ...(directLogs as EventLog[]),
    ...(levelLogs as EventLog[]),
    ...(spilloverLogs as EventLog[]),
    ...(crosslineLogs as EventLog[]),
    ...(residualLogs as EventLog[])
  ]) {
    if (!blocks.has(log.blockNumber)) {
      const block = await provider.getBlock(log.blockNumber);
      if (block) {
        blocks.set(log.blockNumber, block.timestamp);
      }
    }
  }

  const profileCache = new Map<number, { wallet: string; packageLevel: number }>();
  const resolveProfile = async (userId: number) => {
    if (profileCache.has(userId)) {
      return profileCache.get(userId)!;
    }
    const profile = await core.usersById(userId);
    const next = {
      wallet: String(profile.account),
      packageLevel: Number(profile.packageLevel)
    };
    profileCache.set(userId, next);
    return next;
  };

  const byTx = <T extends EventLog>(logs: T[]) =>
    logs.reduce((map, log) => {
      const current = map.get(log.transactionHash) ?? [];
      current.push(log);
      map.set(log.transactionHash, current);
      return map;
    }, new Map<string, T[]>());

  const directByTx = byTx(directLogs as EventLog[]);
  const levelByTx = byTx(levelLogs as EventLog[]);
  const spilloverByTx = byTx(spilloverLogs as EventLog[]);
  const crosslineByTx = byTx(crosslineLogs as EventLog[]);
  const residualByTx = byTx(residualLogs as EventLog[]);

  const feed = await Promise.all(
    registrations.slice(0, 20).map(async (registration) => {
      const lines: IncomeDistributionLine[] = [];
      const directForTx = directByTx.get(registration.txHash) ?? [];
      const levelForTx = levelByTx.get(registration.txHash) ?? [];
      const spilloverForTx = spilloverByTx.get(registration.txHash) ?? [];
      const crosslineForTx = crosslineByTx.get(registration.txHash) ?? [];
      const residualForTx = residualByTx.get(registration.txHash) ?? [];

      for (const log of directForTx) {
        const toUserId = Number(log.args.toUserId);
        const profile = await resolveProfile(toUserId);
        lines.push({
          label: "Direct income",
          recipient: `User #${toUserId} (${profile.wallet})`,
          amount: formatPlatformAmount(log.args.amount),
          status: "sent"
        });
      }

      for (const log of levelForTx) {
        const toUserId = Number(log.args.toUserId);
        const profile = await resolveProfile(toUserId);
        lines.push({
          label: `Level ${Number(log.args.level)}`,
          recipient: `User #${toUserId} (${profile.wallet})`,
          amount: formatPlatformAmount(log.args.amount),
          status: "sent"
        });
      }

      for (const log of spilloverForTx) {
        const receiver = Number(log.args.receiver);
        const profile = await resolveProfile(receiver);
        lines.push({
          label: `Spillover L${Number(log.args.fromLevel)}`,
          recipient: `User #${receiver} (${profile.wallet})`,
          amount: formatPlatformAmount(log.args.amount),
          status: "sent"
        });
      }

      for (const log of crosslineForTx) {
        const toUserId = Number(log.args.toUserId);
        const profile = await resolveProfile(toUserId);
        lines.push({
          label: "Crossline",
          recipient: `User #${toUserId} (${profile.wallet})`,
          amount: formatPlatformAmount(log.args.amount),
          status: "sent"
        });
      }

      for (const log of residualForTx) {
        lines.push({
          label: "Creator fallback",
          recipient: String(creatorWallet),
          amount: formatPlatformAmount(log.args.amount),
          status: "fallback"
        });
      }

      const creatorFee = (registration.amount * Number(creatorFeeBps)) / 10_000;
      const cashbackPool = (registration.amount * Number(cashbackBps)) / 10_000;
      lines.push({
        label: "Cashback pool",
        recipient: CONTRACTS.CashbackPool,
        amount: cashbackPool,
        status: "sent"
      });
      lines.push({
        label: "Creator fee",
        recipient: String(creatorWallet),
        amount: creatorFee,
        status: "sent"
      });

      const totalDistributed = lines.reduce((sum, line) => sum + line.amount, 0);

      return {
        txHash: registration.txHash,
        timestamp: registration.timestamp,
        userId: registration.userId,
        sponsorId: registration.sponsorId,
        wallet: registration.wallet,
        amount: registration.amount,
        lines,
        totalDistributed
      } satisfies IncomeDistributionEvent;
    })
  );

  const incomeData = await getIncomeMonitorData();
  const todayRegistrations = registrations.filter((row) => row.timestamp >= todayStart);
  const todayTxHashes = new Set(todayRegistrations.map((row) => row.txHash));

  const todayDirect = (directLogs as EventLog[])
    .filter((log) => todayTxHashes.has(log.transactionHash))
    .reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);
  const todayLevel = (levelLogs as EventLog[])
    .filter((log) => todayTxHashes.has(log.transactionHash))
    .reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);
  const todaySpillover = (spilloverLogs as EventLog[])
    .filter((log) => todayTxHashes.has(log.transactionHash))
    .reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);
  const todayCrossline = (crosslineLogs as EventLog[])
    .filter((log) => todayTxHashes.has(log.transactionHash))
    .reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);
  const todayFallback = (residualLogs as EventLog[])
    .filter((log) => (blocks.get(log.blockNumber) ?? 0) >= todayStart)
    .reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);
  const todayCashback = todayRegistrations.reduce(
    (sum, row) => sum + (row.amount * Number(cashbackBps)) / 10_000,
    0
  );
  const todayCreatorFee = todayRegistrations.reduce(
    (sum, row) => sum + (row.amount * Number(creatorFeeBps)) / 10_000,
    0
  );

  let creatorToday = todayCreatorFee + todayFallback;
  let creatorAllTime = registrations.reduce(
    (sum, row) => sum + (row.amount * Number(creatorFeeBps)) / 10_000,
    0
  ) + (residualLogs as EventLog[]).reduce((sum, log) => sum + formatPlatformAmount(log.args.amount), 0);

  for (let userId = 1; userId < Number(nextUserId); userId += 1) {
    const profile = await core.usersById(userId);
    if (String(profile.account).toLowerCase() === String(creatorWallet).toLowerCase()) {
      const totals = await income.incomesByUser(userId);
      creatorToday += 0;
      creatorAllTime += formatPlatformAmount(totals.direct) + formatPlatformAmount(totals.level) + formatPlatformAmount(totals.spillover) + formatPlatformAmount(totals.crossline);
      break;
    }
  }

  const data: IncomeDistributionData = {
    feed: feed.sort((a, b) => b.timestamp - a.timestamp),
    summaryToday: {
      direct: todayDirect,
      level: todayLevel,
      spillover: todaySpillover,
      crossline: todayCrossline,
      creatorFallback: todayFallback,
      creatorFee: todayCreatorFee,
      cashbackPool: todayCashback,
      total: todayDirect + todayLevel + todaySpillover + todayCrossline + todayFallback + todayCreatorFee + todayCashback
    },
    perUser: incomeData.perUser,
    creatorWallet: String(creatorWallet),
    creatorToday,
    creatorAllTime,
    routerBalance: formatPlatformAmount(routerBalanceRaw),
    totalDistributions: feed.length,
    failedDistributions: 0,
    lastDistributionAt: feed[0]?.timestamp ?? null
  };
  writeBlockCache(INCOME_DISTRIBUTION_CACHE_KEY, currentBlock, [data]);
  return data;
}

export async function getFinancialReportsData(): Promise<FinancialReportsData> {
  if (
    !isConfigured(CONTRACTS.MetaGuildXCore) ||
    !isConfigured(CONTRACTS.MetaGuildXIncome) ||
    !isConfigured(CONTRACTS.IncomeRouter) ||
    !isConfigured(CONTRACTS.CashbackPool) ||
    !isConfigured(CONTRACTS.USDT)
  ) {
    throw new Error("Financial report contracts are not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const income = getIncomeContract(provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const cashback = new Contract(CONTRACTS.CashbackPool, ABIS.CashbackPool, provider);
  const usdt = new Contract(CONTRACTS.USDT, ["function balanceOf(address) view returns (uint256)"], provider);

  const [registrations, upgrades, nextUserId, creatorFeeBps, poolBalance, coreUsdt, routerUsdt, cashbackUsdt] =
    await Promise.all([
      getRegistrationEvents(provider),
      getUpgradeEvents(),
      core.nextUserId(),
      router.creatorFeeBps(),
      cashback.cashbackPoolBalance(),
      usdt.balanceOf(CONTRACTS.MetaGuildXCore),
      usdt.balanceOf(CONTRACTS.IncomeRouter),
      usdt.balanceOf(CONTRACTS.CashbackPool)
    ]);

  let directIncomeDistributed = 0;
  let levelIncomeDistributed = 0;
  for (let userId = 1; userId < Number(nextUserId); userId += 1) {
    const totals = await income.incomesByUser(userId);
    directIncomeDistributed += formatPlatformAmount(totals.direct);
    levelIncomeDistributed += formatPlatformAmount(totals.level);
  }

  const registrationVolume = registrations.reduce((sum, row) => sum + row.amount, 0);
  const upgradeVolume = upgrades
    .filter((row) => row.type === "Upgrade" && row.amount !== null)
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const totalCollected = registrationVolume + upgradeVolume;
  const creatorFeeEarned = (totalCollected * Number(creatorFeeBps)) / 10_000;
  const totalIncomeDistributed =
    directIncomeDistributed +
    levelIncomeDistributed +
    creatorFeeEarned;
  const totalEscrowFrozen = formatTokenAmount(coreUsdt);

  const monthMap = new Map<string, FinancialReportPoint>();
  for (const registration of registrations) {
    const key = formatMonth(registration.timestamp);
    const existing = monthMap.get(key) ?? { month: key, registrations: 0, income: 0 };
    existing.registrations += 1;
    existing.income += registration.amount;
    monthMap.set(key, existing);
  }
  for (const upgrade of upgrades) {
    if (upgrade.type !== "Upgrade" || upgrade.amount === null) {
      continue;
    }
    const key = formatMonth(upgrade.timestamp);
    const existing = monthMap.get(key) ?? { month: key, registrations: 0, income: 0 };
    existing.income += upgrade.amount;
    monthMap.set(key, existing);
  }

  return {
    registrationVolume,
    upgradeVolume,
    totalCollected,
    creatorFeeEarned,
    directIncomeDistributed,
    levelIncomeDistributed,
    totalIncomeDistributed,
    cashbackPoolBalance: formatPlatformAmount(poolBalance),
    totalEscrowFrozen,
    contractUsdtBalance: formatTokenAmount(coreUsdt + routerUsdt + cashbackUsdt),
    monthly: Array.from(monthMap.values()).slice(-6)
  };
}

export async function getUpgradeMonitorData(): Promise<UpgradeMonitorData> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore) || !isConfigured(CONTRACTS.MetaGuildXIncome)) {
    throw new Error("Upgrade monitor contracts are not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const income = getIncomeContract(provider);
  const upgrades = await getUpgradeEvents();
  const users = await getAllUsers();

  const recentUpgrades = upgrades
    .filter((row) => row.type === "Upgrade")
    .slice(0, 20)
    .map((row) => {
      const matches = row.details.match(/Level (\d+) -> Level (\d+)/);
      return {
        userId: row.userId,
        fromLevel: Number(matches?.[1] ?? 0),
        toLevel: Number(matches?.[2] ?? 0),
        amount: row.amount ?? 0,
        timestamp: row.timestamp
      } satisfies UpgradeMonitorRow;
    });

  const nearUpgrade = (
    await Promise.all(
      users.map(async (user) => {
        if (user.packageLevel >= 10) {
          return null;
        }
        const escrow = formatPlatformAmount(await getUpgradeEscrowOnly(income, user.userId));
        const needed = getPackagePrice(user.packageLevel + 1);
        const percent = needed > 0 ? Math.min((escrow / needed) * 100, 100) : 0;
        if (percent < 50) {
          return null;
        }
        return {
          userId: user.userId,
          wallet: user.wallet,
          escrow,
          needed,
          percent
        } satisfies NearUpgradeRow;
      })
    )
  ).filter((row): row is NearUpgradeRow => row !== null);

  return {
    recentUpgrades,
    nearUpgrade: nearUpgrade.sort((a, b) => b.percent - a.percent).slice(0, 25)
  };
}

export async function getRebirthMonitorData(): Promise<RebirthMonitorData> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore) || !isConfigured(CONTRACTS.IncomeRouter)) {
    throw new Error("Rebirth monitor contracts are not configured");
  }

  const provider = getProvider();
  const core = getCoreContract(provider);
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const currentBlock = await provider.getBlockNumber();
  const cachedData = readBlockCache<RebirthMonitorData>(REBIRTH_MONITOR_CACHE_KEY);
  if (cachedData && cachedData.lastBlock >= currentBlock && cachedData.data[0]) {
    return cachedData.data[0];
  }

  const fromBlock = NETWORK.startBlock;
  const logs = await batchQueryFilter(core, core.filters.RebirthUserCreated(), fromBlock, currentBlock);
  const blocks = await Promise.all(logs.map((log) => provider.getBlock(log.blockNumber)));

  const recentRebirths = (
    await Promise.all((logs as EventLog[]).map(async (log, index) => {
      const args = log.args;
      const block = blocks[index];
      if (!args || !block) {
        return null;
      }

      const rebirthUserId = Number(args.newUserId);
      const rebirthUser = await core.usersById(BigInt(rebirthUserId));
      const sponsorId = Number(rebirthUser.sponsorId ?? rebirthUser[2] ?? 0n);
      let income = 0;

      if (sponsorId > 0) {
        const [directLogs, levelLogs, crosslineLogs] = await runWithConcurrency<EventLog[]>(
          [
            () => batchQueryFilter(router, router.filters.DirectIncomeRecorded(BigInt(rebirthUserId), BigInt(sponsorId)), fromBlock, currentBlock),
            () => batchQueryFilter(router, router.filters.LevelIncomeRecorded(BigInt(rebirthUserId), BigInt(sponsorId)), fromBlock, currentBlock),
            () => batchQueryFilter(router, router.filters.CrossLineIncomeRecorded(BigInt(rebirthUserId), BigInt(sponsorId)), fromBlock, currentBlock)
          ],
          2
        );

        const directIncome = directLogs.reduce((sum, event) => {
          if (!("args" in event)) {
            return sum;
          }
          const amount = event.args.amount ?? event.args[2] ?? 0n;
          return sum + formatPlatformAmount(amount);
        }, 0);

        const levelIncome = levelLogs.reduce((sum, event) => {
          if (!("args" in event)) {
            return sum;
          }
          const amount = event.args.amount ?? event.args[3] ?? 0n;
          return sum + formatPlatformAmount(amount);
        }, 0);
        const crosslineIncome = crosslineLogs.reduce((sum, event) => {
          if (!("args" in event)) {
            return sum;
          }
          const amount = event.args.amount ?? event.args[2] ?? 0n;
          return sum + formatPlatformAmount(amount);
        }, 0);

        income = directIncome + levelIncome + crosslineIncome;
      }

      return {
        originalUserId: Number(args.originalUserId),
        rebirthUserId,
        wallet: String(args.wallet),
        timestamp: block.timestamp,
        income
      } satisfies RebirthMonitorRow;
    }))
  )
    .filter((item): item is RebirthMonitorRow => item !== null)
    .sort((a, b) => b.timestamp - a.timestamp);

  const data: RebirthMonitorData = {
    totalRebirths: recentRebirths.length,
    recentRebirths: recentRebirths.slice(0, 30)
  };
  writeBlockCache(REBIRTH_MONITOR_CACHE_KEY, currentBlock, [data]);
  return data;
}

export async function getStakingMonitorData(): Promise<StakingMonitorData> {
  if (!isConfigured(CONTRACTS.MGXStaking) || !isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("Staking monitor contracts are not configured");
  }

  const provider = getProvider();
  const staking = new Contract(
    CONTRACTS.MGXStaking,
    [
      ...ABIS.MGXStaking,
      "function pendingStakingReward(address) view returns (uint256)",
      "function rewardRate() view returns (uint256)",
      "function minBalanceThreshold() view returns (uint256)",
      "function topUpAmount() view returns (uint256)",
      "function topUpCooldown() view returns (uint256)",
      "function lastTopUpTime() view returns (uint256)",
      "function treasury() view returns (address)",
      "function getTreasuryStatus() view returns (uint256,uint256)"
    ],
    provider
  );
  const mgx = new Contract(
    CONTRACTS.MGXToken,
    [
      "function balanceOf(address) view returns (uint256)",
      "function totalSupply() view returns (uint256)"
    ],
    provider
  );
  const users = await getAllUsers();
  const [
    rewardPoolRaw,
    totalStakedRaw,
    rewardRateRaw,
    thresholdRaw,
    topUpAmountRaw,
    topUpCooldownRaw,
    lastTopUpTimeRaw,
    treasury,
    treasuryStatus,
    contractBalanceRaw,
    deadBalanceRaw,
    totalSupplyRaw
  ] = await Promise.all([
    staking.rewardPool(),
    staking.totalStaked(),
    staking.rewardRate(),
    staking.minBalanceThreshold(),
    staking.topUpAmount(),
    staking.topUpCooldown(),
    staking.lastTopUpTime(),
    staking.treasury(),
    staking.getTreasuryStatus(),
    mgx.balanceOf(CONTRACTS.MGXStaking),
    mgx.balanceOf(DEAD_ADDRESS),
    mgx.totalSupply()
  ]);

  const treasuryBalanceRaw = BigInt(treasuryStatus[0]);
  const allowanceRaw = BigInt(treasuryStatus[1]);

  const rows = await Promise.all(
    users.map(async (user) => {
      const [position, pendingRaw] = await Promise.all([
        staking.getStakePosition(user.wallet),
        staking.pendingStakingReward(user.wallet)
      ]);
      const amount = Number(position.amount) / 1e18;
      const pendingReward = Number(pendingRaw) / 1e18;
      return {
        userId: user.userId,
        wallet: user.wallet,
        staked: amount,
        lockDurationDays: Number(position.lockDuration),
        pendingReward,
        startTime: Number(position.lockStartedAt),
        rewardDebt: Number(position.rewardDebt)
      };
    })
  );

  const activeRows = rows.filter((row) => row.staked > 0);
  const totalStaked = Number(totalStakedRaw) / 1e18;
  const contractBalance = Number(contractBalanceRaw) / 1e18;
  const burnedMGX = Number(deadBalanceRaw) / 1e18;
  const totalSupply = Number(totalSupplyRaw) / 1e18;
  const burnPercent = totalSupply > 0 ? (burnedMGX / totalSupply) * 100 : 0;
  const rewardRate = Number(rewardRateRaw);
  const rewardRateDailyPercent = (rewardRate / 10_000) * 100;
  const rewardRateApyPercent = rewardRateDailyPercent * 365;
  const theoreticalDaily = (totalStaked * rewardRate) / 10_000;
  const safeBalance = contractBalance * 0.9;
  const maxDaily = contractBalance / 30;
  const dailyEmission = Math.min(theoreticalDaily, Math.min(safeBalance, maxDaily));
  const daysRemaining = dailyEmission > 0 ? contractBalance / dailyEmission : 0;
  return {
    totalStaked,
    rewardPool: Number(rewardPoolRaw) / 1e18,
    totalStakers: activeRows.length,
    topStakers: activeRows
      .sort((a, b) => b.staked - a.staked)
      .slice(0, 20),
    treasury: String(treasury),
    treasuryConfigured: String(treasury) !== NULL_ADDRESS,
    treasuryBalance: Number(treasuryBalanceRaw) / 1e18,
    allowanceToStaking: Number(allowanceRaw) / 1e18,
    contractBalance,
    minBalanceThreshold: Number(thresholdRaw) / 1e18,
    topUpAmount: Number(topUpAmountRaw) / 1e18,
    topUpCooldown: Number(topUpCooldownRaw),
    lastTopUpTime: Number(lastTopUpTimeRaw),
    rewardRate,
    rewardRateDailyPercent,
    rewardRateApyPercent,
    dailyEmission,
    daysRemaining,
    burnedMGX,
    burnPercent
  };
}

export async function getAllTransactions(): Promise<TransactionRecord[]> {
  if (!isConfigured(CONTRACTS.MetaGuildXCore)) {
    throw new Error("MetaGuildXCore address is not configured");
  }

  const provider = getProvider();
  const router = new Contract(CONTRACTS.IncomeRouter, ABIS.IncomeRouter, provider);
  const currentBlock = await provider.getBlockNumber();
  const cachedTransactions = readBlockCache<TransactionRecord>(ALL_TRANSACTIONS_CACHE_KEY);
  if (cachedTransactions && cachedTransactions.lastBlock >= currentBlock) {
    return cachedTransactions.data;
  }

  const incomeFromBlock = NETWORK.startBlock;
  const [
    registrationEvents,
    upgradeEvents,
    placementEvents,
    cashbackEvents,
    directIncomeLogs,
    levelIncomeLogs
  ] = await runWithConcurrency<DashboardEvent[] | TransactionRecord[] | EventLog[]>(
    [
      () => getRegistrationEvents(provider),
      () => getUpgradeEvents(),
      () => getPlacementEvents(),
      () => getCashbackEvents(),
      () => isConfigured(CONTRACTS.IncomeRouter)
        ? batchQueryFilter(router, router.filters.DirectIncomeRecorded(), incomeFromBlock, currentBlock)
        : Promise.resolve([] as EventLog[]),
      () => isConfigured(CONTRACTS.IncomeRouter)
        ? batchQueryFilter(router, router.filters.LevelIncomeRecorded(), incomeFromBlock, currentBlock)
        : Promise.resolve([] as EventLog[])
    ],
    2
  );
  const core = getCoreContract(provider);

  const incomeBlocks = await Promise.all(
    [...(directIncomeLogs as EventLog[]), ...(levelIncomeLogs as EventLog[])].map((log) =>
      provider.getBlock(log.blockNumber)
    )
  );

  const incomeRecords: TransactionRecord[] = await Promise.all(
    [...(directIncomeLogs as EventLog[]), ...(levelIncomeLogs as EventLog[])].map(async (log, index) => {
      const block = incomeBlocks[index];
      const isLevel = "level" in log.args;
      const toUserId = Number(log.args.toUserId);
      const profile = await safeUserProfileRead(core, toUserId);
      const amount = formatPlatformAmount(log.args.amount);
      return {
        type: "Income",
        userId: toUserId,
        wallet: String(profile.account),
        amount,
        details: isLevel
          ? `Level income L${Number(log.args.level)} from User #${Number(log.args.fromUserId)}`
          : `Direct income from User #${Number(log.args.fromUserId)}`,
        timestamp: block?.timestamp ?? 0,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber
      } satisfies TransactionRecord;
    })
  );

  const registrationRecords: TransactionRecord[] = (registrationEvents as DashboardEvent[]).map((event) => ({
    type: "Registration",
    userId: event.userId,
    wallet: event.wallet,
    amount: event.amount,
    details: `Level ${event.packageLevel} - $${event.amount.toFixed(1)} USDT`,
    timestamp: event.timestamp,
    txHash: event.txHash,
    blockNumber: event.blockNumber
  }));

  const transactions = [
    ...registrationRecords,
    ...incomeRecords,
    ...(upgradeEvents as TransactionRecord[]),
    ...(placementEvents as TransactionRecord[]),
    ...(cashbackEvents as TransactionRecord[])
  ].sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) {
      return b.blockNumber - a.blockNumber;
    }
    return b.timestamp - a.timestamp;
  });
  writeBlockCache(ALL_TRANSACTIONS_CACHE_KEY, currentBlock, transactions);
  return transactions;
}

function buildChartData(events: DashboardEvent[]) {
  const today = new Date();
  const points: ChartPoint[] = [];
  const counts = new Map<string, number>();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    counts.set(key, 0);
    points.push({
      date: `${String(date.getDate()).padStart(2, "0")}/${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`,
      registrations: 0
    });
  }

  events.forEach((event) => {
    const date = new Date(event.timestamp * 1000);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });

  return points.map((point, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    return {
      date: point.date,
      registrations: counts.get(key) ?? 0
    };
  });
}

export function useContractData(walletAddress?: string | null) {
  const [state, setState] = useState<HookState>(initialState);

  const fetchAllData = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

      try {
        if (
        !isConfigured(CONTRACTS.MetaGuildXCore) ||
          !isConfigured(CONTRACTS.CashbackPool) ||
          !isConfigured(CONTRACTS.IncomeRouter)
        ) {
          throw new Error("Contract addresses are not configured");
        }

      const provider = getProvider();
      const core = new Contract(
        CONTRACTS.MetaGuildXCore,
        ABIS.MetaGuildXCore,
        provider
      );
      const cashback = new Contract(
        CONTRACTS.CashbackPool,
        ABIS.CashbackPool,
        provider
      );
      const usdt = new Contract(
        CONTRACTS.USDT,
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );

      const [
        nextUserId,
        creatorWallet,
        cashbackPoolRaw,
        surrenderedUsersRaw,
        registrationEvents,
        upgradeEvents,
        creatorWalletBalanceRaw
      ] =
        await Promise.all([
          core.nextUserId(),
          core.creatorFeeWallet(),
          cashback.cashbackPoolBalance(),
          cashback.totalSurrenderedUsers(),
          getRegistrationEvents(provider),
          getUpgradeEvents().then((rows) => rows.filter((row) => row.type === "Upgrade")),
          core.creatorFeeWallet().then((address: string) => usdt.balanceOf(address))
        ]);

      const totalUsers = Math.max(Number(nextUserId) - 1, 0);
      const totalVolumeEvents = [
        ...registrationEvents,
        ...upgradeEvents
      ];
      const totalVolume = totalVolumeEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0);
      const todayStart = startOfTodayUnix();
      const todayRegistrations = registrationEvents.filter(
        (event) => event.timestamp >= todayStart
      ).length;
      setState({
        stats: {
          totalUsers,
          totalVolume,
          todayRegistrations,
          creatorIncome: formatTokenAmount(creatorWalletBalanceRaw),
          cashbackPool: formatPlatformAmount(cashbackPoolRaw),
          surrenderedUsers: Number(surrenderedUsersRaw)
        },
        chartData: buildChartData(registrationEvents),
        recentRegistrations: registrationEvents.slice(0, 10),
        loading: false,
        error: null,
        lastUpdated: Date.now()
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Contract not connected";
      setState((current) => ({
        ...current,
        loading: false,
        error: message
      }));
    }
  }, [walletAddress]);

  useEffect(() => {
    void fetchAllData();
    const interval = window.setInterval(() => {
      void fetchAllData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchAllData]);

  return {
    ...state,
    retry: fetchAllData
  };
}
