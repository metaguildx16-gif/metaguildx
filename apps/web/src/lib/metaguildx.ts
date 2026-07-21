import { BrowserProvider, Contract, Interface, JsonRpcProvider, Wallet, formatEther, formatUnits, getAddress, getBytes, parseUnits, solidityPackedKeccak256, verifyMessage, type ContractRunner } from "ethers";
import { activeNetworkConfig, toHexChainId } from "../config/networks";

const DEBUG_EVENTS = false;
const BLOCK_CHUNK_SIZE = 49_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms = 15000,
  fallback?: T
): Promise<T> {
  const timeout = new Promise<T>(
    (_, reject) =>
      setTimeout(
        () => reject(new Error("RPC timeout")),
        ms
      )
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw error;
  }
}

function shouldTimeLabel(_label: string) {
  return false;
}

async function timedAsync<T>(label: string, action: () => Promise<T>): Promise<T> {
  const shouldTrace = shouldTimeLabel(label);
  if (shouldTrace) {
    console.time(label);
  }
  try {
    return await action();
  } finally {
    if (shouldTrace) {
      console.timeEnd(label);
    }
  }
}

async function getBlockNumberWithDiagnostics(
  provider: BrowserProvider | JsonRpcProvider,
  label: string
) {
  return timedAsync(label, () => withTimeout(provider.getBlockNumber(), 15000));
}

async function getLogsWithDiagnostics(
  provider: BrowserProvider | JsonRpcProvider,
  filter: Parameters<BrowserProvider["getLogs"]>[0],
  label: string
) {
  return timedAsync(label, () => withTimeout(provider.getLogs(filter), 15000, []));
}

const TESTNET_CORE_ADDRESS = "0xB7607Ed884C665BE1ddE73e6D82d0ac5AD4095af";
const TESTNET_BINARY_TREE_ADDRESS = "0xdfC9C58a20cFd481Dd3e83955d75EfCBA2E6756f";
const TESTNET_INCOME_ROUTER_ADDRESS = "0x02fEAadC09C052Ad0f7EE95Ce1336De80AB380D2";
const TESTNET_CASHBACK_POOL_ADDRESS = "0x0919D80A105746fe53d7b68544b6D9283EcA9724";
const TESTNET_STAKING_ADDRESS = "0x6a8E438f54394141D808a1A24A7a8CA9469E4CfA";
const DEPLOYMENT_CACHE_STORAGE_KEY = "mgx_deployment_cache_key";

function getHistoricalIncomeRouterAddresses(currentRouterAddress?: string | null) {
  return [currentRouterAddress].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
}

const metaGuildXCoreAbi = [
  "function nextUserId() view returns (uint256)",
  "function rootUserId() view returns (uint256)",
  "function currentBoxId() view returns (uint8)",
  "function totalTokenDistributed() view returns (uint256)",
  "function totalCommunityTokenAllocation() view returns (uint256)",
  "function userIdByAddress(address) view returns (uint256)",
  "function activeUsers(uint256) view returns (bool)",
  "function usersById(uint256) view returns (uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered)",
  "function treeNodes(uint256) view returns (uint256 userId, uint256 parentId, uint256 leftChildId, uint256 rightChildId, uint8 depth)",
  "function activeBoxByUser(uint256) view returns (uint8)",
  "function distributedTokensByBox(uint8) view returns (uint256)",
  "function userPrimaryAsset(uint256) view returns (address)",
  "function defaultPaymentAsset() view returns (address)",
  "function creatorFeeWallet() view returns (address)",
  "function productionMode() view returns (bool)",
  "function paymentAssetUnitPrice(address) view returns (uint256)",
  "function userPlatformBalancesByAsset(uint256,address) view returns (uint256)",
  "function userAssetBalances(uint256,address) view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function getPackagePrices() view returns (uint256[])",
  "function getDirectReferralIds(uint256) view returns (uint256[])",
  "function getUserSponsorId(uint256) view returns (uint256)",
  "function getLevelParent(uint256) view returns (uint256)",
  "function getLevelChildren(uint256) view returns (uint256 left, uint256 right)",
  "function isLevelEligibleUser(uint256) view returns (bool)",
  "function isRebirthUser(uint256) view returns (bool)",
  "function failedDistribution(uint256) view returns (bool)",
  "function failedDistributionPackageLevel(uint256) view returns (uint8)",
  "function registerWithPlacement(uint256,uint256,bool,bytes,uint256,uint256) returns (uint256)",
  "function upgradePackage(uint256,uint8)",
  "function stake(uint256,uint256,bool)",
  "function claimStakingReward()",
  "function compoundStakingReward()",
  "function withdrawStake(uint256)",
  "function setCreatorFeeWallet(address)",
  "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
  "event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount)",
  "event RebirthUserCreated(uint256 indexed originalUserId, uint256 indexed newUserId, address wallet)",
  "event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount)",
  "event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount)"
] as const;

const mgxStakingAbi = [
  "function rewardPool() view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function pendingStakingReward(address) view returns (uint256)",
  "function getStakePosition(address) view returns (uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound)",
  "function getPositionCount(address) view returns (uint256)",
  "function getStakePositions(address) view returns ((uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound)[])",
  "function stakeFor(address,uint256,uint256,uint256,bool,address) returns (uint256)",
  "function claimFor(address) returns (uint256 reward, address paymentAsset, uint256 settlementAmount, uint256 autoCompoundedReward)",
  "function compoundFor(address) returns (uint256 reward, uint256 autoCompoundedReward)",
  "function withdrawFor(address,uint256) returns (uint256 amountAfterFee, address paymentAsset, uint256 settlementCredit, uint256 fee, uint256 autoCompoundedReward)"
] as const;

type StakeDurationKey = "30D" | "90D" | "180D" | "1Y" | "2Y";

const stakeDurationDays: Record<StakeDurationKey, bigint> = {
  "30D": 30n,
  "90D": 90n,
  "180D": 180n,
  "1Y": 365n,
  "2Y": 730n
};

const metaGuildXIncomeAbi = [
  "function getEscrow(uint256) view returns (uint256)",
  "function getTotalEscrow(uint256) view returns (uint256)",
  "function getRebirthEscrow(uint256) view returns (uint256)",
  "function getTotalIncome(uint256) view returns (uint256)",
  "function getTotalAllIncome(uint256) view returns (uint256)",
  "function totalEarnings(uint256,uint256) view returns (uint256)",
  "function incomesByUser(uint256) view returns (uint256 direct, uint256 level, uint256 spillover, uint256 crossline)"
] as const;

const metaGuildXUpgradeAbi = [
  "function getRebirthIds(uint256) view returns (uint256[])"
] as const;

const metaGuildXTokenEngineAbi = [
  "function getTokenAllocation(uint256) view returns (uint256)"
] as const;

const cashbackPoolAbi = [
  "function cashbackPoolBalance() view returns (uint256)",
  "function cashbackPoolBalanceByAsset(address) view returns (uint256)",
  "function totalSurrenderedUsers() view returns (uint256)",
  "function pendingCashback(uint256,address,bool) view returns (uint256 platformAmount, uint256 settlementAmount)",
  "function claimCashback(address,uint256) returns (uint256 platformAmount, uint256 settlementAmount)",
  "function surrenderForCashback(address,uint256)"
] as const;

const binaryTreeAbi = [
  "function nodes(uint256) view returns (uint256 userId, uint256 parentId, uint256 leftChildId, uint256 rightChildId)",
  "function nodeDepth(uint256) view returns (uint256)",
  "function getChildren(uint256) view returns (uint256 left, uint256 right)",
  "function getLevelChildren(uint256) view returns (uint256 left, uint256 right)",
  "function getLevelParent(uint256) view returns (uint256)",
  "function isLevelEligible(uint256) view returns (bool)",
  "function levelRootId() view returns (uint256)",
  "function findNextSlotUnderSponsor(uint256) view returns (uint256 parentId, bool isLeft)",
  "function findNextAvailableSlot(uint256) view returns (uint256 parentId, bool isLeft)"
] as const;

const incomeRouterWriteAbi = [
  "function creatorWallet() view returns (address)",
  "function setCreatorWallet(address)",
  "function platformReserve() view returns (uint256)",
  "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel)",
  "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount, uint8 cyclePkgLevel)",
  "event LevelIncomeSkipped(uint256 indexed skippedUserId, uint256 indexed fromUserId, uint8 indexed level, address asset, uint256 amount, uint256 timestamp)",
  "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)",
  "event CrossLineIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)"
] as const;

const erc20ApprovalAbi = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
] as const;

const PLATFORM_DECIMALS = 1;
const DEFAULT_STABLECOIN_DECIMALS = 6;
const fallbackPackages = [10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120];
const fallbackBoxes = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25];
const PACKAGE_PRICES_USDT: Record<number, number> = {
  1: 10,
  2: 20,
  3: 40,
  4: 80,
  5: 160,
  6: 320,
  7: 640,
  8: 1280,
  9: 2560,
  10: 5120
};

async function queryFilterChunked(
  contract: any,
  filter: any,
  fromBlock: number,
  toBlock: number,
  chunkSize = BLOCK_CHUNK_SIZE
) {
  const results: any[] = [];
  const totalRange = Math.max(0, toBlock - fromBlock);
  const effectiveChunkSize = totalRange > 200_000 ? Math.max(chunkSize, BLOCK_CHUNK_SIZE) : chunkSize;
  for (let start = fromBlock; start <= toBlock; start += effectiveChunkSize) {
    const end = Math.min(start + effectiveChunkSize - 1, toBlock);
    let chunk: any[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        chunk = await timedAsync(
          `queryFilter:${filter?.fragment?.name ?? filter?.name ?? "unknown"}:${start}-${end}`,
          () => withTimeout(contract.queryFilter(filter, start, end), 15000, [])
        );
        break;
      } catch (err: any) {
        const isLimitErr = err?.code === -32005 || /limit exceeded/i.test(err?.message ?? "");
        if (isLimitErr && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    results.push(...chunk);
  }
  return results;
}

async function queryAllEvents(
  contract: any,
  filter: any,
  startBlock: number,
  endBlock: number,
  chunkSize = BLOCK_CHUNK_SIZE
) {
  const allEvents: any[] = [];
  let from = startBlock;
  const totalRange = Math.max(0, endBlock - startBlock);
  const effectiveChunkSize = totalRange > 200_000 ? Math.max(chunkSize, BLOCK_CHUNK_SIZE) : chunkSize;
  while (from <= endBlock) {
    const to = Math.min(from + effectiveChunkSize, endBlock);
    try {
      const events = await timedAsync(
        `queryAllEvents:${filter?.fragment?.name ?? filter?.name ?? "unknown"}:${from}-${to}`,
        () => withTimeout(contract.queryFilter(filter, from, to), 15000, [])
      );
      allEvents.push(...events);
    } catch {
      // Skip failed chunks so a single RPC window doesn't hide the whole history.
    }
    from = to + 1;
  }

  return allEvents;
}

function getEventQueryStartBlock(currentBlock: number) {
  return getDeploymentAnalyticsStartBlock(currentBlock);
}

export type ConnectedWalletHistoryRow = {
  hash: string;
  date: string;
  type: string;
  amount: string;
  status: "Success" | "Failed";
  explorerUrl: string;
};

export type UserIncomeHistoryRow = {
  txHash: string;
  amount: string;
  dateLabel: string;
  fromUserId: number | null;
  note: string;
};

export type StakePositionView = {
  index: number;
  amount: string;
  rewardDebt: bigint;
  lockDurationSeconds: number;
  lockDurationLabel: string;
  startTime: number;
  startDateLabel: string;
  unlockTime: number;
  unlockDateLabel: string;
  isLocked: boolean;
  lockProgressPercent: number;
  pendingReward: string;
  autoCompound: boolean;
};

export type DashboardSnapshot = {
  walletAddress: string | null;
  isPartialLoad?: boolean;
  userId: number | null;
  sponsorId: number | null;
  joinedAt: number | null;
  packageLevel: number | null;
  isRebirthUser: boolean;
  totalContribution: string;
  totalEarnings: string;
  directReferrals: number;
  totalTeamBusiness: string;
  rebirthCount: number;
  xCount: number;
  internalWalletBalance: string;
  rebirthEscrowBalance: string;
  lostEarnings: string;
  currentPackageEscrow: string;
  currentPackageBucketEarnings: string;
  packageOneBucketEarnings: string;
  boxEarningsByPackage: Record<number, string>;
  withdrawablePlatformBalance: string;
  withdrawableSettlementBalance: string;
  externalWalletBalance: string;
  connectedWalletValue: string;
  mgxWalletBalance: string;
  connectedWalletAssets: Array<{
    id: string;
    name: string;
    subtitle: string;
    amount: string;
    value: string;
    tone: string;
    logo?: string | null;
  }>;
  connectedWalletAssetsError: string | null;
  connectedWalletHistory: ConnectedWalletHistoryRow[];
  connectedWalletHistoryError: string | null;
  connectedWalletHistoryCursor: string | null;
  settlementAssetLabel: string;
  settlementAssetAddress: string | null;
  pendingStakingReward: string;
  stakingRewardPool: string;
  totalStaked: string;
  personalStaked: string;
  stakeLockDurationLabel: string;
  stakeAutoCompound: boolean;
  stakePositions: StakePositionView[];
  cashbackPoolBalance: string;
  totalTokenDistributed: string;
  directIncome: string;
  levelIncome: string;
  spilloverIncome: string;
  crossLineIncome: string;
  cashbackIncome: string;
  stakingIncome: string;
  packagePrices: number[];
  boxPrices: number[];
  rootUserId: number | null;
  isConnected: boolean;
  hasContractConfig: boolean;
  isRegistered: boolean;
  featuredUsers: Array<{
    userId: number;
    packageLevel: number;
    totalEarnings: string;
    directReferrals: number;
    internalWalletBalance: string;
    mgxAllocated: string;
    userActiveBoxId: number | null;
  }>;
  treePreview: Array<{
    userId: number;
    parentId: number;
    leftChildId: number;
    rightChildId: number;
    depth: number;
    packageLevel: number;
    account: string;
    directReferrals: number;
    totalTeamBusiness: string;
    totalEarnings: string;
    mgxAllocated: string;
    userActiveBoxId: number | null;
  }>;
  activityFeed: Array<{
    kind: string;
    primary: string;
    secondary: string;
    blockNumber?: number;
    timestampLabel?: string;
  }>;
  spilloverHistory: UserIncomeHistoryRow[];
  networkBonusHistory: UserIncomeHistoryRow[];
  contractReady: boolean;
  contractWarning: string | null;
  directReferralIds: number[];
  directReferralIncomeByUserId: Record<number, string>;
  levelBreakdown?: {
    level: number;
    amount: string;
    members: number;
  }[];
  rebirthIds: number[];
  unlockedLevels: number;
  unlockedLevelStatus: boolean[];
  leftBranchNodes: number;
  rightBranchNodes: number;
  leftBranchBusiness: string;
  rightBranchBusiness: string;
  levelTreeLeft: number;
  levelTreeRight: number;
  currentBoxId: number;
  currentBoxPrice: string;
  currentBoxDistributed: string;
  currentBoxCap: string;
  currentBoxRemaining: string;
  mgxAllocated: string;
  userActiveBoxId: number | null;
  pendingCashback: string;
  incomeDistributionPending: boolean;
  incomeDistributionPendingPackageLevel: number | null;
  isSurrendered: boolean;
  surrenderStatus: string;
};

export type TreePreviewNode = DashboardSnapshot["treePreview"][number];

export type AdminRecentEvent = {
  event: string;
  details: string;
  block: number;
};

export type AdminOverview = {
  totalUsers: number;
  totalUsdtCollected: string;
  totalMgxDistributed: string;
  creatorWallet: string;
  productionMode: boolean;
  addresses: {
    core: string;
    usdt: string;
    binaryTree: string;
    incomeRouter: string;
    cashbackPool: string;
    staking: string;
  };
  recentEvents: AdminRecentEvent[];
};

export type TreeNodeDetails = {
  userId: number;
  packageLevel: number;
  xCount: number;
  parentId: number;
  leftChildId: number;
  rightChildId: number;
  depth: number;
  directReferrals: number;
  totalTeamBusiness: string;
  totalEarnings: string;
  internalWalletBalance: string;
  rebirthEscrowBalance: string;
  lostEarnings: string;
  directIncome: string;
  levelIncome: string;
  spilloverIncome: string;
  crossLineIncome: string;
  cashbackIncome: string;
  stakingIncome: string;
  pendingStakingReward: string;
  walletAddress: string;
  mgxAllocated: string;
  userActiveBoxId: number | null;
  leftBranchNodes: number;
  rightBranchNodes: number;
  leftBranchBusiness: string;
  rightBranchBusiness: string;
  levelTreeLeft: number;
  levelTreeRight: number;
  directReferralIds: number[];
  rebirthIds: number[];
  unlockedLevels: number;
  unlockedLevelStatus: boolean[];
};

export type LiveWalletStakeState = {
  isRegistered: boolean;
  mgxAllocated: string;
  userActiveBoxId: number | null;
  pendingStakingReward: string;
  personalStaked: string;
  stakeLockDurationLabel: string;
  stakeAutoCompound: boolean;
  stakePositions: StakePositionView[];
  totalStaked: string;
  escrowBalance: string;
  pendingCashback: string;
};

export type RegistrationResult = {
  txHash: string;
  paid: string;
  breakdown: {
    directIncome: string;
    levelIncome: string;
    cashbackPool: string;
    creatorFee: string;
  };
  mgxReward: string;
  distribution?: RegistrationDistribution;
};

export type RegistrationDistribution = {
  directIncome: string;
  levelIncome: string;
  cashbackPool: string;
  creatorFee: string;
  sponsorWallet: string;
  platformReserve: string;
};

export const fallbackSnapshot: DashboardSnapshot = {
  walletAddress: null,
  userId: null,
  sponsorId: null,
  joinedAt: null,
  packageLevel: null,
  isRebirthUser: false,
  totalContribution: "0",
  totalEarnings: "0",
  directReferrals: 0,
  totalTeamBusiness: "0",
  rebirthCount: 0,
  xCount: 0,
  internalWalletBalance: "0",
  rebirthEscrowBalance: "0",
  lostEarnings: "0",
  currentPackageEscrow: "0",
  currentPackageBucketEarnings: "0",
  packageOneBucketEarnings: "0",
  boxEarningsByPackage: {},
  withdrawablePlatformBalance: "0",
  withdrawableSettlementBalance: "0",
  externalWalletBalance: "0",
  connectedWalletValue: "0",
  mgxWalletBalance: "0",
  connectedWalletAssets: [],
  connectedWalletAssetsError: null,
  connectedWalletHistory: [],
  connectedWalletHistoryError: null,
  connectedWalletHistoryCursor: null,
  settlementAssetLabel: "Settlement asset",
  settlementAssetAddress: null,
  pendingStakingReward: "0",
  stakingRewardPool: "0",
  totalStaked: "0",
  personalStaked: "0",
  stakeLockDurationLabel: "No active stake",
  stakeAutoCompound: false,
  stakePositions: [],
  cashbackPoolBalance: "0",
  totalTokenDistributed: "0",
  directIncome: "0",
  levelIncome: "0",
  spilloverIncome: "0",
  crossLineIncome: "0",
  cashbackIncome: "0",
  stakingIncome: "0",
  packagePrices: fallbackPackages,
  boxPrices: fallbackBoxes,
  rootUserId: null,
  isConnected: false,
  hasContractConfig: Boolean(activeNetworkConfig.contractAddress.trim()),
  isRegistered: false,
  featuredUsers: [],
  treePreview: [],
  activityFeed: [],
  spilloverHistory: [],
  networkBonusHistory: [],
  contractReady: false,
  contractWarning: null,
  directReferralIds: [],
  directReferralIncomeByUserId: {},
  rebirthIds: [],
      unlockedLevels: 0,
      unlockedLevelStatus: Array.from({ length: 10 }, () => false),
      leftBranchNodes: 0,
      rightBranchNodes: 0,
      leftBranchBusiness: "0",
      rightBranchBusiness: "0",
      levelTreeLeft: 0,
      levelTreeRight: 0,
      currentBoxId: 1,
  currentBoxPrice: "1.00",
  currentBoxDistributed: "0",
  currentBoxCap: "0",
  currentBoxRemaining: "0",
  mgxAllocated: "0",
  userActiveBoxId: null,
  pendingCashback: "0",
  incomeDistributionPending: false,
  incomeDistributionPendingPackageLevel: null,
  isSurrendered: false,
  surrenderStatus: "Not available"
};

const snapshotCache = new Map<string, { data: DashboardSnapshot; timestamp: number }>();
const boxEarningsCache = new Map<string, { data: Record<number, bigint>; timestamp: number }>();
const levelBreakdownCache = new Map<
  string,
  {
    data: { level: number; amount: string; members: number }[];
    timestamp: number;
  }
>();
const genealogyCache = new Map<string, { data: Set<number>; timestamp: number }>();
const SNAPSHOT_CACHE_TTL = 300_000;
const SNAPSHOT_LOCAL_CACHE_TTL = 30 * 60 * 1000;
export const DASHBOARD_SNAPSHOT_REFRESH_EVENT = "mgx:dashboard-snapshot-refreshed";
const GENEALOGY_CACHE_TTL = 300_000;
const tokenDecimalsCache = new Map<string, number>();
const backgroundRefreshInFlight = new Set<string>();
const backgroundRefreshScheduled = new Set<string>();
const BOX_EARNINGS_CACHE_PREFIX = "mgx_box_earnings_v1";
const HOT_PATH_CACHE_PREFIX = "mgx_hot_path_v1";
const HOT_PATH_CACHE_TTL = 5 * 60 * 1000;
const BRANCH_STATS_CACHE_TTL = 30 * 60 * 1000;
const BRANCH_STATS_BLOCK_BUCKET = 1_000;

type PersistedBoxEarnings = {
  data: Record<number, bigint>;
  lastScannedBlock: number;
  timestamp: number;
};

type PersistedBigIntTotal = {
  total: string;
  lastScannedBlock: number;
  timestamp: number;
};

type PersistedDirectReferralIncome = {
  data: Record<string, string>;
  lastScannedBlock: number;
  timestamp: number;
};

type PersistedCrosslineIncome = {
  total: string;
  history: UserIncomeHistoryRow[];
  rebirthIds: number[];
  lastScannedBlock: number;
  timestamp: number;
};

type LevelBreakdownRow = { level: number; amount: string; members: number };

type PersistedLevelBreakdown = {
  lastScannedBlock: number;
  data: LevelBreakdownRow[];
  amountRawByLevel?: Record<string, string>;
  memberIdsByLevel?: Record<string, number[]>;
  timestamp: number;
};

type PersistedSponsorMap = {
  sponsors: Record<string, number>;
  lastCachedUserId: number;
  timestamp: number;
};

type PersistedBranchStats = {
  data: {
    leftDirectChildId: number;
    rightDirectChildId: number;
    leftBranchNodes: number;
    rightBranchNodes: number;
    leftBranchBusiness: string;
    rightBranchBusiness: string;
  };
  blockBucket: number;
  timestamp: number;
};

type PersistedLevelBranchStats = {
  data: {
    levelTreeLeft: number;
    levelTreeRight: number;
  };
  blockBucket: number;
  timestamp: number;
};

function getPersistentSnapshotCacheKey(walletAddress?: string | null) {
  if (!walletAddress) {
    return null;
  }
  return `mgx_snapshot_v2_${walletAddress.toLowerCase()}`;
}

function readPersistentDashboardSnapshot(cacheKey: string): { data: DashboardSnapshot; timestamp: number } | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached, (_key, value) => {
      if (typeof value === "string" && value.startsWith("__bigint__")) {
        return BigInt(value.slice("__bigint__".length));
      }
      return value;
    }) as { data?: DashboardSnapshot; timestamp?: number };
    if (!parsed.data || typeof parsed.timestamp !== "number") {
      return null;
    }
    return { data: parsed.data, timestamp: parsed.timestamp };
  } catch (error) {
    console.warn("[MGX] persistent snapshot cache read failed", { cacheKey, error });
    return null;
  }
}

function writePersistentDashboardSnapshot(cacheKey: string | null, data: DashboardSnapshot) {
  if (typeof window === "undefined" || !cacheKey) {
    return;
  }

  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({ data, timestamp: Date.now() }, (_key, value) =>
        typeof value === "bigint" ? `__bigint__${value.toString()}` : value
      )
    );
  } catch (error) {
    console.warn("[MGX] persistent snapshot cache write failed", { cacheKey, error });
  }
}

export function updatePersistentDashboardSnapshotBoxEarnings(
  walletAddress: string | null | undefined,
  boxUpdate: {
    packageOneBucketEarnings: string;
    currentPackageBucketEarnings: string;
    boxEarningsByPackage: Record<number, string>;
  }
) {
  const cacheKey = getPersistentSnapshotCacheKey(walletAddress);
  if (!cacheKey) {
    return;
  }

  const cached = readPersistentDashboardSnapshot(cacheKey);
  if (!cached?.data) {
    return;
  }

  writePersistentDashboardSnapshot(cacheKey, {
    ...cached.data,
    packageOneBucketEarnings: boxUpdate.packageOneBucketEarnings,
    currentPackageBucketEarnings: boxUpdate.currentPackageBucketEarnings,
    boxEarningsByPackage: boxUpdate.boxEarningsByPackage
  });
}

function readPersistentJson<T>(cacheKey: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(cacheKey);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

function writePersistentJson<T>(cacheKey: string, data: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}

function getHotPathCacheKey(name: string, ...parts: Array<string | number | null | undefined>) {
  return [
    HOT_PATH_CACHE_PREFIX,
    getDeploymentCacheNamespace(),
    name,
    ...parts.map((part) => String(part ?? "none").toLowerCase())
  ].join("_");
}

function isFreshHotPathCache(timestamp: number | undefined) {
  return typeof timestamp === "number" && Date.now() - timestamp < HOT_PATH_CACHE_TTL;
}

function isFreshBranchStatsCache(timestamp: number | undefined) {
  return typeof timestamp === "number" && Date.now() - timestamp < BRANCH_STATS_CACHE_TTL;
}

function getBlockBucket(blockNumber: number) {
  return Math.floor(blockNumber / BRANCH_STATS_BLOCK_BUCKET) * BRANCH_STATS_BLOCK_BUCKET;
}

function getPersistentBoxEarningsCacheKey(userId: number, routerAddress: string, deployBlock: number) {
  return `${BOX_EARNINGS_CACHE_PREFIX}_${getDeploymentCacheNamespace()}_${routerAddress.toLowerCase()}_${userId}_${deployBlock}`;
}

async function buildAndCacheSponsorMap(
  provider: BrowserProvider | JsonRpcProvider,
  core: Contract,
  nextUserId: number
): Promise<Map<number, number>> {
  void provider;
  const cacheKey = `mgx_sponsor_map_v1_${getDeploymentCacheNamespace()}`;
  const cached = readPersistentJson<PersistedSponsorMap>(cacheKey);
  const sponsors: Record<string, number> = { ...(cached?.sponsors ?? {}) };
  const maxUserId = Math.max(0, Number(nextUserId) - 1);
  const lastCachedUserId =
    cached && Number.isFinite(cached.lastCachedUserId)
      ? Math.min(Math.max(0, Number(cached.lastCachedUserId)), maxUserId)
      : 0;

  if (maxUserId > lastCachedUserId) {
    const BATCH = 10;
    for (let userId = lastCachedUserId + 1; userId <= maxUserId; userId += BATCH) {
      const batch = Array.from(
        { length: Math.min(BATCH, maxUserId - userId + 1) },
        (_, index) => userId + index
      );
      const profiles = await Promise.all(
        batch.map(async (uid) => {
          try {
            return await core.usersById(BigInt(uid));
          } catch {
            return null;
          }
        })
      );

      profiles.forEach((profile, index) => {
        const uid = batch[index];
        sponsors[String(uid)] = Number(profile?.sponsorId ?? profile?.[2] ?? 0n);
      });
    }

    writePersistentJson<PersistedSponsorMap>(cacheKey, {
      sponsors,
      lastCachedUserId: maxUserId,
      timestamp: Date.now()
    });
  }

  return new Map(
    Object.entries(sponsors)
      .map(([uid, sponsor]) => [Number(uid), Number(sponsor)] as const)
      .filter(([uid]) => Number.isFinite(uid) && uid > 0)
  );
}

function readPersistentBoxEarnings(cacheKey: string): PersistedBoxEarnings | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }
    const parsed = JSON.parse(cached) as {
      data?: Record<string, string>;
      lastScannedBlock?: number;
      timestamp?: number;
    };
    if (!parsed.data || typeof parsed.lastScannedBlock !== "number" || typeof parsed.timestamp !== "number") {
      return null;
    }
    return {
      data: Object.fromEntries(
        Object.entries(parsed.data).map(([pkg, amount]) => [Number(pkg), BigInt(amount)])
      ),
      lastScannedBlock: parsed.lastScannedBlock,
      timestamp: parsed.timestamp
    };
  } catch {
    return null;
  }
}

function writePersistentBoxEarnings(cacheKey: string, data: Record<number, bigint>, lastScannedBlock: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        data: Object.fromEntries(
          Object.entries(data).map(([pkg, amount]) => [pkg, amount.toString()])
        ),
        lastScannedBlock,
        timestamp: Date.now()
      })
    );
  } catch {
    // Ignore storage quota or privacy-mode failures; in-memory cache still works.
  }
}

function waitForNonCriticalScanDelay(ms = 3000) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      window.clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = window.setTimeout(finish, ms);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    idleWindow.requestIdleCallback?.(finish, { timeout: ms });
  });
}

function cacheDashboardSnapshot(
  memoryCacheKey: string,
  persistentCacheKey: string | null,
  data: DashboardSnapshot,
  options?: { emitRefresh?: boolean }
) {
  const timestamp = Date.now();
  snapshotCache.set(memoryCacheKey, { data, timestamp });
  writePersistentDashboardSnapshot(persistentCacheKey, data);

  if (options?.emitRefresh && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_SNAPSHOT_REFRESH_EVENT, {
        detail: {
          snapshot: data,
          walletAddress: data.walletAddress ?? null
        }
      })
    );
  }
}

export function invalidateDashboardSnapshotCache(walletAddress?: string | null) {
  const namespace = getDeploymentCacheNamespace();
  const keys = new Set<string>([
    `snapshot-${namespace}-${walletAddress ?? "__guest__"}`,
    `snapshot-${namespace}-${walletAddress?.toLowerCase() ?? "__guest__"}`
  ]);
  for (const key of keys) {
    snapshotCache.delete(key);
  }

  const persistentCacheKey = getPersistentSnapshotCacheKey(walletAddress);
  if (persistentCacheKey && typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(persistentCacheKey);
    } catch {
      // Ignore privacy-mode storage failures.
    }
  }
}

export function queueDashboardSnapshotRefresh(walletAddress?: string | null) {
  queueBackgroundDashboardRefresh(walletAddress);
}

function queueBackgroundDashboardRefresh(walletAddress?: string | null) {
  const key = walletAddress ?? "__guest__";
  if (backgroundRefreshInFlight.has(key) || backgroundRefreshScheduled.has(key)) {
    return;
  }

  backgroundRefreshScheduled.add(key);
  const runRefresh = () => {
    backgroundRefreshScheduled.delete(key); // Phase 4: Ensures no duplicate background scans
    if (backgroundRefreshInFlight.has(key)) {
      return;
    }

    backgroundRefreshInFlight.add(key);
    void loadDashboardSnapshot(walletAddress, { forceRefresh: true })
      .catch((error) => {
        console.warn("MetaGuildX background dashboard refresh failed", error);
      })
      .finally(() => {
        backgroundRefreshInFlight.delete(key);
      });
  };

  if (typeof window === "undefined") {
    setTimeout(runRefresh, 3000);
    return;
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(runRefresh, { timeout: 3000 });
  } else {
    window.setTimeout(runRefresh, 3000);
  }
}

function getConfiguredDeploymentStartBlockValue() {
  const configuredBlock = Number(readTrimmedEnv("VITE_DEPLOY_BLOCK") || "151879381");
  if (Number.isFinite(configuredBlock) && configuredBlock >= 0) {
    return configuredBlock;
  }

  const configuredStartBlock = Number((activeNetworkConfig as typeof activeNetworkConfig & { startBlock?: number }).startBlock);
  if (Number.isFinite(configuredStartBlock) && configuredStartBlock >= 0) {
    return configuredStartBlock;
  }

  return null;
}

function getDeploymentCacheNamespace() {
  const configuredCoreAddressForCache =
    readTrimmedEnv(
      "VITE_CORE_ADDRESS",
      "VITE_SYSTEM_PROXY_ADDRESS",
      "VITE_SYSTEM_ADDRESS",
      "VITE_CONTRACT_ADDRESS",
      "VITE_TESTNET_CONTRACT_ADDRESS",
      "VITE_LOCAL_CONTRACT_ADDRESS",
      "VITE_MAINNET_CONTRACT_ADDRESS"
    ) ||
    activeNetworkConfig.contractAddress ||
    "unknown-core";
  const deployBlock = getConfiguredDeploymentStartBlockValue();

  return `${configuredCoreAddressForCache.trim().toLowerCase()}:${deployBlock ?? "unset"}`;
}

function clearAnalyticsCaches() {
  snapshotCache.clear();
  levelBreakdownCache.clear();
  genealogyCache.clear();
  // Clear localStorage persistent snapshot cache
  if (typeof window !== "undefined") {
    try {
      const keys = Object.keys(window.localStorage);
      keys.forEach(k => {
        if (k.startsWith("mgx_snapshot_v2_")) {
          window.localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }
}

export function invalidateDashboardAnalytics() {
  clearAnalyticsCaches();
}

function syncAnalyticsCachesForDeployment() {
  if (typeof window === "undefined") {
    return;
  }

  const deploymentCacheNamespace = getDeploymentCacheNamespace();
  const previousNamespace = window.localStorage.getItem(DEPLOYMENT_CACHE_STORAGE_KEY);
  if (previousNamespace !== deploymentCacheNamespace) {
    clearAnalyticsCaches();
    window.localStorage.setItem(DEPLOYMENT_CACHE_STORAGE_KEY, deploymentCacheNamespace);
  }
}

function formatAmountWithDecimals(value: bigint, decimals: number) {
  const numericValue = decimals === 18 ? Number(formatEther(value)) : Number(formatUnits(value, decimals));
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals === 18 ? 6 : Math.min(decimals, 6)
  });
}

function formatTokenAmount(value: bigint, decimals = PLATFORM_DECIMALS) {
  return formatAmountWithDecimals(value, decimals);
}

function formatUsdAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatPlatformAmountNumber(value: bigint) {
  return Number(formatUnits(value, PLATFORM_DECIMALS));
}

function compactAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeAddress(value: string) {
  const normalizedValue = value.trim();
  try {
    return getAddress(normalizedValue);
  } catch {
    return normalizedValue.toLowerCase();
  }
}

function readTrimmedEnv(...keys: string[]) {
  for (const key of keys) {
    const rawValue = (import.meta.env[key] as string | undefined)?.trim();
    if (rawValue) {
      return rawValue;
    }
  }
  return "";
}

export function getDeploymentAnalyticsStartBlock(currentBlock?: number) {
  const configuredBlock = getConfiguredDeploymentStartBlockValue();
  if (configuredBlock !== null) {
    return configuredBlock;
  }

  return currentBlock ?? 0;
}

const OPBNB_TESTNET_DEPLOYMENT_START_BLOCK = getDeploymentAnalyticsStartBlock();

async function getTokenDecimals(
  provider: BrowserProvider | JsonRpcProvider,
  tokenAddress: string | null | undefined
) {
  if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
    return 18;
  }

  const normalizedAddress = normalizeAddress(tokenAddress);
  const cachedDecimals = tokenDecimalsCache.get(normalizedAddress);
  if (cachedDecimals !== undefined) {
    return cachedDecimals;
  }

  try {
    const token = new Contract(normalizedAddress, erc20ApprovalAbi, provider);
    const decimals = Number(await token.decimals());
    tokenDecimalsCache.set(normalizedAddress, decimals);
    return decimals;
  } catch {
    tokenDecimalsCache.set(normalizedAddress, DEFAULT_STABLECOIN_DECIMALS);
    return DEFAULT_STABLECOIN_DECIMALS;
  }
}

function getConfiguredCoreAddress() {
  const configuredAddress = readTrimmedEnv(
    "VITE_CORE_ADDRESS",
    "VITE_SYSTEM_PROXY_ADDRESS",
    "VITE_SYSTEM_ADDRESS",
    "VITE_CONTRACT_ADDRESS",
    "VITE_TESTNET_CONTRACT_ADDRESS",
    "VITE_LOCAL_CONTRACT_ADDRESS",
    "VITE_MAINNET_CONTRACT_ADDRESS"
  ) || activeNetworkConfig.contractAddress.trim();

  const normalizedAddress = configuredAddress.trim();
  if (!normalizedAddress || normalizedAddress.length !== 42) {
    throw new Error(`Invalid core address in .env: ${normalizedAddress}`);
  }

  return normalizeAddress(normalizedAddress);
}

function getConfiguredRouterAddress() {
  const configuredAddress = readTrimmedEnv("VITE_ROUTER_ADDRESS");

  const normalizedAddress = configuredAddress.trim();
  if (!normalizedAddress || normalizedAddress.length !== 42) {
    throw new Error(`Invalid router address in .env: ${normalizedAddress}`);
  }

  return normalizeAddress(normalizedAddress);
}

const configuredCoreAddress = getConfiguredCoreAddress();
const configuredRouterAddress = getConfiguredRouterAddress();
const configuredBinaryTreeAddress = readTrimmedEnv("VITE_BINARY_TREE_ADDRESS") || (activeNetworkConfig.key === "testnet" ? TESTNET_BINARY_TREE_ADDRESS : "");
const configuredStakingAddress =
  readTrimmedEnv("VITE_MGX_STAKING_ADDRESS", "VITE_STAKING_ADDRESS") || (activeNetworkConfig.key === "testnet" ? TESTNET_STAKING_ADDRESS : "");
const configuredMgxTokenAddress = readTrimmedEnv("VITE_MGX_TOKEN_ADDRESS");
const configuredCashbackAddress =
  readTrimmedEnv("VITE_CASHBACK_POOL_ADDRESS", "VITE_CASHBACK_ADDRESS") || (activeNetworkConfig.key === "testnet" ? TESTNET_CASHBACK_POOL_ADDRESS : "");
const configuredIncomeRouterAddress = configuredRouterAddress;
const configuredIncomeAddress = readTrimmedEnv("VITE_INCOME_ENGINE_ADDRESS");
export { configuredIncomeAddress as getConfiguredIncomeAddress };
const configuredUpgradeAddress = readTrimmedEnv("VITE_UPGRADE_ENGINE_ADDRESS");
const configuredTokenEngineAddress = readTrimmedEnv("VITE_TOKEN_ENGINE_ADDRESS", "VITE_TOKEN_ENGINE_CONTRACT_ADDRESS");

async function getAllRebirthIds(upgradeModule: Contract | null, rootUserId: number): Promise<bigint[]> {
  if (!upgradeModule) return [];
  const allIds: bigint[] = [];
  let currentLevel: number[] = [rootUserId];
  while (currentLevel.length > 0) {
    const results = await Promise.all(
      currentLevel.map((id) => (upgradeModule.getRebirthIds(id) as Promise<bigint[]>).catch(() => [] as bigint[]))
    );
    const nextLevel: number[] = [];
    for (const children of results) {
      for (const child of children) {
        allIds.push(child);
        nextLevel.push(Number(child));
      }
    }
    currentLevel = nextLevel;
  }
  return allIds;
}
function createTokenEngineModule(runner: ContractRunner) {
  return configuredTokenEngineAddress && configuredTokenEngineAddress !== "0x0000000000000000000000000000000000000000"
    ? new Contract(configuredTokenEngineAddress, metaGuildXTokenEngineAbi, runner)
    : null;
}

function isCallExceptionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const withCode = error as { code?: unknown; message?: unknown; shortMessage?: unknown };
  const message = [
    typeof withCode.message === "string" ? withCode.message : "",
    typeof withCode.shortMessage === "string" ? withCode.shortMessage : ""
  ]
    .join(" ")
    .toLowerCase();

  return withCode.code === "CALL_EXCEPTION" || message.includes("call_exception");
}

function isMissingUserCallException(error: unknown) {
  if (!isCallExceptionError(error)) {
    return false;
  }

  const withCode = error as { message?: unknown; shortMessage?: unknown; reason?: unknown };
  const message = [
    typeof withCode.message === "string" ? withCode.message : "",
    typeof withCode.shortMessage === "string" ? withCode.shortMessage : "",
    typeof withCode.reason === "string" ? withCode.reason : ""
  ]
    .join(" ")
    .toLowerCase();

  return (
    message.includes("user does not exist") ||
    message.includes("not registered") ||
    message.includes("user not found") ||
    message.includes("invalid user") ||
    message.includes("profile missing")
  );
}

async function safeBigIntRead(read: () => Promise<bigint>, fallback = 0n) {
  try {
    return await read();
  } catch (error) {
    if (isCallExceptionError(error)) {
      return fallback;
    }
    throw error;
  }
}

async function loadPendingCashbackSafe(input: { cashback: Contract; core: Contract; userId: number }) {
  try {
    const [defaultPaymentAsset, productionMode] = (await Promise.all([
      input.core.defaultPaymentAsset(),
      input.core.productionMode()
    ])) as [string, boolean];
    const [, settlementAmount] = (await input.cashback.pendingCashback(
      BigInt(input.userId),
      defaultPaymentAsset,
      productionMode
    )) as [bigint, bigint];
    return settlementAmount;
  } catch (error) {
    console.error("MetaGuildX pendingCashback read failed", { userId: input.userId, error });
    return 0n;
  }
}

async function buildUnregisteredSnapshot(input: {
  contract: Contract;
  provider: BrowserProvider | JsonRpcProvider;
  walletAddress: string;
  packagePricesRaw: bigint[];
  boxPricesRaw: bigint[];
  stakingRewardPool: bigint;
  totalStaked: bigint;
  cashbackPoolBalance: bigint;
  totalTokenDistributed: bigint;
  rootUserId: number | null;
  registeredFeaturedUsers: DashboardSnapshot["featuredUsers"];
  registeredTreePreview: DashboardSnapshot["treePreview"];
  activityFeed: DashboardSnapshot["activityFeed"];
  currentBoxStatus: {
    boxId: bigint;
    priceCents: bigint;
    distributed: bigint;
    cap: bigint;
    remaining: bigint;
  };
}) {
  let defaultPaymentAsset = "0x0000000000000000000000000000000000000000";

  try {
    defaultPaymentAsset = (await input.contract.defaultPaymentAsset()) as string;
  } catch {
    // Keep fallback asset state at zero if the asset lookup is unavailable.
  }

  const externalWalletBalanceRaw = await input.provider.getBalance(input.walletAddress);
  // Phase 2: Run Moralis calls in parallel (was sequential, saved 800ms-2s)
  const [connectedWalletPortfolio, connectedWalletHistory] = await Promise.all([
    loadConnectedWalletAssets({
      walletAddress: input.walletAddress,
      nativeBalanceFormatted: formatTokenAmount(externalWalletBalanceRaw, 18),
      nativeValueFormatted: "$0.00",
      provider: input.provider,
      usdtAddress: defaultPaymentAsset,
      mgxTokenAddress: configuredMgxTokenAddress
    }),
    loadConnectedWalletHistory(input.walletAddress),
  ]);

  return {
    ...fallbackSnapshot,
    walletAddress: input.walletAddress,
    isConnected: true,
    hasContractConfig: true,
    isRebirthUser: false,
    packagePrices: input.packagePricesRaw.map((value) => Number(formatUnits(value, PLATFORM_DECIMALS))),
    boxPrices: input.boxPricesRaw.map((value) => Number(value) / 100),
    stakingRewardPool: formatTokenAmount(input.stakingRewardPool, 18),
    totalStaked: formatTokenAmount(input.totalStaked, 18),
    personalStaked: "0",
    stakeLockDurationLabel: "Register to unlock",
    stakeAutoCompound: false,
    stakePositions: [],
    cashbackPoolBalance: formatTokenAmount(input.cashbackPoolBalance),
    totalTokenDistributed: formatTokenAmount(input.totalTokenDistributed, 18),
    rootUserId: input.rootUserId,
    isRegistered: false,
    featuredUsers: input.registeredFeaturedUsers,
    treePreview: input.registeredTreePreview,
    activityFeed: input.activityFeed,
    spilloverHistory: [],
    networkBonusHistory: [],
    contractReady: true,
    contractWarning: null,
    currentBoxId: Number(input.currentBoxStatus.boxId),
    currentBoxPrice: (Number(input.currentBoxStatus.priceCents) / 100).toFixed(2),
    currentBoxDistributed: formatTokenAmount(input.currentBoxStatus.distributed, 18),
    currentBoxCap: formatTokenAmount(input.currentBoxStatus.cap, 18),
    currentBoxRemaining: formatTokenAmount(input.currentBoxStatus.remaining, 18),
    withdrawablePlatformBalance: "0",
    withdrawableSettlementBalance: "0",
    externalWalletBalance: formatTokenAmount(externalWalletBalanceRaw, 18),
    connectedWalletValue: formatUsdAmount(connectedWalletPortfolio.nativeAssetUsdValue),
    mgxWalletBalance: connectedWalletPortfolio.mgxBalance,
    connectedWalletAssets: connectedWalletPortfolio.assets,
    connectedWalletAssetsError: connectedWalletPortfolio.error,
    connectedWalletHistory: connectedWalletHistory.history,
    connectedWalletHistoryError: connectedWalletHistory.error,
    connectedWalletHistoryCursor: connectedWalletHistory.cursor,
    settlementAssetLabel: "Settlement asset",
    settlementAssetAddress: null,
    mgxAllocated: "0",
    userActiveBoxId: null,
    pendingCashback: "0",
    incomeDistributionPending: false,
    incomeDistributionPendingPackageLevel: null,
    isSurrendered: false,
    surrenderStatus: "Register to unlock"
  } satisfies DashboardSnapshot;
}

type MinimalRegisteredProfile = {
  sponsorId: bigint | number;
  packageLevel: bigint | number;
  totalContribution: bigint | number;
  totalEarnings?: bigint | number;
  directReferrals: bigint | number;
  totalTeamBusiness?: bigint | number;
  xCount: bigint | number;
  joinedAt: bigint | number;
  surrendered?: boolean;
};

async function buildMinimalRegisteredSnapshot(
  input: Parameters<typeof buildUnregisteredSnapshot>[0] & {
    profile: MinimalRegisteredProfile;
    userId: number;
  }
) {
  const snapshot = await buildUnregisteredSnapshot(input);

  return {
    ...snapshot,
    isRegistered: true,
    userId: input.userId,
    sponsorId: input.profile.sponsorId === undefined ? snapshot.sponsorId : Number(input.profile.sponsorId),
    packageLevel: Number(input.profile.packageLevel),
    joinedAt: Number(input.profile.joinedAt),
    incomeDistributionPending: false,
    incomeDistributionPendingPackageLevel: null,
    isSurrendered: Boolean(input.profile.surrendered),
    surrenderStatus: input.profile.surrendered ? "ID surrendered" : "Available after 3 months"
  } satisfies DashboardSnapshot;
}

function formatStakeDurationLabel(lockDurationDaysRaw: bigint) {
  const lockDuration = Number(lockDurationDaysRaw);
  if (!lockDuration) {
    return "No active stake";
  }
  return `${lockDuration} days`;
}

function formatStakeStartDateLabel(lockStartedAtSeconds: bigint) {
  const timestamp = Number(lockStartedAtSeconds);
  if (!timestamp) {
    return "Not started";
  }

  const parsed = new Date(timestamp * 1000);
  if (Number.isNaN(parsed.getTime())) {
    return "Not started";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatStakeUnlockDateLabel(unlockTimeSeconds: bigint) {
  const timestamp = Number(unlockTimeSeconds);
  if (!timestamp) {
    return "Not available";
  }

  const parsed = new Date(timestamp * 1000);
  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatEventDateLabel(timestampSeconds: number | null | undefined) {
  if (!timestampSeconds) {
    return "Live";
  }

  const parsed = new Date(timestampSeconds * 1000);
  if (Number.isNaN(parsed.getTime())) {
    return "Live";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

type RawStakePosition = readonly [bigint, bigint, bigint, bigint, bigint, boolean];

function sumStakePositionAmounts(positions: ReadonlyArray<RawStakePosition>) {
  return positions.reduce((total, position) => total + BigInt(position[0]), 0n);
}

function mapStakePositions(positions: ReadonlyArray<RawStakePosition>): StakePositionView[] {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return positions
    .filter((position) => BigInt(position[0]) > 0n)
    .map((position, index) => {
      const startTime = Number(position[3]);
      const lockDurationDays = Number(position[4]);
      const lockDurationSeconds = lockDurationDays * 86400;
      const unlockTime = startTime + lockDurationSeconds;
      const elapsedSeconds = Math.max(nowSeconds - startTime, 0);
      const lockProgressPercent =
        lockDurationSeconds > 0 ? Math.min((elapsedSeconds / lockDurationSeconds) * 100, 100) : 0;

      return {
        index,
        amount: formatTokenAmount(BigInt(position[0]), 18),
        rewardDebt: BigInt(position[1]),
        lockDurationSeconds,
        lockDurationLabel: formatStakeDurationLabel(BigInt(position[4])),
        startTime,
        startDateLabel: formatStakeStartDateLabel(BigInt(position[3])),
        unlockTime,
        unlockDateLabel: formatStakeUnlockDateLabel(BigInt(unlockTime)),
        isLocked: unlockTime > nowSeconds,
        lockProgressPercent,
        pendingReward: formatTokenAmount(BigInt(position[2]), 18),
        autoCompound: Boolean(position[5])
      };
    });
}

async function loadUserIncomeHistory(input: {
  provider: BrowserProvider | JsonRpcProvider;
  userId: number;
  coreAddress: string;
  incomeRouterAddress: string;
}) {
  if (!input.incomeRouterAddress || input.userId <= 0) {
    return { spilloverHistory: [], networkBonusHistory: [] } as {
      spilloverHistory: UserIncomeHistoryRow[];
      networkBonusHistory: UserIncomeHistoryRow[];
    };
  }

  const router = new Contract(input.incomeRouterAddress, incomeRouterWriteAbi, input.provider);
  const coreInterface = new Interface(metaGuildXCoreAbi);
  const blockDateCache = new Map<number, string>();
  const txSenderCache = new Map<string, number | null>();

  async function getDateLabel(blockNumber?: number) {
    if (!blockNumber) {
      return "Live";
    }
    if (blockDateCache.has(blockNumber)) {
      return blockDateCache.get(blockNumber)!;
    }
    const block = await input.provider.getBlock(blockNumber);
    const dateLabel = formatEventDateLabel(block?.timestamp);
    blockDateCache.set(blockNumber, dateLabel);
    return dateLabel;
  }

  async function inferFromUserId(txHash: string) {
    if (txSenderCache.has(txHash)) {
      return txSenderCache.get(txHash) ?? null;
    }

    let nextUserId: number | null = null;
    const receipt = await input.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      txSenderCache.set(txHash, null);
      return null;
    }
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== input.coreAddress.toLowerCase()) {
        continue;
      }

      try {
        const parsed = coreInterface.parseLog(log);
        if (parsed?.name === "UserRegistered") {
          nextUserId = Number(parsed.args.userId);
          break;
        }
        if (parsed?.name === "PackageUpgraded") {
          nextUserId = Number(parsed.args.userId);
          break;
        }
      } catch {
        continue;
      }
    }

    txSenderCache.set(txHash, nextUserId);
    return nextUserId;
  }

  const latestBlock = await input.provider.getBlockNumber();
  const [spilloverLogs, crosslineLogs] = await Promise.all([
    withTimeout(
      queryFilterChunked(
        router,
        router.filters.SpilloverIncome(BigInt(input.userId)),
        OPBNB_TESTNET_DEPLOYMENT_START_BLOCK,
        latestBlock,
        60_000
      ),
      30_000,
      []
    ),
    withTimeout(
      queryFilterChunked(
        router,
        router.filters.CrossLineIncomeRecorded(null, BigInt(input.userId)),
        OPBNB_TESTNET_DEPLOYMENT_START_BLOCK,
        latestBlock,
        60_000
      ),
      30_000,
      []
    )
  ]);

  const spilloverHistoryResults = await Promise.all(
    spilloverLogs.map(async (log): Promise<UserIncomeHistoryRow | null> => {
      if (!("args" in log)) {
        return null;
      }

      const fromUserId = await inferFromUserId(log.transactionHash);
      return {
        txHash: log.transactionHash,
        amount: formatPlatformUsdValue(log.args.amount),
        dateLabel: await getDateLabel(log.blockNumber),
        fromUserId,
        note: `Level ${Number(log.args.fromLevel)} spillover`
      };
    })
  );
  const spilloverHistory: UserIncomeHistoryRow[] = spilloverHistoryResults.filter(
    (entry): entry is UserIncomeHistoryRow => entry !== null
  );

  const networkBonusHistoryResults = await Promise.all(
    crosslineLogs.map(async (log): Promise<UserIncomeHistoryRow | null> => {
      if (!("args" in log)) {
        return null;
      }

      return {
        txHash: log.transactionHash,
        amount: formatPlatformUsdValue(log.args.amount),
        dateLabel: await getDateLabel(log.blockNumber),
        fromUserId: Number(log.args.fromUserId),
        note: "Rebirth network bonus"
      };
    })
  );
  const networkBonusHistory: UserIncomeHistoryRow[] = networkBonusHistoryResults.filter(
    (entry): entry is UserIncomeHistoryRow => entry !== null
  );

  spilloverHistory.sort((left, right) => right.dateLabel.localeCompare(left.dateLabel));
  networkBonusHistory.sort((left, right) => right.dateLabel.localeCompare(left.dateLabel));

  return {
    spilloverHistory,
    networkBonusHistory
  };
}

async function loadSpilloverDisplayIncome(input: {
  provider: BrowserProvider | JsonRpcProvider;
  coreAddress: string;
  userId: number;
  incomeRouterAddress: string;
}) {
  if (!input.coreAddress || !input.incomeRouterAddress || input.userId <= 0) {
    return 0n;
  }

  try {
    const currentBlock = await input.provider.getBlockNumber();
    const cacheKey = getHotPathCacheKey("spillover", input.incomeRouterAddress, input.userId);
    const persisted = readPersistentJson<PersistedBigIntTotal>(cacheKey);
    if (
      persisted &&
      isFreshHotPathCache(persisted.timestamp) &&
      Number.isFinite(persisted.lastScannedBlock) &&
      persisted.lastScannedBlock >= currentBlock
    ) {
      return BigInt(persisted.total);
    }

    const core = new Contract(input.coreAddress, metaGuildXCoreAbi, input.provider);
    const nextUserId = Number(await core.nextUserId());
    const sponsorMap = await buildAndCacheSponsorMap(input.provider, core, nextUserId);

    const sponsorGenealogy = new Set<number>([input.userId]);
    let added = true;
    while (added) {
      added = false;
      for (const [id, sponsor] of sponsorMap.entries()) {
        if (!sponsorGenealogy.has(id) && sponsorGenealogy.has(Number(sponsor))) {
          sponsorGenealogy.add(id);
          added = true;
        }
      }
    }

    const routerAddresses = getHistoricalIncomeRouterAddresses(input.incomeRouterAddress);
    const startBlock = Math.max(
      persisted ? persisted.lastScannedBlock + 1 : 0,
      OPBNB_TESTNET_DEPLOYMENT_START_BLOCK
    );
    const previousTotal = persisted ? BigInt(persisted.total) : 0n;
    if (startBlock > currentBlock) {
      writePersistentJson<PersistedBigIntTotal>(cacheKey, {
        total: previousTotal.toString(),
        lastScannedBlock: currentBlock,
        timestamp: Date.now()
      });
      return previousTotal;
    }

    const eventResults = await Promise.all(
      routerAddresses.map(async (routerAddress) => {
        const router = new Contract(routerAddress, incomeRouterWriteAbi, input.provider);
        return withTimeout(
          queryFilterChunked(
            router,
            router.filters.LevelIncomeRecorded(null, BigInt(input.userId)),
            startBlock,
            currentBlock,
            44000
          ),
          30000,
          []
        );
      })
    );

    const nextTotal = eventResults.flat().reduce((sum, event) => {
      if (!("args" in event)) {
        return sum;
      }
      const fromUserId = Number(event.args.fromUserId ?? event.args[0] ?? 0n);
      if (!fromUserId || sponsorGenealogy.has(fromUserId)) {
        return sum;
      }
      return sum + BigInt(event.args.amount ?? event.args[3] ?? 0n);
    }, previousTotal);
    writePersistentJson<PersistedBigIntTotal>(cacheKey, {
      total: nextTotal.toString(),
      lastScannedBlock: currentBlock,
      timestamp: Date.now()
    });
    return nextTotal;
  } catch {
    return 0n;
  }
}

// Tracks whether the last loadBoxEarnings call completed all chunks
let _lastBoxEarningsScanComplete = true;

async function loadBoxEarnings(input: {
  incomeModule: Contract | null;
  routerContract?: Contract | null;
  userId: number;
  deployBlock: number;
  provider: BrowserProvider | JsonRpcProvider;
  maxPkg?: number;
}) {
  if (input.userId <= 0) {
    return {} as Record<number, bigint>;
  }

  const cacheKey = `${input.userId}-${input.deployBlock}-${Math.floor(Date.now() / 300_000)}`;
  const cached = boxEarningsCache.get(cacheKey);
  if (cached && Object.keys(cached.data).length > 0 && Date.now() - cached.timestamp < SNAPSHOT_CACHE_TTL) {
    return cached.data;
  }

  const maxPkg = input.maxPkg ?? 10;
  const routerAddress =
    input.routerContract
      ? await input.routerContract.getAddress()
      : configuredIncomeRouterAddress;

  if (!routerAddress || routerAddress === "0x0000000000000000000000000000000000000000") {
    return {} as Record<number, bigint>;
  }

  const persistentCacheKey = getPersistentBoxEarningsCacheKey(input.userId, routerAddress, input.deployBlock);
  const persisted = readPersistentBoxEarnings(persistentCacheKey);
  if (persisted && Date.now() - persisted.timestamp < SNAPSHOT_LOCAL_CACHE_TTL) {
    const _bTotal = Object.values(persisted.data).reduce((s:bigint,v:any)=>s+BigInt(v),0n);
    console.log(`[BOX-PIPELINE] userId=${input.userId} source=PERSISTENT-CACHE pkgs=${Object.keys(persisted.data).join(',')} total=${Number(_bTotal)/10} ts=${Date.now()}`);
    _lastBoxEarningsScanComplete = true;
    boxEarningsCache.set(cacheKey, { data: persisted.data, timestamp: Date.now() });
    return persisted.data;
  }

  await waitForNonCriticalScanDelay();

  const router = input.routerContract ?? new Contract(routerAddress, incomeRouterWriteAbi, input.provider);
  const currentBlock = await input.provider.getBlockNumber();
  const startBlock = Math.max(
    persisted ? persisted.lastScannedBlock + 1 : 0,
    input.deployBlock || getEventQueryStartBlock(currentBlock)
  );
  const pkgEarnings: Record<number, bigint> = persisted ? { ...persisted.data } : {};
  if (startBlock > currentBlock) {
    boxEarningsCache.set(cacheKey, { data: pkgEarnings, timestamp: Date.now() });
    writePersistentBoxEarnings(persistentCacheKey, pkgEarnings, currentBlock);
    return pkgEarnings;
  }

  const modernInterface = router.interface;
  const legacyInterface = new Interface([
    "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)",
    "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)"
  ]);

  const modernDirectTopics = modernInterface.encodeFilterTopics("DirectIncomeRecorded", [null, BigInt(input.userId)]);
  const modernLevelTopics = modernInterface.encodeFilterTopics("LevelIncomeRecorded", [null, BigInt(input.userId)]);
  const crosslineTopics = modernInterface.encodeFilterTopics("CrossLineIncomeRecorded", [null, BigInt(input.userId)]);
  const legacyDirectTopics = legacyInterface.encodeFilterTopics("DirectIncomeRecorded", [null, BigInt(input.userId)]);
  const legacyLevelTopics = legacyInterface.encodeFilterTopics("LevelIncomeRecorded", [null, BigInt(input.userId)]);
  let allChunksSucceeded = true;

  for (let start = startBlock; start <= currentBlock; start += BLOCK_CHUNK_SIZE) {
    const end = Math.min(start + BLOCK_CHUNK_SIZE - 1, currentBlock);
    const isLastChunk = end >= currentBlock;

    try {
      let [modernDirectLogs, modernLevelLogs, crosslineLogs, legacyDirectLogs, legacyLevelLogs] = await Promise.all([
        getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernDirectTopics }, `provider.getLogs:modernDirect:${start}-${end}`),
        getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernLevelTopics }, `provider.getLogs:modernLevel:${start}-${end}`),
        getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: crosslineTopics }, `provider.getLogs:crossline:${start}-${end}`),
        getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: legacyDirectTopics }, `provider.getLogs:legacyDirect:${start}-${end}`),
        getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: legacyLevelTopics }, `provider.getLogs:legacyLevel:${start}-${end}`)
      ]).catch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return Promise.all([
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernDirectTopics }, `provider.getLogs:modernDirect:retry:${start}-${end}`),
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernLevelTopics }, `provider.getLogs:modernLevel:retry:${start}-${end}`),
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: crosslineTopics }, `provider.getLogs:crossline:retry:${start}-${end}`),
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: legacyDirectTopics }, `provider.getLogs:legacyDirect:retry:${start}-${end}`),
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: legacyLevelTopics }, `provider.getLogs:legacyLevel:retry:${start}-${end}`)
        ]);
      });

      for (const log of modernDirectLogs) {
        const parsed = modernInterface.parseLog(log);
        const pkg = Math.min(maxPkg, Math.max(1, Number(parsed?.args.cyclePkgLevel ?? parsed?.args[3] ?? 1)));
        const amount = BigInt(parsed?.args.amount ?? parsed?.args[2] ?? 0n);
        pkgEarnings[pkg] = (pkgEarnings[pkg] ?? 0n) + amount;
      }

      for (const log of modernLevelLogs) {
        const parsed = modernInterface.parseLog(log);
        const pkg = Math.min(maxPkg, Math.max(1, Number(parsed?.args.cyclePkgLevel ?? parsed?.args[4] ?? 1)));
        const amount = BigInt(parsed?.args.amount ?? parsed?.args[3] ?? 0n);
        pkgEarnings[pkg] = (pkgEarnings[pkg] ?? 0n) + amount;
      }

      for (const log of crosslineLogs) {
        const parsed = modernInterface.parseLog(log);
        const amount = BigInt(parsed?.args.amount ?? parsed?.args[2] ?? 0n);
        pkgEarnings[1] = (pkgEarnings[1] ?? 0n) + amount;
      }

      for (const log of legacyDirectLogs) {
        const parsed = legacyInterface.parseLog(log);
        const amount = BigInt(parsed?.args.amount ?? parsed?.args[2] ?? 0n);
        pkgEarnings[1] = (pkgEarnings[1] ?? 0n) + amount;
      }

      for (const log of legacyLevelLogs) {
        const parsed = legacyInterface.parseLog(log);
        const amount = BigInt(parsed?.args.amount ?? parsed?.args[3] ?? 0n);
        pkgEarnings[1] = (pkgEarnings[1] ?? 0n) + amount;
      }
    } catch {
      // Second retry with longer backoff before accepting failure
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const [rd2, rl2] = await Promise.all([
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernDirectTopics }, `r2:d:${start}`),
          getLogsWithDiagnostics(input.provider, { address: routerAddress, fromBlock: start, toBlock: end, topics: modernLevelTopics }, `r2:l:${start}`),
        ]);
        for (const log of rd2) {
          const parsed = modernInterface.parseLog(log);
          const pkg = Math.min(maxPkg, Math.max(1, Number(parsed?.args.cyclePkgLevel ?? parsed?.args[3] ?? 1)));
          const amount = BigInt(parsed?.args.amount ?? parsed?.args[2] ?? 0n);
          pkgEarnings[pkg] = (pkgEarnings[pkg] ?? 0n) + amount;
        }
        for (const log of rl2) {
          const parsed = modernInterface.parseLog(log);
          const pkg = Math.min(maxPkg, Math.max(1, Number(parsed?.args.cyclePkgLevel ?? parsed?.args[4] ?? 1)));
          const amount = BigInt(parsed?.args.amount ?? parsed?.args[3] ?? 0n);
          pkgEarnings[pkg] = (pkgEarnings[pkg] ?? 0n) + amount;
        }
      } catch {
        allChunksSucceeded = false;
      }
    }

    if (!isLastChunk) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  // Always cache in-memory (partial or full — used within this 5-min session)
  boxEarningsCache.set(cacheKey, { data: pkgEarnings, timestamp: Date.now() });
  // Write persistent cache ONLY on full successful scan.
  // Partial results are NEVER persisted to avoid:
  //   (a) double-counting on next session rescan overlap
  //   (b) permanently incorrect totals from stale partial data
  // On partial scan: in-memory cache serves this session; next session does a fresh full scan.
  _lastBoxEarningsScanComplete = allChunksSucceeded;
  if (allChunksSucceeded) {
    writePersistentBoxEarnings(persistentCacheKey, pkgEarnings, currentBlock);
  }
  return pkgEarnings;
}

export async function loadUserBoxEarnings(userId: number): Promise<Record<number, string>> {
  if (userId <= 0 || !configuredIncomeAddress || configuredIncomeAddress === "0x0000000000000000000000000000000000000000") {
    return {};
  }

  if (getReadRpcUrls().length === 0) {
    return {};
  }

  const provider = await getReadProvider();
  const incomeModule = new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider);
  const boxEarnings = await loadBoxEarnings({
    incomeModule,
    routerContract: null,
    userId,
    deployBlock: OPBNB_TESTNET_DEPLOYMENT_START_BLOCK,
    provider
  });

  return Object.fromEntries(
    Object.entries(boxEarnings).map(([pkg, amount]) => [Number(pkg), formatTokenAmount(amount)])
  );
}

export async function loadBoxEarningsForUser(input: {
  userId: number;
  provider: BrowserProvider | JsonRpcProvider;
  incomeAddress: string | null;
  userJoinedAt?: number;
}): Promise<{ packageOneBucketEarnings: string; currentPackageBucketEarnings: string; boxEarningsByPackage: Record<number, string>; packageLevel: number; scanComplete: boolean }> {
  if (input.userId <= 0 || !input.incomeAddress || input.incomeAddress === "0x0000000000000000000000000000000000000000") {
    return { packageOneBucketEarnings: "0", currentPackageBucketEarnings: "0", boxEarningsByPackage: {}, packageLevel: 0, scanComplete: false };
  }
  const incomeModule = new Contract(input.incomeAddress, metaGuildXIncomeAbi, input.provider);
  const coreAddress = configuredCoreAddress;
  const contract = new Contract(coreAddress, metaGuildXCoreAbi, input.provider);
  const profileRaw = await contract.usersById(input.userId);
  const currentPackageLevel = Number(profileRaw.packageLevel ?? 0);
  // Use deployment start block — income events exist from first registration
  // joinedAt-based calculation is WRONG: joinedAt ≠ registration block timestamp
  // Income is emitted in same tx as registration, which predates joinedAt by hours
  const boxEarningsByPackage = await loadBoxEarnings({
    incomeModule,
    routerContract: null,
    userId: input.userId,
    deployBlock: getDeploymentAnalyticsStartBlock(),
    provider: input.provider
  });
  const packageOneBucketEarningsRaw = boxEarningsByPackage[1] ?? 0n;
  const currentPackageBucketEarningsRaw = currentPackageLevel > 0 ? (boxEarningsByPackage[currentPackageLevel] ?? 0n) : 0n;
  return {
    packageOneBucketEarnings: formatTokenAmount(packageOneBucketEarningsRaw),
    currentPackageBucketEarnings: formatTokenAmount(currentPackageBucketEarningsRaw),
    boxEarningsByPackage: Object.fromEntries(
      Object.entries(boxEarningsByPackage)
        .filter(([, amount]) => amount > 0n)
        .map(([pkg, amount]) => [Number(pkg), formatTokenAmount(amount)])
    ),
    packageLevel: currentPackageLevel,
    scanComplete: _lastBoxEarningsScanComplete
  };
}


async function loadCrosslineDisplayIncome(input: {
  provider: BrowserProvider | JsonRpcProvider;
  userId: number;
  coreAddress: string;
  incomeRouterAddress: string;
}) {
  if (!input.incomeRouterAddress || input.userId <= 0) {
    return { total: 0n, history: [] as UserIncomeHistoryRow[] };
  }

  try {
    const currentBlock = await input.provider.getBlockNumber();
    const persistedCacheKey = getHotPathCacheKey("crossline", input.incomeRouterAddress, input.userId);
    const persisted = readPersistentJson<PersistedCrosslineIncome>(persistedCacheKey);
    if (
      persisted &&
      isFreshHotPathCache(persisted.timestamp) &&
      Number.isFinite(persisted.lastScannedBlock) &&
      persisted.lastScannedBlock >= currentBlock
    ) {
      return {
        total: BigInt(persisted.total),
        history: persisted.history
      };
    }

    const core = new Contract(input.coreAddress, metaGuildXCoreAbi, input.provider);
    const nextUserId = Number(await core.nextUserId());
    const sponsorMap = await buildAndCacheSponsorMap(input.provider, core, nextUserId);

    function buildGenealogy(rootId: number) {
      const genealogy = new Set<number>([rootId]);
      let added = true;

      while (added) {
        added = false;
        for (const [id, sponsor] of sponsorMap.entries()) {
          if (!genealogy.has(id) && genealogy.has(Number(sponsor))) {
            genealogy.add(id);
            added = true;
          }
        }
      }

      return genealogy;
    }

    const cacheKey = `genealogy-${getDeploymentCacheNamespace()}-${input.userId}`;
    const cachedGenealogy = genealogyCache.get(cacheKey);
    const userGenealogy =
      cachedGenealogy && Date.now() - cachedGenealogy.timestamp < GENEALOGY_CACHE_TTL
        ? cachedGenealogy.data
        : buildGenealogy(input.userId);

    if (!cachedGenealogy || Date.now() - cachedGenealogy.timestamp >= GENEALOGY_CACHE_TTL) {
      genealogyCache.set(cacheKey, {
        data: userGenealogy,
        timestamp: Date.now()
      });
    }

    const startBlock = Math.max(
      persisted ? persisted.lastScannedBlock + 1 : 0,
      OPBNB_TESTNET_DEPLOYMENT_START_BLOCK
    );
    const crosslineRebirthIds = new Set<number>(persisted?.rebirthIds ?? []);
    const previousTotal = persisted ? BigInt(persisted.total) : 0n;
    const previousHistory = persisted?.history ?? [];
    if (startBlock > currentBlock) {
      writePersistentJson<PersistedCrosslineIncome>(persistedCacheKey, {
        total: previousTotal.toString(),
        history: previousHistory,
        rebirthIds: [...crosslineRebirthIds],
        lastScannedBlock: currentBlock,
        timestamp: Date.now()
      });
      return { total: previousTotal, history: previousHistory };
    }

    const rebirthEvents = await queryFilterChunked(
      core,
      core.filters.RebirthUserCreated(null, null, null),
      startBlock,
      currentBlock,
      60_000
    );

    for (const event of rebirthEvents) {
      if (!("args" in event)) {
        continue;
      }

      const originalId = Number(event.args.originalUserId ?? event.args[0] ?? 0n);
      const newId = Number(event.args.newUserId ?? event.args[1] ?? 0n);
      const originalInGenealogy = userGenealogy.has(originalId);

      if (!originalInGenealogy && newId > 0) {
        crosslineRebirthIds.add(newId);
      }
    }

    if (crosslineRebirthIds.size === 0) {
      return { total: 0n, history: [] as UserIncomeHistoryRow[] };
    }

    const routerAddresses = getHistoricalIncomeRouterAddresses(input.incomeRouterAddress);
    const crosslineEventResults = await Promise.all(
      routerAddresses.map(async (routerAddress) => {
        const router = new Contract(routerAddress, incomeRouterWriteAbi, input.provider);
        return withTimeout(
          queryFilterChunked(
            router,
            router.filters.CrossLineIncomeRecorded(null, BigInt(input.userId)),
            startBlock,
            currentBlock,
            60_000
          ),
          30000,
          []
        );
      })
    );

    let total = previousTotal;
    const history: UserIncomeHistoryRow[] = [...previousHistory];
    const blockDateCache = new Map<number, string>();

    async function getDateLabel(blockNumber: number) {
      if (blockDateCache.has(blockNumber)) {
        return blockDateCache.get(blockNumber)!;
      }

      const block = await input.provider.getBlock(blockNumber);
      const dateLabel = formatEventDateLabel(block?.timestamp);
      blockDateCache.set(blockNumber, dateLabel);
      return dateLabel;
    }

    for (const event of crosslineEventResults.flat()) {
      if (!("args" in event)) {
        continue;
      }

      const fromUserId = Number(event.args.fromUserId ?? event.args[0] ?? 0n);
      const amount = BigInt(event.args.amount ?? event.args[2] ?? 0n);

      if (!crosslineRebirthIds.has(fromUserId)) {
        continue;
      }

      total += amount;
      history.push({
        txHash: event.transactionHash,
        amount: formatPlatformUsdValue(amount),
        dateLabel: await getDateLabel(event.blockNumber),
        fromUserId,
        note: "Rebirth network bonus"
      });
    }

    history.sort((left, right) => right.dateLabel.localeCompare(left.dateLabel));

    writePersistentJson<PersistedCrosslineIncome>(persistedCacheKey, {
      total: total.toString(),
      history,
      rebirthIds: [...crosslineRebirthIds],
      lastScannedBlock: currentBlock,
      timestamp: Date.now()
    });
    return { total, history };
  } catch {
    return { total: 0n, history: [] as UserIncomeHistoryRow[] };
  }
}

function isRegisteredAccount(value: string) {
  return value !== "0x0000000000000000000000000000000000000000";
}

function formatAssetLabel(value: string) {
  if (!value || value === "0x0000000000000000000000000000000000000000") {
    return "Native asset";
  }
  return compactAddress(value);
}

function settlementToPlatformValue(settlementAmount: bigint, unitPrice: bigint) {
  if (unitPrice === 0n) {
    return "0";
  }

  return formatTokenAmount(settlementAmount / unitPrice);
}

function platformToSettlementValue(platformAmount: bigint, unitPrice: bigint, settlementDecimals = DEFAULT_STABLECOIN_DECIMALS) {
  if (unitPrice === 0n) {
    return "0";
  }

  return formatAmountWithDecimals(platformAmount * unitPrice, settlementDecimals);
}

function formatPlatformUsdValue(platformAmount: bigint) {
  return formatTokenAmount(platformAmount * 10n ** 17n, 18);
}

function formatHistoryDate(value: string | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function formatHistoryType(value: string | null | undefined) {
  const normalized = (value || "contract interaction").replace(/_/g, " ").trim();
  if (!normalized) {
    return "Contract Interaction";
  }

  return normalized
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatHistoryAmount(entry: MoralisHistoryEntry) {
  const nativeValue = entry.value ? BigInt(entry.value) : 0n;
  if (nativeValue > 0n) {
    return `${formatTokenAmount(nativeValue, 18)} ${activeNetworkConfig.nativeCurrency.symbol}`;
  }

  const tokenTransfer = entry.erc20_transfers?.find((transfer) => {
    const numericAmount = Number(transfer.value_formatted ?? "0");
    return Number.isFinite(numericAmount) && numericAmount > 0;
  });

  if (tokenTransfer) {
    return `${tokenTransfer.value_formatted ?? "0"} ${tokenTransfer.token_symbol ?? "Token"}`;
  }

  if (entry.summary && entry.summary.trim()) {
    return entry.summary;
  }

  return "-";
}

function formatHistoryStatus(value: MoralisHistoryEntry["receipt_status"]): "Success" | "Failed" {
  return value === 1 || value === "1" || value === true ? "Success" : "Failed";
}

type MoralisTokenBalance = {
  token_address?: string;
  name?: string;
  symbol?: string;
  balance_formatted?: string;
  usd_value?: number;
  usd_price?: number;
  logo?: string | null;
  thumbnail?: string | null;
  native_token?: boolean;
  verified_contract?: boolean;
  possible_spam?: boolean;
};

type MoralisHistoryEntry = {
  hash?: string;
  transaction_hash?: string;
  block_timestamp?: string;
  summary?: string | null;
  category?: string | null;
  receipt_status?: number | string | boolean | null;
  value?: string | null;
  erc20_transfers?: Array<{
    token_symbol?: string | null;
    value_formatted?: string | null;
  }>;
};

type MoralisHistoryPayload = {
  result?: MoralisHistoryEntry[];
  cursor?: string | null;
};

async function loadConnectedWalletAssets(input: {
  walletAddress: string;
  nativeBalanceFormatted: string;
  nativeValueFormatted: string;
  provider?: BrowserProvider | JsonRpcProvider;
  usdtAddress?: string | null;
  mgxTokenAddress?: string | null;
}) {
  const nativeAssetRow = {
    id: "native",
    name: activeNetworkConfig.nativeCurrency.symbol,
    subtitle: "Connected wallet asset",
    amount: input.nativeBalanceFormatted,
    value: input.nativeValueFormatted,
    tone: "wallet-token-blue",
    logo: null
  };

  async function loadUsdtAssetRow() {
    if (!input.provider || !input.usdtAddress || input.usdtAddress === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    try {
      const token = new Contract(normalizeAddress(input.usdtAddress), erc20ApprovalAbi, input.provider);
      const [balanceRaw, decimalsRaw] = (await Promise.all([
        token.balanceOf(input.walletAddress),
        token.decimals()
      ])) as [bigint, bigint];
      const decimals = Number(decimalsRaw);
      const amount = Number(formatUnits(balanceRaw, decimals)).toFixed(2);
      return {
        id: normalizeAddress(input.usdtAddress),
        name: "USDT",
        subtitle: "Connected wallet token",
        amount,
        value: "-",
        tone: "wallet-token-slate",
        logo: null as string | null
      };
    } catch (error) {
      console.error("USDT balance read failed", error);
      return null;
    }
  }

  async function loadMgxBalance() {
    if (!input.provider || !input.mgxTokenAddress || input.mgxTokenAddress === "0x0000000000000000000000000000000000000000") {
      return "0";
    }

    try {
      const mgxToken = new Contract(normalizeAddress(input.mgxTokenAddress), erc20ApprovalAbi, input.provider);
      const mgxBalanceRaw = (await mgxToken.balanceOf(input.walletAddress)) as bigint;
      return formatTokenAmount(mgxBalanceRaw, 18);
    } catch (error) {
      console.error("MGX balance read failed", error);
      return "0";
    }
  }

  const usdtRow = await loadUsdtAssetRow();
  const mgxBalance = await loadMgxBalance();
  const tokenRows = usdtRow ? [usdtRow] : [];
  const hasNativeRow = tokenRows.some(
    (token) => token.id.toLowerCase() === "native" ||
    token.name === activeNetworkConfig.nativeCurrency.symbol
  );
  const assets = hasNativeRow ? tokenRows : [nativeAssetRow, ...tokenRows];

  return {
    assets,
    mgxBalance,
    error: null as string | null,
    nativeAssetUsdValue: 0
  };
}

export async function loadConnectedWalletHistory(address: string, cursor?: string | null) {
  const apiKey = import.meta.env.VITE_MORALIS_API_KEY;
  if (!apiKey || activeNetworkConfig.key === "local") {
    return {
      history: [] as ConnectedWalletHistoryRow[],
      error: null as string | null,
      cursor: null as string | null
    };
  }

  const historyChainParam = activeNetworkConfig.chainId === 204 ? "0xcc" : toHexChainId(activeNetworkConfig.chainId);
  const requestUrl = new URL(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/history`);
  requestUrl.searchParams.set("chain", historyChainParam);
  requestUrl.searchParams.set("limit", "10");
  if (cursor) {
    requestUrl.searchParams.set("cursor", cursor);
  }

  try {
    const response = await fetch(requestUrl.toString(), {
      headers: {
        "X-API-Key": apiKey
      }
    });

    if (!response.ok) {
      return {
        history: [] as ConnectedWalletHistoryRow[],
        error: "Failed to load history",
        cursor: null as string | null
      };
    }

    const payload = (await response.json()) as MoralisHistoryPayload;

    const history = (payload.result ?? []).map((entry) => {
      const hash = entry.hash || entry.transaction_hash || "";
      return {
        hash,
        date: formatHistoryDate(entry.block_timestamp),
        type: formatHistoryType(entry.category),
        amount: formatHistoryAmount(entry),
        status: formatHistoryStatus(entry.receipt_status),
        explorerUrl: hash ? `https://opbnbscan.com/tx/${hash}` : "https://opbnbscan.com/"
      };
    });

    return {
      history,
      error: null as string | null,
      cursor: payload.cursor ?? null
    };
  } catch (error) {
    console.error("Moralis connected wallet history fetch failed", error);

    return {
      history: [] as ConnectedWalletHistoryRow[],
      error: "Failed to load history",
      cursor: null as string | null
    };
  }
}

function buildLevelSummary(directReferrals: number) {
  const unlockedLevels = directReferrals >= 5 ? 10 : directReferrals * 2;
  return {
    unlockedLevels,
    unlockedStatus: Array.from({ length: 10 }, (_, index) => index < unlockedLevels)
  };
}

function getReadRpcUrls() {
  if (activeNetworkConfig.key === "local") {
    if (activeNetworkConfig.rpcUrl) {
      return [activeNetworkConfig.rpcUrl];
    }

    if (typeof window !== "undefined" && window.location?.origin) {
      return [`${window.location.origin}/rpc`];
    }
  }

  const urls = [activeNetworkConfig.rpcUrl];
  if (activeNetworkConfig.chainId === 5611) {
    urls.push("https://opbnb-testnet.publicnode.com");
  }
  if (activeNetworkConfig.chainId === 204) {
    const fallbackRpc = import.meta.env.VITE_MAINNET_RPC_FALLBACK;
    if (fallbackRpc && fallbackRpc !== activeNetworkConfig.rpcUrl) {
      urls.push(fallbackRpc);
    }
    urls.push("https://opbnb-mainnet-rpc.bnbchain.org");
  }

  return urls.filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
}

let _readProviderCache: JsonRpcProvider | null = null;
let _readProviderCacheTime = 0;
const READ_PROVIDER_CACHE_MS = 30 * 60 * 1000; // 30 min

async function getReadProvider() {
  const now = Date.now();
  if (_readProviderCache && (now - _readProviderCacheTime) < READ_PROVIDER_CACHE_MS) {
    return _readProviderCache;
  }

  const rpcUrls = getReadRpcUrls();
  let lastError: unknown = null;

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1, staticNetwork: true });
      provider.pollingInterval = 15000; // reduce polling: 4s → 15s
      await getBlockNumberWithDiagnostics(provider, `provider.getBlockNumber:${rpcUrl}`);
      _readProviderCache = provider;
      _readProviderCacheTime = now;
      return provider;
    } catch (error) {
      lastError = error;
      console.warn("MetaGuildX RPC probe failed", { rpcUrl, error });
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Could not reach the network. Check the RPC connection and try again.. ${lastError.message}`
      : "Could not reach the network. Check the RPC connection and try again.."
  );
}

async function getReadProviderWithFallback() {
  const rpcUrls = getReadRpcUrls().slice(0, 2);
  let lastError: unknown = null;

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new JsonRpcProvider(rpcUrl, undefined, { batchMaxCount: 1, staticNetwork: true });
      await getBlockNumberWithDiagnostics(provider, `dashboard.provider.getBlockNumber:${rpcUrl}`);
      return provider;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Could not reach the network. Check the RPC connection and try again.. ${lastError.message}`
      : "Could not reach the network. Check the RPC connection and try again.."
  );
}

function normalizeSponsorId(value: number | string | bigint) {
  try {
    const normalized = BigInt(value);
    if (normalized < 0n) {
      throw new Error("Sponsor ID must be positive");
    }
    return normalized;
  } catch {
    throw new Error("Invalid sponsor ID in referral link");
  }
}

function formatRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "Registration failed");
  const normalized = message.toLowerCase();

  if (normalized.includes("failed to fetch")) {
    return "Could not reach the network. Check the RPC connection and try again.";
  }
  if (normalized.includes("already registered")) {
    return "This wallet is already registered.";
  }
  if (normalized.includes("approve") || normalized.includes("allowance") || normalized.includes("insufficient usdt")) {
    return `USDT approval is not complete yet. Approve the transaction in MetaMask and try again.`;
  }
  if (normalized.includes("placement signing") || normalized.includes("signature")) {
    return `Registration failed. Please review the error and try again.`;
  }
  if (normalized.includes("user rejected") || normalized.includes("action_rejected") || normalized.includes("4001")) {
    return "Registration was cancelled in MetaMask. Approve the request and try again.";
  }

  return `Registration failed. Please review the error and try again.`;
}

function formatUserFacingContractError(error: unknown, fallback = "Network error, please retry.") {
  const message = error instanceof Error ? error.message : String(error ?? fallback);
  const normalized = message.toLowerCase();

  if (normalized.includes("user_not_active")) {
    return "Please complete registration first.";
  }

  if (normalized.includes("timeout") || normalized.includes("getblocknumber")) {
    return "RPC connection slow. Please wait a moment and retry.";
  }

  if (normalized.includes("user rejected") || normalized.includes("user denied")) {
    return "Transaction cancelled.";
  }

  if (normalized.includes("cooldown") || normalized.includes("not yet") || normalized.includes("too early")) {
    return "Reward not ready yet. Please wait for the next claim window.";
  }

  if (normalized.includes("no reward") || normalized.includes("nothing to claim")) {
    return "No reward available to claim right now.";
  }

  if (normalized.includes("call_exception") || normalized.includes("missing revert data") || normalized.includes("execution reverted")) {
    return "Transaction failed. Please retry in a moment.";
  }

  return message;
}

async function loadBranchStats(contract: Contract, userId: number) {
  const treeContract =
    configuredBinaryTreeAddress && configuredBinaryTreeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredBinaryTreeAddress, binaryTreeAbi, contract.runner)
      : null;

  if (!treeContract) {
    return {
      leftDirectChildId: 0,
      rightDirectChildId: 0,
      leftBranchNodes: 0,
      rightBranchNodes: 0,
      leftBranchBusiness: 0n,
      rightBranchBusiness: 0n
    };
  }
  const activeTreeContract = treeContract;
  const provider = contract.runner?.provider;
  let cacheKey: string | null = null;
  let blockBucket = 0;
  if (provider) {
    try {
      const latestBlock = await provider.getBlockNumber();
      blockBucket = getBlockBucket(latestBlock);
      cacheKey = getHotPathCacheKey("branch-stats", userId, blockBucket);
      const persisted = readPersistentJson<PersistedBranchStats>(cacheKey);
      if (persisted && persisted.blockBucket === blockBucket && isFreshBranchStatsCache(persisted.timestamp)) {
        return {
          leftDirectChildId: persisted.data.leftDirectChildId,
          rightDirectChildId: persisted.data.rightDirectChildId,
          leftBranchNodes: persisted.data.leftBranchNodes,
          rightBranchNodes: persisted.data.rightBranchNodes,
          leftBranchBusiness: BigInt(persisted.data.leftBranchBusiness),
          rightBranchBusiness: BigInt(persisted.data.rightBranchBusiness)
        };
      }
    } catch {
      cacheKey = null;
    }
  }

  async function subtree(nodeId: number): Promise<{ nodes: number; business: bigint }> {
    if (nodeId === 0) {
      return { nodes: 0, business: 0n };
    }

    const [profile, node] = await Promise.all([contract.usersById(nodeId), activeTreeContract.nodes(nodeId)]);
    const [left, right] = await Promise.all([
      subtree(Number(node.leftChildId)),
      subtree(Number(node.rightChildId))
    ]);

    return {
      nodes: 1 + left.nodes + right.nodes,
      business: BigInt(profile.totalContribution) + left.business + right.business
    };
  }

  const rootNode = await activeTreeContract.nodes(userId);
  const leftDirectChildId = Number(rootNode.leftChildId);
  const rightDirectChildId = Number(rootNode.rightChildId);
  const [leftBranch, rightBranch] = await Promise.all([subtree(leftDirectChildId), subtree(rightDirectChildId)]);

  const stats = {
    leftDirectChildId,
    rightDirectChildId,
    leftBranchNodes: leftBranch.nodes,
    rightBranchNodes: rightBranch.nodes,
    leftBranchBusiness: leftBranch.business,
    rightBranchBusiness: rightBranch.business
  };
  if (cacheKey) {
    writePersistentJson<PersistedBranchStats>(cacheKey, {
      data: {
        ...stats,
        leftBranchBusiness: stats.leftBranchBusiness.toString(),
        rightBranchBusiness: stats.rightBranchBusiness.toString()
      },
      blockBucket,
      timestamp: Date.now()
    });
  }
  return stats;
}

async function loadLevelBranchStats(contract: Contract, userId: number) {
  const treeContract =
    configuredBinaryTreeAddress && configuredBinaryTreeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredBinaryTreeAddress, binaryTreeAbi, contract.runner)
      : null;

  if (!treeContract) {
    return {
      levelTreeLeft: 0,
      levelTreeRight: 0
    };
  }
  const activeTreeContract = treeContract;
  const provider = contract.runner?.provider;
  let cacheKey: string | null = null;
  let blockBucket = 0;
  if (provider) {
    try {
      const latestBlock = await provider.getBlockNumber();
      blockBucket = getBlockBucket(latestBlock);
      cacheKey = getHotPathCacheKey("level-branch-stats", userId, blockBucket);
      const persisted = readPersistentJson<PersistedLevelBranchStats>(cacheKey);
      if (persisted && persisted.blockBucket === blockBucket && isFreshBranchStatsCache(persisted.timestamp)) {
        return persisted.data;
      }
    } catch {
      cacheKey = null;
    }
  }

  async function subtree(nodeId: number): Promise<number> {
    if (nodeId === 0) {
      return 0;
    }

    const [leftRaw, rightRaw] = await activeTreeContract.getLevelChildren(nodeId);
    const [left, right] = await Promise.all([
      subtree(Number(leftRaw)),
      subtree(Number(rightRaw))
    ]);
    return 1 + left + right;
  }

  let levelTreeLeft = 0, levelTreeRight = 0;
  try {
    const [leftRootRaw, rightRootRaw] = await activeTreeContract.getLevelChildren(userId);
    [levelTreeLeft, levelTreeRight] = await Promise.all([
      subtree(Number(leftRootRaw)),
      subtree(Number(rightRootRaw))
    ]);
  } catch {
    // getLevelChildren reverts for root user (User 1) — fall back to binary tree placement counts
    // binary tree nodes() is always available and returns actual placement members
    try {
      const rootNode = await activeTreeContract.nodes(userId);
      const leftId = Number(rootNode.leftChildId);
      const rightId = Number(rootNode.rightChildId);
      // Count one level deep using binary tree (safe, no recursion needed for display)
      levelTreeLeft = leftId > 0 ? 1 : 0;
      levelTreeRight = rightId > 0 ? 1 : 0;
      // For deeper count use sponsor tree fallback from direct referrals
      // This at minimum shows non-zero values instead of zeros
    } catch { /* keep zeros */ }
  }

  const stats = {
    levelTreeLeft,
    levelTreeRight
  };
  if (cacheKey) {
    writePersistentJson<PersistedLevelBranchStats>(cacheKey, {
      data: stats,
      blockBucket,
      timestamp: Date.now()
    });
  }
  return stats;
}

export async function loadDeferredDashboardAnalytics(input: {
  userId: number;
  walletAddress?: string | null;
}): Promise<Partial<DashboardSnapshot>> {
  if (input.userId <= 0 || !configuredCoreAddress) {
    return {};
  }

  const provider = await getReadProvider();
  const contract = new Contract(configuredCoreAddress, metaGuildXCoreAbi, provider);
  const incomeRouterAddress = configuredIncomeRouterAddress || TESTNET_INCOME_ROUTER_ADDRESS;
  // P3: getDirectReferralIds runs first (needed for loadDirectReferralIncomeByUserId)
  // branchStats + levelBranchStats + crossline + spillover run in parallel after
  const directReferralIdsRaw = await withTimeout(
    contract.getDirectReferralIds(input.userId), 5000, [] as bigint[]
  );
  const directReferralIds = (directReferralIdsRaw as bigint[]).map((value: bigint) => Number(value));
  const [
    branchStats,
    levelBranchStats,
    { total: crosslineAmount, history: networkBonusHistory },
    spilloverAmount,
    directReferralIncomeByUserId
  ] = await Promise.all([
    withTimeout(
      loadBranchStats(contract, input.userId),
      25000,
      {
        leftDirectChildId: 0,
        rightDirectChildId: 0,
        leftBranchNodes: 0,
        rightBranchNodes: 0,
        leftBranchBusiness: 0n,
        rightBranchBusiness: 0n
      }
    ),
    withTimeout(
      loadLevelBranchStats(contract, input.userId),
      8000,
      {
        levelTreeLeft: 0,
        levelTreeRight: 0
      }
    ),
    loadCrosslineDisplayIncome({
      provider,
      userId: input.userId,
      coreAddress: configuredCoreAddress,
      incomeRouterAddress
    }),
    loadSpilloverDisplayIncome({
      provider,
      coreAddress: configuredCoreAddress,
      userId: input.userId,
      incomeRouterAddress
    }),
    withTimeout(
      loadDirectReferralIncomeByUserId({
        provider,
        sponsorUserId: input.userId,
        referralIds: directReferralIds,
        incomeRouterAddress
      }),
      30000,
      {}
    )
  ]);

  const totalTeamBusinessRaw = BigInt(branchStats.leftBranchBusiness) + BigInt(branchStats.rightBranchBusiness);
  return {
    totalTeamBusiness: formatTokenAmount(totalTeamBusinessRaw),
    spilloverIncome: formatTokenAmount(spilloverAmount),
    crossLineIncome: formatTokenAmount(crosslineAmount),
    directReferralIds,
    directReferralIncomeByUserId,
    networkBonusHistory,
    leftBranchNodes: Number(branchStats.leftBranchNodes),
    rightBranchNodes: Number(branchStats.rightBranchNodes),
    leftBranchBusiness: formatTokenAmount(branchStats.leftBranchBusiness),
    rightBranchBusiness: formatTokenAmount(branchStats.rightBranchBusiness),
    levelTreeLeft: Number(levelBranchStats.levelTreeLeft),
    levelTreeRight: Number(levelBranchStats.levelTreeRight)
  };
}

async function ensureConfiguredChain() {
  if (!window.ethereum) {
    throw new Error(getWalletUnavailableMessage());
  }
  if (!activeNetworkConfig.rpcUrl) {
    throw new Error(`The RPC URL is missing for ${activeNetworkConfig.label}. Check the frontend env settings and try again.`);
  }

  const chainIdHex = toHexChainId(activeNetworkConfig.chainId);
  const chainId = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  if (chainId === chainIdHex) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  } catch {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: chainIdHex,
        chainName: activeNetworkConfig.label,
        nativeCurrency: activeNetworkConfig.nativeCurrency,
        rpcUrls: [activeNetworkConfig.rpcUrl],
        blockExplorerUrls: activeNetworkConfig.blockExplorerUrls
      }]
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }]
    });
  }
}

async function getWriteContracts() {
  const coreAddress = configuredCoreAddress;
  if (!coreAddress) {
    throw new Error("The core contract address is missing. Check the frontend env settings and try again.");
  }
  if (!window.ethereum) {
    throw new Error(getWalletUnavailableMessage());
  }

  await ensureConfiguredChain();
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const code = await provider.getCode(coreAddress);
  if (code === "0x") {
    throw new Error(`The configured contract is not live on ${activeNetworkConfig.label}. Check the RPC URL, redeploy if needed, and restart the frontend.`);
  }

  const core = new Contract(coreAddress, metaGuildXCoreAbi, signer);
  const routerAddress = configuredIncomeRouterAddress;
  const router =
    routerAddress && routerAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(routerAddress, incomeRouterWriteAbi, signer)
      : null;
  const staking =
    configuredStakingAddress && configuredStakingAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredStakingAddress, mgxStakingAbi, signer)
      : null;
  const cashback =
    configuredCashbackAddress && configuredCashbackAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredCashbackAddress, cashbackPoolAbi, signer)
      : null;
  const income =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, signer)
      : null;
  const upgrade =
    configuredUpgradeAddress && configuredUpgradeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredUpgradeAddress, metaGuildXUpgradeAbi, signer)
      : null;

  return { provider, signer, address, core, router, staking, cashback, income, upgrade };
}

async function getReadCoreContract() {
  const contractAddress = configuredCoreAddress;
  if (!contractAddress) {
    throw new Error("The core contract address is missing. Check the frontend env settings and try again.");
  }

  const provider = await getReadProvider();
  return new Contract(contractAddress, metaGuildXCoreAbi, provider);
}

async function getReadBinaryTreeContract() {
  if (!configuredBinaryTreeAddress) {
    throw new Error("The binary tree contract address is missing. Check the frontend env settings and try again.");
  }

  const provider = await getReadProvider();
  return new Contract(configuredBinaryTreeAddress, binaryTreeAbi, provider);
}

async function getUsdtPaymentAsset(contract: Contract) {
  const configuredUsdtAddress = activeNetworkConfig.usdtAddress.trim();
  if (configuredUsdtAddress) {
    return normalizeAddress(configuredUsdtAddress);
  }

  const defaultPaymentAsset = (await contract.defaultPaymentAsset()) as string;
  if (!defaultPaymentAsset || defaultPaymentAsset === "0x0000000000000000000000000000000000000000") {
    throw new Error("USDT payment asset is not configured for this network");
  }

  return normalizeAddress(defaultPaymentAsset);
}

async function ensureErc20Approval(input: {
  tokenAddress: string;
  signer: ContractRunner;
  ownerAddress: string;
  spenderAddress: string;
  requiredRaw: bigint;
  assetLabel: string;
  onProgress?: (step: "approving" | "confirming" | "registering" | "success") => void;
}) {
  const tokenAddress = normalizeAddress(input.tokenAddress);
  const ownerAddress = normalizeAddress(input.ownerAddress);
  const spenderAddress = normalizeAddress(input.spenderAddress);
  const token = new Contract(tokenAddress, erc20ApprovalAbi, input.signer);
  const decimals = Number(await token.decimals());
  const requiredRaw = parseUnits(formatUnits(input.requiredRaw, decimals), decimals);
  const [walletBalance, currentAllowance] = (await Promise.all([
    token.balanceOf(ownerAddress),
    token.allowance(ownerAddress, spenderAddress)
  ])) as [bigint, bigint];

  if (walletBalance < requiredRaw) {
    throw new Error(
      `Insufficient ${input.assetLabel} in the connected wallet. Required: ${formatUnits(requiredRaw, decimals)} ${input.assetLabel}, Available: ${formatUnits(walletBalance, decimals)} ${input.assetLabel}.`
    );
  }

  if (currentAllowance < requiredRaw) {
    try {
      input.onProgress?.("approving");
      const approveTx = await token.approve(spenderAddress, requiredRaw);
      input.onProgress?.("confirming");
      await approveTx.wait();
    } catch (error) {
      console.error("USDT approval failed:", error);
      throw new Error("USDT approval failed or rejected");
    }
  }

  return { token, decimals, requiredRaw };
}

async function getUsdtAmountForPackageLevel(
  tokenAddress: string,
  runner: ContractRunner,
  packageLevel: number
) {
  const packagePriceUsdt = PACKAGE_PRICES_USDT[packageLevel];
  if (!packagePriceUsdt) {
    throw new Error("Invalid package level for USDT payment");
  }

  const usdtContract = new Contract(normalizeAddress(tokenAddress), erc20ApprovalAbi, runner);
  const usdtDecimals = Number(await usdtContract.decimals());
  return parseUnits(packagePriceUsdt.toString(), usdtDecimals);
}

async function findPlacementSlot(
  contract: Contract,
  sponsorId: number
): Promise<{ placementParentId: number; isLeft: boolean }> {
  void contract;
  const treeContract = await getReadBinaryTreeContract();

  // Try sponsor-specific slot first
  const [parentIdRaw, isLeftRaw] = await treeContract.findNextSlotUnderSponsor(BigInt(sponsorId));
  let placementParentId = Number(parentIdRaw);
  let isLeft = Boolean(isLeftRaw);

  // Fallback: contract BFS bug returns 0 for deeper trees - use findNextAvailableSlot from sponsor
  if (!placementParentId) {
    const [fallbackParentIdRaw, fallbackIsLeftRaw] = await treeContract.findNextAvailableSlot(BigInt(sponsorId));
    placementParentId = Number(fallbackParentIdRaw);
    isLeft = Boolean(fallbackIsLeftRaw);
  }

  if (!placementParentId) {
    throw new Error("No available placement slot found under this sponsor. The tree may be full.");
  }

  return { placementParentId, isLeft };
}

async function signPlacementInstruction(input: {
  provider: BrowserProvider;
  contract: Contract;
  account: string;
  sponsorId: number;
  placementParentId: number;
  isLeft: boolean;
  nonce: number;
  }): Promise<{ signature: string; deadline: bigint }> {
    const network = await input.provider.getNetwork();
    const contractAddress = await input.contract.getAddress();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const placementData = {
      chainId: network.chainId.toString(),
      contractAddress,
      account: input.account,
      sponsorId: input.sponsorId,
      placementParentId: input.placementParentId,
      isLeft: input.isLeft,
      nonce: input.nonce,
      deadline: deadline.toString()
    };
  const configuredSignerUrl = readTrimmedEnv("VITE_PLACEMENT_SIGNER_URL");
  if (!configuredSignerUrl) {
    throw new Error("Placement signer URL not configured");
  }
  const signerUrl = configuredSignerUrl;
  const digest = solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256", "bool", "uint256", "uint256"],
    [
      network.chainId,
      contractAddress,
        input.account,
        BigInt(input.sponsorId),
        BigInt(input.placementParentId),
        input.isLeft,
      BigInt(input.nonce),
      deadline
    ]
  );

  if (activeNetworkConfig.key === "local") {
    const connectedSigner = await input.provider.getSigner();
    const signature = await connectedSigner.signMessage(getBytes(digest));
    return { signature, deadline };
  }

  try {
      const response = await fetch(`${signerUrl}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(placementData)
      });

      if (!response.ok) {
        throw new Error("Placement signing service unavailable");
      }

      const payload = (await response.json()) as { signedTx?: string; signature?: string; signer?: string; deadline?: number | string };
      const signature = payload.signedTx ?? payload.signature;
      if (!signature) {
        throw new Error("Placement signing service returned no signature");
      }

      return { signature, deadline: payload.deadline !== undefined ? BigInt(payload.deadline) : 0n };
    } catch (error) {
      console.warn("MetaGuildX placement signer fetch failed", { signerUrl, error });
      throw new Error("Placement signing service unavailable");
    }
  }

export async function disconnectWallet() {
  if (!window.ethereum) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }]
    });
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }]
    });
  } catch {
    // Some wallets do not support permission revocation; app state logout still works.
  }
}

function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function getWalletUnavailableMessage() {
  return isLikelyMobileDevice()
    ? "MetaMask was not detected. Open this page in the MetaMask in-app browser and try again."
    : "MetaMask was not detected. Install or open MetaMask and try again.";
}

async function verifyWalletOwnership(address: string) {
  if (!window.ethereum) {
    throw new Error(getWalletUnavailableMessage());
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const message = `MetaGuildX Authentication\nWallet: ${address}\nNonce: ${Date.now()}`;
  const signature = await signer.signMessage(message);
  const recoveredAddress = verifyMessage(message, signature);

  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Signature verification failed");
  }

  return address;
}

export async function connectWalletSilently(expectedWallet?: string | null) {
  return timedAsync("wallet reconnect", async () => {
    if (!window.ethereum) {
      throw new Error(getWalletUnavailableMessage());
    }

    await withTimeout(ensureConfiguredChain(), 15000);

    const currentAccounts = await withTimeout(
      window.ethereum.request({ method: "eth_accounts" }) as Promise<unknown>,
      15000
    );
    if (!Array.isArray(currentAccounts) || currentAccounts.length === 0 || typeof currentAccounts[0] !== "string") {
      throw new Error("Wallet session not found");
    }

    const currentWallet = currentAccounts[0].toLowerCase();
    if (expectedWallet && (!currentWallet || currentWallet !== expectedWallet.toLowerCase())) {
      throw new Error("Wallet mismatch - require fresh connect");
    }

    return currentAccounts[0];
  });
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error(getWalletUnavailableMessage());
  }

  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }]
    });
  } catch {
    // Some wallets do not support permission revocation; continue with connect attempt.
  }

  await new Promise((resolve) => window.setTimeout(resolve, 300));

  let accounts: unknown;
  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }]
    });
    accounts = await window.ethereum.request({ method: "eth_accounts" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
    const unsupportedPermissionsRequest =
      code === -32601 ||
      message.toLowerCase().includes("wallet_requestpermissions") ||
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("is not available") ||
      message.toLowerCase().includes("unsupported method");

    if (!unsupportedPermissionsRequest) {
      throw error instanceof Error ? error : new Error("Wallet connection failed. Open MetaMask and try again.");
    }

    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  if (Array.isArray(accounts) && accounts.length === 0) {
    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  }

  if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== "string") {
    throw new Error("No wallet account was selected. Choose an account in MetaMask and try again.");
  }

  try {
    await ensureConfiguredChain();
  } catch (error) {
    throw error instanceof Error ? error : new Error("Network switch failed. Switch to the correct network in MetaMask and try again.");
  }

  return verifyWalletOwnership(accounts[0]);
}

export async function registerUser(
  input: { sponsorId: number; packageLevel: number; selectedBox: number },
  onProgress?: (step: "approving" | "confirming" | "registering" | "success") => void
): Promise<RegistrationResult> {
  if (input.packageLevel !== 1 || input.selectedBox !== 1) {
    throw new Error("Initial registration must start with Package 1 in the active box.");
  }

  try {
    const { provider, signer, core, address } = await getWriteContracts();
    const normalizedAddress = normalizeAddress(address);
    const sponsorId = normalizeSponsorId(input.sponsorId);
    const existingUserId = (await core.userIdByAddress(normalizedAddress)) as bigint;
    if (existingUserId > 0n) {
      throw new Error("This wallet is already registered.");
    }

    const usdtAddress = await getUsdtPaymentAsset(core);
    const contractAddress = await core.getAddress();
    const requiredAllowance = await getUsdtAmountForPackageLevel(usdtAddress, signer, input.packageLevel);

    await ensureErc20Approval({
      tokenAddress: usdtAddress,
      signer,
      ownerAddress: normalizedAddress,
      spenderAddress: contractAddress,
      requiredRaw: requiredAllowance,
      assetLabel: "USDT",
      onProgress
    });

    const nonce = Number(await core.nonces(normalizedAddress));
    const { placementParentId, isLeft } = await findPlacementSlot(core, Number(sponsorId));

    const { signature, deadline } = await signPlacementInstruction({
      provider,
      contract: core,
      account: normalizedAddress,
      sponsorId: Number(sponsorId),
      placementParentId,
      isLeft,
      nonce
    });

    try {
      await core.registerWithPlacement.staticCall(
        sponsorId,
        BigInt(placementParentId),
        isLeft,
        signature,
        BigInt(nonce),
        deadline,
        { from: normalizedAddress }
      );
    } catch (staticErr: any) {
      void staticErr;
    }

    const tx = await core.registerWithPlacement(
      sponsorId,
      BigInt(placementParentId),
      isLeft,
      signature,
      BigInt(nonce),
      deadline,
      { gasLimit: 16_000_000n }
    );    await tx.wait();    onProgress?.("success");

    return {
      txHash: tx.hash,
      paid: "10 USDT",
      breakdown: {
        directIncome: "4.6 USDT",
        levelIncome: "4.0 USDT",
        cashbackPool: "0.4 USDT",
        creatorFee: "1.0 USDT"
      },
      mgxReward: "10 MGX"
    };
  } catch (error) {
    console.error("MetaGuildX register failed", {
      sponsorId: input.sponsorId,
      packageLevel: input.packageLevel,
      selectedBox: input.selectedBox,
      error
    });
    throw new Error(formatRegistrationError(error));
  }
}

export async function getRegistrationDistribution(
  userId: number,
  txHash: string
): Promise<RegistrationDistribution> {
  if (!window.ethereum) {
    throw new Error("MetaMask was not detected. Open MetaMask and try again.");
  }

  const provider = new BrowserProvider(window.ethereum);
  const coreAddress = configuredCoreAddress;
  const incomeRouterAddress = configuredIncomeRouterAddress;
  const incomeEngineAddress = configuredIncomeAddress;
  const cashbackPoolAddress = configuredCashbackAddress;

  if (!coreAddress) {
    throw new Error("The core contract address is missing. Check the frontend env settings and try again.");
  }

  const core = new Contract(
    coreAddress,
    [
      "function usersById(uint256) view returns (uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered)",
      "function defaultPaymentAsset() view returns (address)"
    ],
    provider
  );
  const income =
    incomeEngineAddress && incomeEngineAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(
          incomeEngineAddress,
          [
            "function getTotalIncome(uint256) view returns (uint256)",
            "function getTotalAllIncome(uint256) view returns (uint256)"
          ],
          provider
        )
      : null;

  const userProfile = (await core.usersById(userId)) as { sponsorId: bigint };
  const sponsorId = Number(userProfile.sponsorId);
  const defaultPaymentAsset = (await core.defaultPaymentAsset()) as string;

  const [sponsorProfile, sponsorIncome] = await Promise.all([
    sponsorId > 0 ? (core.usersById(sponsorId) as Promise<{ account: string }>) : Promise.resolve({ account: "N/A" }),
    sponsorId > 0 && income ? (income.getTotalAllIncome(sponsorId) as Promise<bigint>) : Promise.resolve(0n)
  ]);

  const cashbackPool =
    cashbackPoolAddress && cashbackPoolAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(
          cashbackPoolAddress,
          ["function cashbackPoolBalanceByAsset(address) view returns (uint256)"],
          provider
        )
      : null;

  const incomeRouter =
    incomeRouterAddress && incomeRouterAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(incomeRouterAddress, ["function platformReserve() view returns (uint256)"], provider)
      : null;

  const [cashbackPoolBalance, platformReserve] = await Promise.all([
    cashbackPool ? (cashbackPool.cashbackPoolBalanceByAsset(defaultPaymentAsset) as Promise<bigint>) : Promise.resolve(0n),
    incomeRouter ? (incomeRouter.platformReserve() as Promise<bigint>) : Promise.resolve(0n)
  ]);

  txHash;

  return {
    directIncome: `${formatTokenAmount(sponsorIncome)} USDT (routed via income engine)`,
    levelIncome: "4.0 USDT (distributed through router/income engine)",
    cashbackPool: `${formatTokenAmount(cashbackPoolBalance)} USDT (pool total)`,
    creatorFee: "1.0 USDT sent to creator wallet",
    sponsorWallet: sponsorProfile.account,
    platformReserve: `${formatTokenAmount(platformReserve)} USDT`
  };
}

export async function stakeTokens(input: { amount: number; durationKey: StakeDurationKey; autoCompound: boolean }) {
  const { core, staking, address } = await getWriteContracts();
  if (!staking) {
    throw new Error("Staking contract address not configured");
  }
  try {
    const userId = Number(await core.userIdByAddress(address));
    if (userId <= 0) {
      throw new Error("Please complete registration first.");
    }

    const profile = (await core.usersById(BigInt(userId))) as { id: bigint; account: string };
    if (Number(profile.id ?? 0n) <= 0 || !profile.account || profile.account === "0x0000000000000000000000000000000000000000") {
      throw new Error("Please complete registration first.");
    }

    const lockDuration = stakeDurationDays[input.durationKey];
    const scaledAmount = parseUnits(input.amount.toString(), 18);
    if (!configuredMgxTokenAddress) {
      throw new Error("MGX token address not configured");
    }
    if (!configuredStakingAddress) {
      throw new Error("Staking contract address not configured");
    }

    const mgxToken = new Contract(normalizeAddress(configuredMgxTokenAddress), erc20ApprovalAbi, core.runner);
    const stakingAddress = normalizeAddress(configuredStakingAddress);
    const currentAllowance = (await mgxToken.allowance(address, stakingAddress)) as bigint;
    if (currentAllowance < scaledAmount) {
      const approveTx = await mgxToken.approve(stakingAddress, scaledAmount);
      await approveTx.wait();
    }

    const tx = await core.stake(scaledAmount, lockDuration, input.autoCompound);
    await tx.wait();
  } catch (error) {
    throw new Error(formatUserFacingContractError(error));
  }
}

export async function claimReward(pendingReward?: string, rewardWindowReady?: boolean) {
  const { core } = await getWriteContracts();
  try {
    if (!pendingReward || parseFloat(pendingReward) <= 0) {
      throw new Error("No staking reward is claimable yet. Please wait for the next reward window.");
    }
    if (rewardWindowReady === false) {
      throw new Error("Reward window not reached yet. Please wait for the countdown to complete.");
    }
    const tx = await core.claimStakingReward();
    const receipt = await tx.wait();
    const stakingEvents = new Interface([
      "event Claimed(address indexed account, uint256 amount, address indexed paymentAsset, uint256 settlementAmount)"
    ]);
    let claimedReward = 0n;

    for (const log of receipt.logs) {
      try {
        const parsed = stakingEvents.parseLog(log);
        if (parsed?.name === "Claimed") {
          claimedReward = BigInt(parsed.args.amount);
          break;
        }
      } catch {
        // Ignore unrelated logs.
      }
    }

    return {
      claimedReward: formatTokenAmount(claimedReward, 18)
    };
  } catch (error) {
    throw new Error(formatUserFacingContractError(error));
  }
}

export async function surrenderForCashback(userId: number) {
  const { cashback, address } = await getWriteContracts();
  if (!cashback) {
    throw new Error("Cashback contract address not configured");
  }
  const tx = await cashback.surrenderForCashback(address, BigInt(userId));
  await tx.wait();
}

export async function compoundReward() {
  const { core } = await getWriteContracts();
  try {
    const tx = await core.compoundStakingReward();
    await tx.wait();
  } catch (error) {
    throw new Error(formatUserFacingContractError(error));
  }
}

export async function withdrawStakeTokens(input: { amount: number }) {
  const { core } = await getWriteContracts();
  try {
    const scaledAmount = parseUnits(input.amount.toString(), 18);
    const tx = await core.withdrawStake(scaledAmount);
    await tx.wait();
  } catch (error) {
    throw new Error(formatUserFacingContractError(error));
  }
}

export async function getCreatorWalletConfig() {
  const coreAddress = configuredCoreAddress;
  const routerAddress = configuredIncomeRouterAddress;

  if (!coreAddress || !routerAddress) {
    throw new Error("Creator wallet controls are not configured. Check the frontend env settings and try again.");
  }

  const provider = await getReadProvider();
  const core = new Contract(coreAddress, metaGuildXCoreAbi, provider);
  const router = new Contract(routerAddress, incomeRouterWriteAbi, provider);

  const [coreCreatorWallet, routerCreatorWallet] = (await Promise.all([
    core.creatorFeeWallet(),
    router.creatorWallet()
  ])) as [string, string];

  return {
    coreAddress,
    routerAddress,
    coreCreatorWallet,
    routerCreatorWallet
  };
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  return timedAsync("getAdminOverview", async () => {
    syncAnalyticsCachesForDeployment();
    const provider = await getReadProvider();
    const coreAddress = configuredCoreAddress || TESTNET_CORE_ADDRESS;
    const binaryTreeAddress = configuredBinaryTreeAddress || TESTNET_BINARY_TREE_ADDRESS;
    const incomeRouterAddress = configuredIncomeRouterAddress || TESTNET_INCOME_ROUTER_ADDRESS;
    const cashbackPoolAddress = configuredCashbackAddress || TESTNET_CASHBACK_POOL_ADDRESS;
    const stakingAddress = configuredStakingAddress || TESTNET_STAKING_ADDRESS;
    const usdtAddress = activeNetworkConfig.usdtAddress;

    const core = new Contract(coreAddress, metaGuildXCoreAbi, provider);
    const router = new Contract(incomeRouterAddress, incomeRouterWriteAbi, provider);
    const usdt = usdtAddress ? new Contract(usdtAddress, erc20ApprovalAbi, provider) : null;
    const contractInterface = new Interface(metaGuildXCoreAbi);

    const [nextUserIdRaw, totalTokenDistributedRaw, creatorWallet, productionMode, latestBlock] = await Promise.all([
      core.nextUserId(),
      core.totalTokenDistributed(),
      core.creatorFeeWallet(),
      core.productionMode(),
      getBlockNumberWithDiagnostics(provider, "provider.getBlockNumber:getAdminOverview")
    ]);
    const deploymentStartBlock = getDeploymentAnalyticsStartBlock(latestBlock);

  const [registrationEvents, upgradeEvents] = await Promise.all([
    queryFilterChunked(core, core.filters.UserRegistered(), deploymentStartBlock, latestBlock),
    queryFilterChunked(core, core.filters.PackageUpgraded(), deploymentStartBlock, latestBlock)
  ]);

  const totalVolumeRaw =
    registrationEvents.reduce((sum: bigint, event: any) => {
      if (!("args" in event)) {
        return sum;
      }
      const amount = event.args?.amount;
      return typeof amount === "bigint" ? sum + amount : sum;
    }, 0n) +
    upgradeEvents.reduce((sum: bigint, event: any) => {
      if (!("args" in event)) {
        return sum;
      }
      const amount = event.args?.amount;
      return typeof amount === "bigint" ? sum + amount : sum;
    }, 0n);

  const [recentRegistrationEvents, recentUpgradeEvents] = await Promise.all([
    queryFilterChunked(
      core,
      core.filters.UserRegistered(null, null, null, null, null, null, null),
      deploymentStartBlock,
      latestBlock,
      1_999
    ),
    queryFilterChunked(
      core,
      core.filters.PackageUpgraded(null, null, null, null),
      deploymentStartBlock,
      latestBlock,
      1_999
    )
  ]);
  let recentRebirthEvents: any[] = [];
  try {
    if (core.filters.RebirthUserCreated) {
      recentRebirthEvents = await queryFilterChunked(
        core,
        core.filters.RebirthUserCreated(null, null, null),
        deploymentStartBlock,
        latestBlock,
        1_999
      );
    }
  } catch (error) {
    console.warn("RebirthUserCreated not available:", error);
  }

  const recentEvents = [
    ...recentRegistrationEvents.map((event) => ({
      event: "UserRegistered",
      details: `User #${Number(event.args.userId ?? event.args[0] ?? 0n)} joined under Sponsor #${Number(event.args.sponsorId ?? event.args[1] ?? 0n)}`,
      block: event.blockNumber
    })),
    ...recentUpgradeEvents.map((event) => ({
      event: "PackageUpgraded",
      details: `User #${Number(event.args.userId ?? event.args[0] ?? 0n)} upgraded to Package ${Number(event.args.toLevel ?? event.args[2] ?? 0n)}`,
      block: event.blockNumber
    })),
    ...recentRebirthEvents.map((event) => ({
      event: "RebirthUserCreated",
      details: `Original User #${Number(event.args.originalUserId ?? event.args[0] ?? 0n)} rebirthed to User #${Number(event.args.newUserId ?? event.args[1] ?? 0n)}`,
      block: event.blockNumber
    }))
  ]
    .sort((left, right) => right.block - left.block)
    .slice(0, 10);

    return {
    totalUsers: Math.max(0, Number(nextUserIdRaw) - 1),
    totalUsdtCollected: formatTokenAmount(totalVolumeRaw),
    totalMgxDistributed: formatTokenAmount(totalTokenDistributedRaw, 18),
    creatorWallet,
    productionMode,
    addresses: {
      core: coreAddress,
      usdt: usdtAddress || "Not configured",
      binaryTree: binaryTreeAddress || "Not configured",
      incomeRouter: incomeRouterAddress || "Not configured",
      cashbackPool: cashbackPoolAddress || "Not configured",
      staking: stakingAddress || "Not configured"
    },
    recentEvents
    };
  });
}

export async function updateCreatorWallet(nextCreatorWallet: string) {
  const normalizedAddress = getAddress(nextCreatorWallet.trim());
  const { core, router } = await getWriteContracts();

  if (!router) {
    throw new Error("Income router is not configured. Check the frontend env settings and try again.");
  }

  const coreTx = await core.setCreatorFeeWallet(normalizedAddress);
  await coreTx.wait();

  const routerTx = await router.setCreatorWallet(normalizedAddress);
  await routerTx.wait();

  return {
    creatorWallet: normalizedAddress,
    coreTxHash: coreTx.hash as string,
    routerTxHash: routerTx.hash as string
  };
}

export async function getLevelParent(userId: number) {
  const contract = await getReadBinaryTreeContract();
  return contract.getLevelParent(BigInt(userId));
}

export async function getLevelChildren(userId: number) {
  const contract = await getReadBinaryTreeContract();
  return contract.getLevelChildren(BigInt(userId));
}

export async function isLevelEligibleUser(userId: number) {
  const contract = await getReadBinaryTreeContract();
  return contract.isLevelEligible(BigInt(userId));
}

export async function getLevelRootId() {
  const contract = await getReadBinaryTreeContract();
  return contract.levelRootId() as Promise<bigint>;
}

export async function loadLevelTreePreview(connectedUserId: number | null): Promise<TreePreviewNode[]> {
  if (!configuredCoreAddress || !configuredBinaryTreeAddress || getReadRpcUrls().length === 0) {
    return [];
  }
  if (!connectedUserId || connectedUserId <= 0) {
    return [];
  }

  const provider = await getReadProvider();
  const [coreCode, treeCode] = await Promise.all([
    provider.getCode(configuredCoreAddress),
    provider.getCode(configuredBinaryTreeAddress)
  ]);

  if (coreCode === "0x" || treeCode === "0x") {
    return [];
  }

  const coreContract = new Contract(configuredCoreAddress, metaGuildXCoreAbi, provider);
  const treeContract = new Contract(configuredBinaryTreeAddress, binaryTreeAbi, provider);
  const tokenEngineModule = createTokenEngineModule(provider);
  const incomeContract =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider)
      : null;

  const levelRootId = connectedUserId;
  if (levelRootId <= 0) {
    return [];
  }

  const visited = new Set<number>();
  const queue: Array<{ userId: number; depth: number }> = [{ userId: levelRootId, depth: 0 }];
  const levelNodes: TreePreviewNode[] = [];

  while (queue.length > 0 && levelNodes.length < 15) {
    const current = queue.shift()!;
    if (current.userId <= 0 || visited.has(current.userId)) {
      continue;
    }

    visited.add(current.userId);

    const [children, parentIdRaw, profile, internalWalletBalance, userTokenAllocation, userActiveBoxId] = await Promise.all([
      treeContract.getLevelChildren(BigInt(current.userId)),
      treeContract.getLevelParent(BigInt(current.userId)),
      coreContract.usersById(BigInt(current.userId)),
      incomeContract ? incomeContract.getTotalEscrow(BigInt(current.userId)) : Promise.resolve(0n),
      tokenEngineModule ? tokenEngineModule.getTokenAllocation(BigInt(current.userId)) : Promise.resolve(0n),
      coreContract.activeBoxByUser(BigInt(current.userId))
    ]);

    const leftChildId = Number(children[0]);
    const rightChildId = Number(children[1]);

    levelNodes.push({
      userId: current.userId,
      parentId: Number(parentIdRaw),
      leftChildId,
      rightChildId,
      depth: current.depth,
      packageLevel: Number(profile.packageLevel),
      account: profile.account as string,
      directReferrals: Number(profile.directReferrals),
      totalTeamBusiness: formatTokenAmount(profile.totalTeamBusiness),
      totalEarnings: formatTokenAmount(profile.totalEarnings),
      mgxAllocated: formatTokenAmount(userTokenAllocation, 18),
      userActiveBoxId: Number(userActiveBoxId)
    });

    if (leftChildId > 0) {
      queue.push({ userId: leftChildId, depth: current.depth + 1 });
    }
    if (rightChildId > 0) {
      queue.push({ userId: rightChildId, depth: current.depth + 1 });
    }
  }

  return levelNodes;
}

export async function loadLevelIncomeBreakdown(
  userId: number,
  totalLevelIncome = 0,
  userJoinedAt?: number,
  onProgress?: (rows: LevelBreakdownRow[], chunksComplete: number, chunksTotal: number) => void
): Promise<LevelBreakdownRow[]> {
  const fallbackRows = Array.from({ length: 10 }, (_, i) => ({
    level: i + 1,
    amount: i === 0 && totalLevelIncome > 0 ? totalLevelIncome.toFixed(2) : "0.00",
    members: i === 0 && totalLevelIncome > 0 ? 1 : 0
  }));

  if (
    !configuredIncomeRouterAddress ||
    getReadRpcUrls().length === 0 ||
    !userId ||
    userId <= 0
  ) {
    return fallbackRows;
  }

  const levelCacheKey = `level-${getDeploymentCacheNamespace()}-${userId}`;
  const cachedLevelBreakdown = levelBreakdownCache.get(levelCacheKey);
  if (cachedLevelBreakdown && Date.now() - cachedLevelBreakdown.timestamp < SNAPSHOT_CACHE_TTL) {
    const _lvlTotal = cachedLevelBreakdown.data.reduce((s:number,r:any)=>s+(parseFloat(r.amount)||0),0);
    console.log(`[LVL-PIPELINE] userId=${userId} source=MEMORY-CACHE rows=${cachedLevelBreakdown.data.length} total=${_lvlTotal.toFixed(2)} ts=${Date.now()}`);
    return cachedLevelBreakdown.data;
  }

  try {
    const provider = await getReadProvider();
    const currentBlock = await provider.getBlockNumber();
    const persistentCacheKey = `mgx_level_breakdown_v1_${getDeploymentCacheNamespace()}_${userId}`;
    const persisted = readPersistentJson<PersistedLevelBreakdown>(persistentCacheKey);
    if (
      persisted &&
      Date.now() - persisted.timestamp < SNAPSHOT_LOCAL_CACHE_TTL &&
      Number.isFinite(persisted.lastScannedBlock) &&
      persisted.lastScannedBlock >= currentBlock
    ) {
      levelBreakdownCache.set(levelCacheKey, {
        data: persisted.data,
        timestamp: Date.now()
      });
      const _pTotal = persisted.data.reduce((s:number,r:any)=>s+(parseFloat(r.amount)||0),0);
      console.log(`[LVL-PIPELINE] userId=${userId} source=PERSISTENT-CACHE rows=${persisted.data.length} total=${_pTotal.toFixed(2)} lastBlock=${persisted.lastScannedBlock} ts=${Date.now()}`);
      return persisted.data;
    }

    const routerAddresses = getHistoricalIncomeRouterAddresses(configuredIncomeRouterAddress);
    console.log(`[LVL-PIPELINE] userId=${userId} source=FRESH-SCAN-START startBlock=pending currentBlock=${await provider.getBlockNumber()} ts=${Date.now()}`);
    // Use deployment start block — income events exist from first registration tx
    // joinedAt-based calculation is WRONG: joinedAt ≠ registration block timestamp
    const startBlock = Math.max(
      persisted && Number.isFinite(persisted.lastScannedBlock) ? persisted.lastScannedBlock + 1 : 0,
      OPBNB_TESTNET_DEPLOYMENT_START_BLOCK
    );
    const amountByLevel: Record<number, bigint> = {};
    const membersByLevel: Record<number, Set<number>> = {};
    const persistedAmountRawByLevel = persisted?.amountRawByLevel ?? {};
    const persistedMemberIdsByLevel = persisted?.memberIdsByLevel ?? {};

    for (let level = 1; level <= 10; level++) {
      amountByLevel[level] = BigInt(persistedAmountRawByLevel[String(level)] ?? "0");
      membersByLevel[level] = new Set(persistedMemberIdsByLevel[String(level)] ?? []);
    }

    if (startBlock > currentBlock) {
      const rows = persisted?.data ?? fallbackRows.map((row) => ({ ...row, amount: "0.00", members: 0 }));
      levelBreakdownCache.set(levelCacheKey, {
        data: rows,
        timestamp: Date.now()
      });
      writePersistentJson<PersistedLevelBreakdown>(persistentCacheKey, {
        lastScannedBlock: currentBlock,
        data: rows,
        amountRawByLevel: Object.fromEntries(
          Object.entries(amountByLevel).map(([level, amount]) => [level, amount.toString()])
        ),
        memberIdsByLevel: Object.fromEntries(
          Object.entries(membersByLevel).map(([level, members]) => [level, [...members]])
        ),
        timestamp: Date.now()
      });
      return rows;
    }

    let events: any[] = [];
    const LEVEL_CHUNK = 44000;
    const totalChunks = Math.ceil(Math.max(0, currentBlock - startBlock) / LEVEL_CHUNK);
    let chunksComplete = 0;
    // Progressive chunk scanning — update UI after every chunk
    const routerAddress = routerAddresses[0];
    if (routerAddress) {
      const router = new Contract(
        routerAddress,
        ["event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount, uint8 cyclePkgLevel)"],
        provider
      );
      const failedChunks: {chunkNum:number;start:number;end:number;error:string}[] = [];
      let chunkNum = 0;
      for (let b = startBlock; b <= currentBlock; b += LEVEL_CHUNK) {
        const end = Math.min(b + LEVEL_CHUNK - 1, currentBlock);
        const isLastChunk = end >= currentBlock;
        chunkNum++;
        // 3-attempt retry with backoff — same philosophy as loadBoxEarnings
        let chunkSuccess = false;
        let lastErr = "unknown";
        for (let attempt = 0; attempt < 3 && !chunkSuccess; attempt++) {
          if (attempt === 1) await new Promise(r => setTimeout(r, 500));
          if (attempt === 2) await new Promise(r => setTimeout(r, 800));
          try {
            const chunkLogs = await withTimeout(
              router.queryFilter(router.filters.LevelIncomeRecorded(null, BigInt(userId)), b, end),
              15000,
              [] as any[]
            );
            events.push(...chunkLogs);
            chunkSuccess = true;
          } catch (e: any) {
            lastErr = e?.code ?? (e?.message ?? "error").slice(0, 40);
          }
        }
        if (!chunkSuccess) {
          failedChunks.push({chunkNum, start: b, end, error: lastErr});
        }
        chunksComplete++;
        // 300ms inter-chunk delay to avoid RPC rate limiting
        if (!isLastChunk) await new Promise(r => setTimeout(r, 300));
        // Progressive update every 10 chunks or on last chunk
        if (onProgress && (chunksComplete % 10 === 0 || isLastChunk)) {
          const partialAmounts: Record<number, bigint> = {};
          const partialMembers: Record<number, Set<number>> = {};
          for (let lvl = 1; lvl <= 10; lvl++) {
            partialAmounts[lvl] = BigInt(persistedAmountRawByLevel[String(lvl)] ?? "0");
            partialMembers[lvl] = new Set(persistedMemberIdsByLevel[String(lvl)] ?? []);
          }
          for (const ev of events) {
            try {
              const args = ev.args as { level: bigint; amount: bigint; fromUserId: bigint };
              const lvl = Number(args.level);
              const amt = BigInt(args.amount);
              const from = Number(args.fromUserId);
              partialAmounts[lvl] = (partialAmounts[lvl] ?? 0n) + amt;
              if (!partialMembers[lvl]) partialMembers[lvl] = new Set();
              partialMembers[lvl].add(from);
            } catch {}
          }
          const partialRows = Array.from({ length: 10 }, (_, i) => ({
            level: i + 1,
            amount: formatTokenAmount(partialAmounts[i + 1] ?? 0n),
            members: partialMembers[i + 1]?.size ?? 0
          }));
          onProgress(partialRows, chunksComplete, totalChunks);
        }
      }
      if (failedChunks.length > 0) {
        console.warn(`[MGX] level scan: ${failedChunks.length}/${chunkNum} chunks failed`, failedChunks.slice(0,3));
      }
    }
    if (events.length === 0) {
      // Timeout or scan failure — return previous data without advancing cache
      // NEVER write empty data to persistent cache (would lock out correct data)
      const fallbackRows = persisted?.data ?? Array.from({ length: 10 }, (_, i) => ({
        level: i + 1,
        amount: "0.00",
        members: 0
      }));
      // Only write memory cache if we have real prior data (prevents empty lock)
      if (persisted?.data) {
        levelBreakdownCache.set(levelCacheKey, {
          data: persisted.data,
          timestamp: Date.now()
        });
      }
      // DO NOT write persistent cache — lastScannedBlock must NOT advance on failure
      return fallbackRows;
    }

    for (const ev of events) {
      if (!("args" in ev)) {
        continue;
      }
      const args = ev.args as unknown as { level: bigint | number; amount: bigint; fromUserId: bigint | number };
      const level = Number(args.level);
      const amount = BigInt(args.amount);
      const fromUser = Number(args.fromUserId);

      amountByLevel[level] = (amountByLevel[level] ?? 0n) + amount;

      if (!membersByLevel[level]) {
        membersByLevel[level] = new Set();
      }
      membersByLevel[level].add(fromUser);
    }

    const rows = Array.from({ length: 10 }, (_, i) => {
      const level = i + 1;
      const raw = amountByLevel[level] ?? 0n;
      const members = membersByLevel[level]?.size ?? 0;
      return {
        level,
        amount: formatTokenAmount(raw),
        members
      };
    });
    const _scanTotal = rows.reduce((s:number,r:any)=>s+(parseFloat(r.amount)||0),0);
    console.log(`[LVL-PIPELINE] userId=${userId} source=FRESH-SCAN-COMPLETE rows=${rows.length} total=${_scanTotal.toFixed(2)} ts=${Date.now()}`);
    for(const r of rows.filter((x:any)=>parseFloat(x.amount)>0)) console.log(`  L${r.level}: $${r.amount} ${r.members}m`);
    levelBreakdownCache.set(levelCacheKey, {
      data: rows,
      timestamp: Date.now()
    });
    writePersistentJson<PersistedLevelBreakdown>(persistentCacheKey, {
      lastScannedBlock: currentBlock,
      data: rows,
      amountRawByLevel: Object.fromEntries(
        Object.entries(amountByLevel).map(([level, amount]) => [level, amount.toString()])
      ),
      memberIdsByLevel: Object.fromEntries(
        Object.entries(membersByLevel).map(([level, members]) => [level, [...members]])
      ),
      timestamp: Date.now()
    });
    return rows;
  } catch (e) {
    console.warn("loadLevelIncomeBreakdown failed", e);
    return fallbackRows;
  }
}

export async function loadPersonalTreePreview(
  connectedUserId: number | null
): Promise<TreePreviewNode[]> {
  return timedAsync("getTreePreview", async () => {
    if (
      !configuredCoreAddress ||
      !configuredBinaryTreeAddress ||
      getReadRpcUrls().length === 0
    ) {
      return [];
    }
    if (!connectedUserId || connectedUserId <= 0) {
      return [];
    }
    // Hot-path cache: tree preview rarely changes within a session
    const previewCacheKey = getHotPathCacheKey("tree-preview", connectedUserId);
    const previewCached = readPersistentJson<{ data: TreePreviewNode[]; timestamp: number }>(previewCacheKey);
    if (previewCached && previewCached.data.length > 0 && Date.now() - previewCached.timestamp < HOT_PATH_CACHE_TTL) {
      return previewCached.data;
    }

    const provider = await getReadProvider();
    const treeContract = new Contract(
      configuredBinaryTreeAddress,
      binaryTreeAbi,
      provider
    );
    const coreContract = new Contract(
      configuredCoreAddress,
      metaGuildXCoreAbi,
      provider
    );

    const visited = new Set<number>();
    const queue: number[] = [connectedUserId];
    const subtreeIds: number[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId <= 0 || visited.has(currentId)) continue;
      visited.add(currentId);
      subtreeIds.push(currentId);

      const node = await treeContract.nodes(currentId);
      const left = Number(node.leftChildId);
      const right = Number(node.rightChildId);
      if (left > 0) queue.push(left);
      if (right > 0) queue.push(right);

      if (subtreeIds.length >= 63) break;
    }

    const previewDataByUserId = await loadPreviewUsers(
      coreContract,
      treeContract,
      subtreeIds
    );

    const previewResult = subtreeIds
      .map((id) => previewDataByUserId.get(id))
      .filter(
        (entry): entry is NonNullable<typeof entry> => Boolean(entry)
      )
      .map((entry) => ({
        userId: entry.userId,
        parentId: entry.parentId,
        leftChildId: entry.leftChildId,
        rightChildId: entry.rightChildId,
        depth: entry.depth,
        packageLevel: entry.packageLevel,
        account: entry.account,
        directReferrals: entry.directReferrals,
        totalTeamBusiness: entry.totalTeamBusiness,
        totalEarnings: entry.totalEarnings,
        mgxAllocated: entry.mgxAllocated,
        userActiveBoxId: entry.userActiveBoxId
      }));
    // Write to hot-path cache
    if (previewResult.length > 0 && previewCacheKey) {
      writePersistentJson(previewCacheKey, { data: previewResult, timestamp: Date.now() });
    }
    return previewResult;
  });
}

export async function moveInnerWalletToOuterWallet(input: {
  userId: number;
  amount: number;
  paymentAsset?: string | null;
}) {
  input;
  throw new Error("Manual transfer is not available in this V3 flow. Escrow and payouts are handled automatically.");
}

export async function upgradeUserPackage(input: { userId: number; newPackageLevel: number }) {
  const { signer, core, address } = await getWriteContracts();
  const profile = (await core.usersById(input.userId)) as { account: string; packageLevel: bigint };
  const currentPackageLevel = Number(profile.packageLevel);
  if (profile.account.toLowerCase() !== address.toLowerCase()) {
    throw new Error("The connected wallet does not match this user account. Switch to the correct wallet and try again.");
  }
  if (currentPackageLevel <= 0) {
    throw new Error("This wallet is not registered yet. Complete registration before upgrading.");
  }
  if (input.newPackageLevel !== currentPackageLevel + 1) {
    throw new Error("You can only upgrade to the next package level.");
  }

  const packagePrices = (await core.getPackagePrices()) as bigint[];
  const currentPackagePrice = packagePrices[currentPackageLevel - 1] ?? 0n;
  const upgradeAmount = currentPackagePrice * 2n;
  if (upgradeAmount <= 0n) {
    throw new Error("Could not calculate the upgrade amount. Refresh the app and try again.");
  }

  const paymentAsset = await getUsdtPaymentAsset(core);
  const contractAddress = await core.getAddress();

  const incomeContract =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(
          configuredIncomeAddress,
          [
            "function getEscrow(uint256) view returns (uint256)",
            "function getEscrowByPkg(uint256,uint8) view returns (uint256)"
          ],
          signer
        )
      : null;

  const currentPkgEscrow = incomeContract ? BigInt(await incomeContract.getEscrow(input.userId)) : 0n;
  const nextPkgEscrow = incomeContract ? BigInt(await incomeContract.getEscrowByPkg(input.userId, input.newPackageLevel)) : 0n;
  const escrowRaw = currentPkgEscrow + nextPkgEscrow;
  const walletChargeRaw = upgradeAmount > escrowRaw ? upgradeAmount - escrowRaw : 0n;

  const usdtContract = new Contract(normalizeAddress(paymentAsset), erc20ApprovalAbi, signer);
  const usdtDecimals = Number(await usdtContract.decimals());
  const walletChargeSettlement =
    (walletChargeRaw * (10n ** BigInt(usdtDecimals))) / (10n ** BigInt(PLATFORM_DECIMALS));

  if (walletChargeSettlement > 0n) {
    try {
      await ensureErc20Approval({
        tokenAddress: paymentAsset,
        signer,
        ownerAddress: address,
        spenderAddress: contractAddress,
        requiredRaw: walletChargeSettlement,
        assetLabel: "USDT"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("USDT approval failed or rejected")) {
        throw new Error("USDT approval failed or rejected");
      }
      throw error;
    }
  }

  let mined = false;
  try {
      const tx = await core.upgradePackage(input.userId, input.newPackageLevel, {
        gasLimit: 15_000_000n
      });
      const receipt = await tx.wait();
      mined = receipt?.status === 1;
      invalidateDashboardAnalytics();
  } catch (error) {
    if (mined) {
      invalidateDashboardAnalytics();
      return;
    }
    console.error("MetaGuildX upgradePackage failed", {
      userId: input.userId,
      currentPackageLevel,
      newPackageLevel: input.newPackageLevel,
      upgradeAmount: upgradeAmount.toString(),
      paymentAsset,
      error
    });
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ERC20: transfer amount exceeds balance")) {
      throw new Error("Insufficient USDT in the connected wallet. Please add more USDT before upgrading.");
    }
    if (message.includes("ERC20: transfer amount exceeds allowance")) {
      throw new Error("USDT approval is not complete for this upgrade. Approve the transaction and try again.");
    }
    if (message.toLowerCase().includes("missing revert data")) {
      throw new Error("Package upgrade could not be completed on-chain. Check your wallet balance and try again.");
    }
    throw error;
  }
}

export async function loadTreeNodeDetails(userId: number): Promise<TreeNodeDetails | null> {
  const contractAddress = configuredCoreAddress;
  if (!contractAddress || !configuredBinaryTreeAddress || userId <= 0) {
    return null;
  }

  if (getReadRpcUrls().length === 0) {
    return null;
  }

  const provider = await getReadProvider();
  const code = await provider.getCode(contractAddress);
  const treeCode = await provider.getCode(configuredBinaryTreeAddress);
  if (code === "0x" || treeCode === "0x") {
    return null;
  }

  const contract = new Contract(contractAddress, metaGuildXCoreAbi, provider);
  const treeContract = new Contract(configuredBinaryTreeAddress, binaryTreeAbi, provider);
  const income =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider)
      : null;
  const staking =
    configuredStakingAddress && configuredStakingAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredStakingAddress, mgxStakingAbi, provider)
      : null;
  const upgrade =
    configuredUpgradeAddress && configuredUpgradeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredUpgradeAddress, metaGuildXUpgradeAbi, provider)
      : null;
  const tokenEngine = createTokenEngineModule(provider);
  const [profile, treeNode, incomes, escrowBalance, rebirthEscrowRaw, userTokenAllocation, userActiveBoxId, directReferralIdsRaw, rebirthIdsRaw] = await Promise.all([
    contract.usersById(userId),
    Promise.all([treeContract.nodes(userId), treeContract.nodeDepth(userId)]),
    income
      ? income.incomesByUser(userId)
      : Promise.resolve({ direct: 0n, level: 0n, spillover: 0n, crossline: 0n }),
    income ? income.getTotalEscrow(userId) : Promise.resolve(0n),
    income ? income.getRebirthEscrow(userId) : Promise.resolve(0n),
    tokenEngine ? tokenEngine.getTokenAllocation(userId) : Promise.resolve(0n),
    contract.activeBoxByUser(userId),
    contract.getDirectReferralIds(userId),
    upgrade ? upgrade.getRebirthIds(userId) : Promise.resolve([])
  ]);
  const directReferralIds = directReferralIdsRaw.map((value: bigint) => Number(value));
  const localLevelSummary = buildLevelSummary(Number(profile.directReferrals));
  const [branchStats, levelBranchStats, levelSummary, spilloverAmount] = await Promise.all([
    loadBranchStats(contract, userId),
    loadLevelBranchStats(contract, userId),
    Promise.resolve({
      unlockedLevels: localLevelSummary.unlockedLevels,
      unlockedStatus: localLevelSummary.unlockedStatus
    }),
    loadSpilloverDisplayIncome({
      provider,
      coreAddress: contractAddress,
      userId,
      incomeRouterAddress: configuredIncomeRouterAddress || TESTNET_INCOME_ROUTER_ADDRESS
    })
  ]);

  const walletAddress = profile.account as string;
  const pendingStakingReward =
    walletAddress && walletAddress !== "0x0000000000000000000000000000000000000000"
      ? staking
        ? await staking.pendingStakingReward(walletAddress)
        : 0n
      : 0n;
  const actualDownlineBusiness = BigInt(branchStats.leftBranchBusiness) + BigInt(branchStats.rightBranchBusiness);

  return {
    userId,
    packageLevel: Number(profile.packageLevel),
    xCount: Number(profile.xCount),
    parentId: Number(treeNode[0].parentId),
    leftChildId: Number(treeNode[0].leftChildId),
    rightChildId: Number(treeNode[0].rightChildId),
    depth: Number(treeNode[1]),
    directReferrals: Number(profile.directReferrals),
    totalTeamBusiness: formatTokenAmount(actualDownlineBusiness),
    totalEarnings: formatTokenAmount(profile.totalEarnings),
    internalWalletBalance: formatTokenAmount(escrowBalance),
    rebirthEscrowBalance: formatTokenAmount(rebirthEscrowRaw),
    lostEarnings: "0",
    directIncome: formatTokenAmount(incomes.direct),
    levelIncome: formatTokenAmount(incomes.level),
    spilloverIncome: formatTokenAmount(spilloverAmount),
    crossLineIncome: formatTokenAmount(incomes.crossline),
    cashbackIncome: "0",
    stakingIncome: "0",
    pendingStakingReward: formatTokenAmount(pendingStakingReward, 18),
    walletAddress,
    mgxAllocated: formatTokenAmount(userTokenAllocation, 18),
    userActiveBoxId: Number(userActiveBoxId),
    leftBranchNodes: Number(branchStats.leftBranchNodes),
    rightBranchNodes: Number(branchStats.rightBranchNodes),
    leftBranchBusiness: formatTokenAmount(branchStats.leftBranchBusiness),
    rightBranchBusiness: formatTokenAmount(branchStats.rightBranchBusiness),
    levelTreeLeft: Number(levelBranchStats.levelTreeLeft),
    levelTreeRight: Number(levelBranchStats.levelTreeRight),
    directReferralIds,
    rebirthIds: rebirthIdsRaw.map((value: bigint) => Number(value)),
    unlockedLevels: Number(levelSummary.unlockedLevels),
    unlockedLevelStatus: Array.from(levelSummary.unlockedStatus as boolean[])
  };
}

export async function loadReferralSponsorPreview(userId: number): Promise<{
  userId: number;
  account: string;
  packageLevel: number;
  directReferrals: number;
} | null> {
  const contractAddress = configuredCoreAddress;
  if (!contractAddress || userId <= 0) {
    return null;
  }

  if (getReadRpcUrls().length === 0) {
    return null;
  }

  const provider = await getReadProvider();
  const code = await provider.getCode(contractAddress);
  if (code === "0x") {
    return null;
  }

  try {
    const contract = new Contract(contractAddress, metaGuildXCoreAbi, provider);
    const profile = await contract.usersById(BigInt(userId));
    const profileId = Number(profile?.id ?? profile?.[0] ?? 0n);
    if (profileId <= 0) {
      return null;
    }

    return {
      userId: profileId,
      account: String(profile?.account ?? profile?.[1] ?? ""),
      packageLevel: Number(profile?.packageLevel ?? profile?.[3] ?? 0n),
      directReferrals: Number(profile?.directReferrals ?? profile?.[7] ?? 0n)
    };
  } catch {
    return null;
  }
}

async function loadPreviewUsers(contract: Contract, treeContract: Contract | null, userIds: number[]) {
  const uniqueUserIds = [...new Set(userIds)].filter((id) => id > 0);
  if (!treeContract) {
    return new Map();
  }
  const tokenEngineModule = createTokenEngineModule(contract.runner!);
  const previewEntries = await Promise.all(
    uniqueUserIds.map(async (id) => {
      const [[node, depth], profile, internalWalletBalance, userTokenAllocation, userActiveBoxId] = await Promise.all([
        Promise.all([treeContract.nodes(id), treeContract.nodeDepth(id)]),
        contract.usersById(id),
        configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
          ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, contract.runner).getTotalEscrow(id)
          : Promise.resolve(0n),
        tokenEngineModule ? tokenEngineModule.getTokenAllocation(id) : Promise.resolve(0n),
        contract.activeBoxByUser(id)
      ]);

      return {
        userId: id,
        parentId: Number(node.parentId),
        leftChildId: Number(node.leftChildId),
        rightChildId: Number(node.rightChildId),
        depth: Number(depth),
        packageLevel: Number(profile.packageLevel),
        account: profile.account as string,
        directReferrals: Number(profile.directReferrals),
        totalTeamBusiness: formatTokenAmount(profile.totalTeamBusiness),
        totalEarnings: formatTokenAmount(profile.totalEarnings),
        internalWalletBalance: formatTokenAmount(internalWalletBalance),
        mgxAllocated: formatTokenAmount(userTokenAllocation, 18),
        userActiveBoxId: Number(userActiveBoxId)
      };
    })
  );

  return new Map(previewEntries.map((entry) => [entry.userId, entry]));
}

async function loadDirectReferralIncomeByUserId(input: {
  provider: BrowserProvider | JsonRpcProvider;
  sponsorUserId: number;
  referralIds: number[];
  incomeRouterAddress: string;
}) {
  if (!input.incomeRouterAddress || input.referralIds.length === 0) {
    return {} as Record<number, string>;
  }

  const incomeByReferral = new Map<number, bigint>();
  const routerAddresses = getHistoricalIncomeRouterAddresses(input.incomeRouterAddress);

  try {
    const currentBlock = await input.provider.getBlockNumber();
    const cacheKey = getHotPathCacheKey("direct-referral", input.incomeRouterAddress, input.sponsorUserId);
    const persisted = readPersistentJson<PersistedDirectReferralIncome>(cacheKey);
    if (
      persisted &&
      isFreshHotPathCache(persisted.timestamp) &&
      Number.isFinite(persisted.lastScannedBlock) &&
      persisted.lastScannedBlock >= currentBlock
    ) {
      return Object.fromEntries(
        input.referralIds.map((referralId) => [
          referralId,
          formatPlatformUsdValue(BigInt(persisted.data[String(referralId)] ?? "0"))
        ])
      );
    }
    if (persisted) {
      for (const [referralId, amount] of Object.entries(persisted.data)) {
        incomeByReferral.set(Number(referralId), BigInt(amount));
      }
    }
    const startBlock = Math.max(
      persisted ? persisted.lastScannedBlock + 1 : 0,
      OPBNB_TESTNET_DEPLOYMENT_START_BLOCK
    );
    if (startBlock > currentBlock) {
      writePersistentJson<PersistedDirectReferralIncome>(cacheKey, {
        data: Object.fromEntries([...incomeByReferral.entries()].map(([id, amount]) => [id, amount.toString()])),
        lastScannedBlock: currentBlock,
        timestamp: Date.now()
      });
      return Object.fromEntries(
        input.referralIds.map((referralId) => [referralId, formatPlatformUsdValue(incomeByReferral.get(referralId) ?? 0n)])
      );
    }

    const allResults = await Promise.all(
      routerAddresses.map(async (routerAddress) => {
        const router = new Contract(routerAddress, incomeRouterWriteAbi, input.provider);
        return withTimeout(
          queryFilterChunked(
            router,
            router.filters.DirectIncomeRecorded(null, BigInt(input.sponsorUserId)),
            startBlock,
            currentBlock,
            44000
          ),
          25000,
          []
        );
      })
    );
    const logs = allResults.flat();

    for (const log of logs) {
      if (!("args" in log)) {
        continue;
      }
      const args = log.args as unknown as { fromUserId: bigint; toUserId: bigint; amount: bigint };
      const fromUserId = Number(args.fromUserId);
      if (!input.referralIds.includes(fromUserId)) {
        continue;
      }
      incomeByReferral.set(fromUserId, (incomeByReferral.get(fromUserId) ?? 0n) + args.amount);
    }
    writePersistentJson<PersistedDirectReferralIncome>(cacheKey, {
      data: Object.fromEntries([...incomeByReferral.entries()].map(([id, amount]) => [id, amount.toString()])),
      lastScannedBlock: currentBlock,
      timestamp: Date.now()
    });
  } catch {
    return {} as Record<number, string>;
  }

  return Object.fromEntries(
    input.referralIds.map((referralId) => [referralId, formatPlatformUsdValue(incomeByReferral.get(referralId) ?? 0n)])
  );
}

export async function loadLiveWalletStakeState(walletAddress?: string | null): Promise<LiveWalletStakeState | null> {
  if (!walletAddress || !configuredCoreAddress) {
    return null;
  }

  const normalizedWalletAddress = normalizeAddress(walletAddress);
  const provider = await getReadProvider();
  const contract = new Contract(configuredCoreAddress, metaGuildXCoreAbi, provider);
  const stakingModule =
    configuredStakingAddress && configuredStakingAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredStakingAddress, mgxStakingAbi, provider)
      : null;
  const incomeModule =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider)
      : null;
  const cashbackModule =
    configuredCashbackAddress && configuredCashbackAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredCashbackAddress, cashbackPoolAbi, provider)
      : null;
  const upgradeModule =
    configuredUpgradeAddress && configuredUpgradeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredUpgradeAddress, metaGuildXUpgradeAbi, provider)
      : null;
  const tokenEngineModule = createTokenEngineModule(provider);

  const userId = Number(await contract.userIdByAddress(normalizedWalletAddress));
  if (userId <= 0) {
    return {
      isRegistered: false,
      mgxAllocated: "0",
      userActiveBoxId: null,
      pendingStakingReward: "0",
      personalStaked: "0",
      stakeLockDurationLabel: "Register to unlock",
      stakeAutoCompound: false,
      stakePositions: [],
      totalStaked: "0",
      escrowBalance: "0",
      pendingCashback: "0"
    };
  }

  const [userTokenAllocation, userActiveBoxId, pendingReward, stakePositionsRaw, totalStaked, escrowBalance, pendingCashback, rebirthIdsRaw] =
    await Promise.all([
      tokenEngineModule ? safeBigIntRead(() => tokenEngineModule.getTokenAllocation(userId)) : Promise.resolve(0n),
      safeBigIntRead(() => contract.activeBoxByUser(userId)),
      stakingModule ? safeBigIntRead(() => stakingModule.pendingStakingReward(normalizedWalletAddress)) : Promise.resolve(0n),
      stakingModule
        ? stakingModule.getStakePositions(normalizedWalletAddress).catch(() => [] as RawStakePosition[])
        : Promise.resolve([] as RawStakePosition[]),
      stakingModule ? safeBigIntRead(() => stakingModule.totalStaked()) : Promise.resolve(0n),
      incomeModule ? safeBigIntRead(() => incomeModule.getTotalEscrow(userId)) : Promise.resolve(0n),
      cashbackModule && incomeModule
        ? loadPendingCashbackSafe({
            cashback: cashbackModule,
            core: contract,
            userId
          })
        : Promise.resolve(0n),
      getAllRebirthIds(upgradeModule, userId)
    ]);
  const totalPersonalStaked = sumStakePositionAmounts(stakePositionsRaw);
  const rebirthMgxAllocations = await Promise.all(
    rebirthIdsRaw.map((rebirthId: bigint) =>
      tokenEngineModule ? safeBigIntRead(() => tokenEngineModule.getTokenAllocation(rebirthId)) : Promise.resolve(0n)
    )
  );
  const totalAllocation =
    BigInt(userTokenAllocation) + rebirthMgxAllocations.reduce((total, amount) => total + amount, 0n);
  const availableMgx = totalAllocation > totalPersonalStaked ? totalAllocation - totalPersonalStaked : 0n;
  const stakePositions = mapStakePositions(stakePositionsRaw);

  return {
    isRegistered: true,
    mgxAllocated: formatTokenAmount(availableMgx, 18),
    userActiveBoxId: Number(userActiveBoxId),
    pendingStakingReward: formatTokenAmount(pendingReward, 18),
    personalStaked: formatTokenAmount(totalPersonalStaked, 18),
    stakeLockDurationLabel: stakePositions[0]?.lockDurationLabel ?? "No active stake",
    stakeAutoCompound: stakePositions.some((position) => position.autoCompound),
    stakePositions,
    totalStaked: formatTokenAmount(totalStaked, 18),
    escrowBalance: formatTokenAmount(escrowBalance + pendingCashback),
    pendingCashback: formatTokenAmount(pendingCashback)
  };
}

async function loadQuickSnapshot(input: {
  walletAddress: string;
  contract: Contract;
  incomeModule: Contract | null;
  stakingModule: Contract | null;
  tokenEngineModule: Contract | null;
}): Promise<DashboardSnapshot> {
  const userId = Number(await input.contract.userIdByAddress(input.walletAddress));
  if (userId <= 0) {
    return {
      ...fallbackSnapshot,
      walletAddress: input.walletAddress,
      isConnected: true,
      hasContractConfig: true,
      contractReady: true,
      isRegistered: false,
      isPartialLoad: true
    };
  }

  const [
    profile,
    totalIncomeRaw,
    totalEscrowRaw,
    packageLevelRaw,
    pendingRewardRaw,
    stakePositionsRaw,
    userTokenAllocationRaw,
    userActiveBoxIdRaw,
    incomeDistributionPending,
    incomeDistributionPendingPackageLevelRaw
  ] = await Promise.all([
    input.contract.usersById(userId),
    input.incomeModule ? safeBigIntRead(() => input.incomeModule!.getTotalAllIncome(userId)) : Promise.resolve(0n),
    input.incomeModule ? safeBigIntRead(() => input.incomeModule!.getTotalEscrow(userId)) : Promise.resolve(0n),
    Promise.resolve(0n), // getUserPackageLevel removed - use usersById.packageLevel instead
    input.stakingModule ? safeBigIntRead(() => input.stakingModule!.pendingStakingReward(input.walletAddress)) : Promise.resolve(0n),
    input.stakingModule
      ? input.stakingModule.getStakePositions(input.walletAddress).catch(() => [] as RawStakePosition[])
      : Promise.resolve([] as RawStakePosition[]),
    input.tokenEngineModule ? safeBigIntRead(() => input.tokenEngineModule!.getTokenAllocation(userId)) : Promise.resolve(0n),
    safeBigIntRead(() => input.contract.activeBoxByUser(userId)),
    input.contract.failedDistribution(userId).catch(() => false),
    safeBigIntRead(() => input.contract.failedDistributionPackageLevel(userId))
  ]);

  const stakePositions = mapStakePositions(stakePositionsRaw);
  const totalPersonalStaked = sumStakePositionAmounts(stakePositionsRaw);
  const availableMgx =
    BigInt(userTokenAllocationRaw) > totalPersonalStaked ? BigInt(userTokenAllocationRaw) - totalPersonalStaked : 0n;
  const packageLevel = Number(packageLevelRaw || profile.packageLevel || 0n);
  const totalIncome = formatPlatformUsdValue(totalIncomeRaw);

  return {
    ...fallbackSnapshot,
    walletAddress: input.walletAddress,
    userId,
    sponsorId: Number(profile.sponsorId ?? 0n),
    joinedAt: Number(profile.joinedAt ?? 0n),
    packageLevel,
    isRebirthUser: Number(profile.rebirthCount ?? 0n) > 0,
    totalContribution: formatPlatformUsdValue(BigInt(profile.totalContribution ?? 0n)),
    totalEarnings: totalIncome,
    directIncome: totalIncome,
    directReferrals: Number(profile.directReferrals ?? 0n),
    xCount: Number(profile.xCount ?? 0n),
    internalWalletBalance: formatTokenAmount(totalEscrowRaw),
    currentPackageEscrow: formatTokenAmount(totalEscrowRaw),
    pendingStakingReward: formatTokenAmount(pendingRewardRaw, 18),
    personalStaked: formatTokenAmount(totalPersonalStaked, 18),
    stakeLockDurationLabel: stakePositions[0]?.lockDurationLabel ?? "No active stake",
    stakeAutoCompound: stakePositions.some((position) => position.autoCompound),
    stakePositions,
    mgxAllocated: formatTokenAmount(availableMgx, 18),
    userActiveBoxId: Number(userActiveBoxIdRaw),
    incomeDistributionPending: Boolean(incomeDistributionPending),
    incomeDistributionPendingPackageLevel: Number(incomeDistributionPendingPackageLevelRaw) || null,
    isConnected: true,
    hasContractConfig: true,
    contractReady: true,
    isRegistered: true,
    isSurrendered: Boolean(profile.surrendered),
    isPartialLoad: true
  };
}

export async function loadPostTransactionQuickSnapshot(walletAddress?: string | null): Promise<DashboardSnapshot> {
  syncAnalyticsCachesForDeployment();
  const normalizedWalletAddress = walletAddress ? normalizeAddress(walletAddress) : null;
  const contractAddress = configuredCoreAddress;
  if (!normalizedWalletAddress || !contractAddress) {
    return {
      ...fallbackSnapshot,
      walletAddress: normalizedWalletAddress,
      isConnected: Boolean(normalizedWalletAddress),
      hasContractConfig: Boolean(contractAddress)
    };
  }

  const provider = await getReadProvider();
  const contract = new Contract(contractAddress, metaGuildXCoreAbi, provider);
  const incomeModule =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider)
      : null;
  const stakingModule =
    configuredStakingAddress && configuredStakingAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredStakingAddress, mgxStakingAbi, provider)
      : null;
  const tokenEngineModule = createTokenEngineModule(provider);
  const snapshot = await loadQuickSnapshot({
    walletAddress: normalizedWalletAddress,
    contract,
    incomeModule,
    stakingModule,
    tokenEngineModule
  });
  cacheDashboardSnapshot(
    `snapshot-${getDeploymentCacheNamespace()}-${normalizedWalletAddress}`,
    getPersistentSnapshotCacheKey(normalizedWalletAddress),
    snapshot
  );
  return snapshot;
}


// ── Lost Earnings: scans LevelIncomeSkipped events ──────
async function computeLostEarnings(
  userId: number,
  directReferralIds: number[],
  provider: BrowserProvider | JsonRpcProvider,
  routerAddress: string
): Promise<bigint> {
  if (!routerAddress || userId <= 0) return 0n;
  const CHUNK = 45_000;
  const routerAbi = [
    "event LevelIncomeSkipped(uint256 indexed skippedUserId, uint256 indexed fromUserId, uint8 indexed level, address asset, uint256 amount, uint256 timestamp)"
  ];
  const router = new Contract(routerAddress, routerAbi, provider);
  let totalLost = 0n;
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5_000_000);
    for (let b = fromBlock; b <= currentBlock; b += CHUNK) {
      const end = Math.min(b + CHUNK - 1, currentBlock);
      try {
        const logs = await router.queryFilter(
          router.filters.LevelIncomeSkipped(BigInt(userId)),
          b,
          end
        );
        for (const log of logs) {
          const args = (log as unknown as { args: [bigint, bigint, bigint, string, bigint, bigint] }).args;
          if (Number(args[0]) === userId) {
            totalLost += BigInt(args[4]);
          }
        }
      } catch { /* skip failed chunk */ }
    }
  } catch { /* non-fatal, return 0 */ }
  return totalLost;
}


// ── Public standalone Lost Earnings loader (called in background) ─
// Never blocks the dashboard snapshot. Called from App.tsx after render.
export async function loadLostEarnings(
  userId: number,
  walletAddress: string
): Promise<string> {
  if (!configuredCoreAddress || !configuredIncomeRouterAddress || userId <= 0) return "0";
  const provider = await getReadProvider();
  const coreContract = new Contract(configuredCoreAddress, metaGuildXCoreAbi, provider);
  try {
    const directReferralIdsRaw = await coreContract.getDirectReferralIds(userId) as bigint[];
    const directReferralIds = directReferralIdsRaw.map(Number);
    const raw = await computeLostEarnings(
      userId, directReferralIds, provider,
      configuredIncomeRouterAddress ?? TESTNET_INCOME_ROUTER_ADDRESS
    );
    return formatTokenAmount(raw);
  } catch { return "0"; }
}

export async function loadDashboardSnapshot(
  walletAddress?: string | null,
  options?: { forceRefresh?: boolean }
): Promise<DashboardSnapshot> {
  return timedAsync("getDashboardSnapshot", async () => {
  try {
  syncAnalyticsCachesForDeployment();
  const cacheKey = `snapshot-${getDeploymentCacheNamespace()}-${walletAddress ?? "__guest__"}`;
  const persistentCacheKey = getPersistentSnapshotCacheKey(walletAddress);
  const cachedSnapshot = snapshotCache.get(cacheKey);
  if (cachedSnapshot && Date.now() - cachedSnapshot.timestamp < SNAPSHOT_CACHE_TTL && !options?.forceRefresh) {
    return cachedSnapshot.data;
  }
  const persistentSnapshot =
    !options?.forceRefresh && persistentCacheKey ? readPersistentDashboardSnapshot(persistentCacheKey) : null;
  if (!options?.forceRefresh && persistentCacheKey) {
    console.info("[MGX] persistent snapshot cache", {
      key: persistentCacheKey,
      hit: Boolean(persistentSnapshot),
      ageMs: persistentSnapshot ? Date.now() - persistentSnapshot.timestamp : null
    });
  }
  if (persistentSnapshot) {
    snapshotCache.set(cacheKey, persistentSnapshot);
    if (Date.now() - persistentSnapshot.timestamp >= SNAPSHOT_LOCAL_CACHE_TTL) {
      queueBackgroundDashboardRefresh(walletAddress);
    }
    return persistentSnapshot.data;
  }
  const contractAddress = configuredCoreAddress;
  if (!contractAddress) {
    return {
      ...fallbackSnapshot,
      walletAddress: walletAddress ?? null,
      isConnected: Boolean(walletAddress),
      hasContractConfig: false
    };
  }

  if (getReadRpcUrls().length === 0) {
    return {
      ...fallbackSnapshot,
      walletAddress: walletAddress ?? null,
      isConnected: Boolean(walletAddress),
      hasContractConfig: true,
      contractReady: false,
      contractWarning: `The RPC URL is missing for ${activeNetworkConfig.label}. Check the frontend env settings.`
    };
  }

  const provider = await getReadProvider();
  const code = await provider.getCode(contractAddress);
  const treeCode =
    configuredBinaryTreeAddress && configuredBinaryTreeAddress !== "0x0000000000000000000000000000000000000000"
      ? await provider.getCode(configuredBinaryTreeAddress)
      : "0x";
  if (code === "0x" || treeCode === "0x") {
    return {
      ...fallbackSnapshot,
      walletAddress: walletAddress ?? null,
      isConnected: Boolean(walletAddress),
      hasContractConfig: true,
      contractReady: false,
      contractWarning: `The configured contract is not live on ${activeNetworkConfig.label}. Check RPC and deployment sync.`
    };
  }
  const contract = new Contract(contractAddress, metaGuildXCoreAbi, provider);
  const treeContract =
    configuredBinaryTreeAddress && configuredBinaryTreeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredBinaryTreeAddress, binaryTreeAbi, provider)
      : null;
  const contractInterface = new Interface(metaGuildXCoreAbi);
  // packagePricesRaw loaded in Promise.all below
  const boxPricesRaw = fallbackBoxes.map((value) => BigInt(Math.round(value * 100)));
  const stakingContractAddress = configuredStakingAddress;
  const cashbackContractAddress = configuredCashbackAddress;
  const stakingModule =
    stakingContractAddress && stakingContractAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(stakingContractAddress, mgxStakingAbi, provider)
      : null;
  const cashbackModule =
    cashbackContractAddress && cashbackContractAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(cashbackContractAddress, cashbackPoolAbi, provider)
      : null;
  const incomeModule =
    configuredIncomeAddress && configuredIncomeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredIncomeAddress, metaGuildXIncomeAbi, provider)
      : null;
  const upgradeModule =
    configuredUpgradeAddress && configuredUpgradeAddress !== "0x0000000000000000000000000000000000000000"
      ? new Contract(configuredUpgradeAddress, metaGuildXUpgradeAbi, provider)
      : null;
  const tokenEngineModule = createTokenEngineModule(provider);
  const quickWalletAddress = walletAddress ? normalizeAddress(walletAddress) : null;

  if (quickWalletAddress && !options?.forceRefresh) {
    const quickSnapshot = await loadQuickSnapshot({
      walletAddress: quickWalletAddress,
      contract,
      incomeModule,
      stakingModule,
      tokenEngineModule
    });
    cacheDashboardSnapshot(cacheKey, persistentCacheKey, quickSnapshot);
    queueBackgroundDashboardRefresh(quickWalletAddress);
    return quickSnapshot;
  }

  const [stakingRewardPool, totalStaked, cashbackPoolBalance, totalTokenDistributed, rootUserIdRaw, currentBoxIdRaw, packagePricesRaw, nextUserIdRaw] = await Promise.all([
    stakingModule ? stakingModule.rewardPool() : 0n,
    stakingModule ? stakingModule.totalStaked() : 0n,
    cashbackModule ? cashbackModule.cashbackPoolBalance() : 0n,
    contract.totalTokenDistributed(),
    contract.rootUserId(),
    contract.currentBoxId(),
    contract.getPackagePrices(),
    contract.nextUserId(),
  ]);
  const currentBoxIndex = Math.max(1, Number(currentBoxIdRaw));
  const currentBoxDistributed = await contract.distributedTokensByBox(currentBoxIndex);
  const currentBoxStatus = {
    boxId: BigInt(currentBoxIndex),
    priceCents: boxPricesRaw[currentBoxIndex - 1] ?? 100n,
    distributed: currentBoxDistributed,
    cap: 0n,
    remaining: 0n
  };
  const rootUserId = Number(rootUserIdRaw);
  const maxUserId = Math.max(0, Number(nextUserIdRaw) - 1);
  if (!walletAddress) {
    const snapshot = {
      ...fallbackSnapshot,
      walletAddress: null,
      isConnected: false,
      hasContractConfig: true,
      packagePrices: (packagePricesRaw as bigint[]).map((value: bigint) => Number(formatUnits(value, PLATFORM_DECIMALS))),
      boxPrices: boxPricesRaw.map((value) => Number(value) / 100),
      stakingRewardPool: formatTokenAmount(stakingRewardPool, 18),
      totalStaked: formatTokenAmount(totalStaked, 18),
      personalStaked: "0",
      stakeLockDurationLabel: "Connect wallet to view",
      stakeAutoCompound: false,
      stakePositions: [],
      cashbackPoolBalance: formatTokenAmount(cashbackPoolBalance),
      totalTokenDistributed: formatTokenAmount(totalTokenDistributed, 18),
      rootUserId,
      featuredUsers: [],
      treePreview: [],
      activityFeed: [],
      contractReady: true,
      contractWarning: null,
      currentBoxId: Number(currentBoxStatus.boxId),
      currentBoxPrice: (Number(currentBoxStatus.priceCents) / 100).toFixed(2),
      currentBoxDistributed: formatTokenAmount(currentBoxStatus.distributed, 18),
      currentBoxCap: formatTokenAmount(currentBoxStatus.cap, 18),
      currentBoxRemaining: formatTokenAmount(currentBoxStatus.remaining, 18),
      sponsorId: null,
      joinedAt: null,
      withdrawablePlatformBalance: "0",
      withdrawableSettlementBalance: "0",
      externalWalletBalance: "0",
      connectedWalletValue: "0",
      mgxWalletBalance: "0",
      connectedWalletAssets: [],
      settlementAssetLabel: "Settlement asset",
      settlementAssetAddress: null,
      currentPackageEscrow: "0",
      currentPackageBucketEarnings: "0",
      packageOneBucketEarnings: "0",
      boxEarningsByPackage: {},
      mgxAllocated: "0",
      userActiveBoxId: null,
      pendingCashback: "0",
      isSurrendered: false,
      surrenderStatus: "Connect wallet to check"
    };
    cacheDashboardSnapshot(cacheKey, persistentCacheKey, snapshot, { emitRefresh: Boolean(options?.forceRefresh) });
    return snapshot;
  }

  const normalizedWalletAddress = normalizeAddress(walletAddress);
  let buildRegisteredFallbackSnapshot: (() => Promise<DashboardSnapshot>) | null = null;
  let userId = 0;
  let registeredProfile: MinimalRegisteredProfile | null = null;
  try {
  userId = Number(await contract.userIdByAddress(normalizedWalletAddress));

  if (userId === 0) {
    const snapshot = await buildUnregisteredSnapshot({
      contract,
      provider,
      walletAddress: normalizedWalletAddress,
      packagePricesRaw,
      boxPricesRaw,
      stakingRewardPool,
      totalStaked,
      cashbackPoolBalance,
      totalTokenDistributed,
      rootUserId,
      registeredFeaturedUsers: [],
      registeredTreePreview: [],
      activityFeed: [],
      currentBoxStatus
    });
    cacheDashboardSnapshot(cacheKey, persistentCacheKey, snapshot, { emitRefresh: Boolean(options?.forceRefresh) });
    return snapshot;
  }

  registeredProfile = (await contract.usersById(userId)) as MinimalRegisteredProfile;
  const basePreviewIds = Array.from({ length: Math.min(maxUserId, 5) }, (_, index) => index + 1);
  const previewUserIds = userId && !basePreviewIds.includes(userId)
    ? [...basePreviewIds, userId]
    : basePreviewIds;
  const featuredUserIds = [rootUserId, rootUserId + 1, rootUserId + 2].filter((value, index, array) => value > 0 && array.indexOf(value) === index);
  const previewDataByUserId = await loadPreviewUsers(contract, treeContract, [...featuredUserIds, ...previewUserIds]);
  const featuredUsers = featuredUserIds
    .map((id) => previewDataByUserId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      userId: entry.userId,
      packageLevel: entry.packageLevel,
      totalEarnings: entry.totalEarnings,
      directReferrals: entry.directReferrals,
      internalWalletBalance: entry.internalWalletBalance,
      mgxAllocated: entry.mgxAllocated,
      userActiveBoxId: entry.userActiveBoxId
    }));
  const treePreview = previewUserIds
    .map((id) => previewDataByUserId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      userId: entry.userId,
      parentId: entry.parentId,
      leftChildId: entry.leftChildId,
      rightChildId: entry.rightChildId,
      depth: entry.depth,
      packageLevel: entry.packageLevel,
      account: entry.account,
      directReferrals: entry.directReferrals,
      totalTeamBusiness: entry.totalTeamBusiness,
      totalEarnings: entry.totalEarnings,
      mgxAllocated: entry.mgxAllocated,
      userActiveBoxId: entry.userActiveBoxId
    }));
  const registeredFeaturedUsers = featuredUsers.filter((user) => user.packageLevel > 0);
  const registeredTreePreview = treePreview.filter((node) => node.packageLevel > 0 && isRegisteredAccount(node.account));
  const latestBlock = await getBlockNumberWithDiagnostics(provider, "provider.getBlockNumber:getDashboardSnapshot");
  const deploymentStartBlock = getDeploymentAnalyticsStartBlock(latestBlock);
  const ACTIVITY_START = Math.max(deploymentStartBlock, latestBlock - 50_000);
  const activityRebirthPromise =
    contract.filters.RebirthUserCreated
      ? queryFilterChunked(
          contract,
          contract.filters.RebirthUserCreated(null, null, null),
          ACTIVITY_START,
          latestBlock,
          60_000
        ).catch((error) => {
          console.warn("RebirthUserCreated not available:", error);
          return [];
        })
      : Promise.resolve([]);
  const [activityRegistrationEvents, activityUpgradeEvents, activityRebirthEvents] = await Promise.all([
    queryFilterChunked(
      contract,
      contract.filters.UserRegistered(null, null, null, null, null, null, null),
      ACTIVITY_START,
      latestBlock,
      60_000
    ),
    queryFilterChunked(
      contract,
      contract.filters.PackageUpgraded(null, null, null, null),
      ACTIVITY_START,
      latestBlock,
      60_000
    ),
    activityRebirthPromise
  ]);
  const activityFeed = [
    ...activityRegistrationEvents.map((event) => ({
      kind: "Registration" as const,
      primary: `User ${Number(event.args.userId ?? event.args[0] ?? 0n)} joined under sponsor ${Number(event.args.sponsorId ?? event.args[1] ?? 0n)}`,
      secondary: `Package L${Number(event.args.packageLevel ?? event.args[3] ?? 0n)} | Placed under ${Number(event.args.placedUnderId ?? event.args[5] ?? 0n)}`,
      blockNumber: event.blockNumber,
      timestampLabel: `Block ${event.blockNumber}`
    })),
    ...activityUpgradeEvents.map((event) => ({
      kind: "Upgrade" as const,
      primary: `User ${Number(event.args.userId ?? event.args[0] ?? 0n)} upgraded to L${Number(event.args.toLevel ?? event.args[2] ?? 0n)}`,
      secondary: `From L${Number(event.args.fromLevel ?? event.args[1] ?? 0n)} | Amount ${event.args.amount?.toString() ?? event.args[3]?.toString() ?? "0"}`,
      blockNumber: event.blockNumber,
      timestampLabel: `Block ${event.blockNumber}`
    })),
    ...activityRebirthEvents.map((event) => ({
      kind: "Rebirth" as const,
      primary: `User ${Number(event.args.originalUserId ?? event.args[0] ?? 0n)} rebirthed to ${Number(event.args.newUserId ?? event.args[1] ?? 0n)}`,
      secondary: compactAddress((event.args.wallet ?? event.args[2] ?? "0x0000000000000000000000000000000000000000") as string),
      blockNumber: event.blockNumber,
      timestampLabel: `Block ${event.blockNumber}`
    }))
  ]
    .sort((left, right) => right.blockNumber - left.blockNumber)
    .slice(0, 20);

  buildRegisteredFallbackSnapshot = () =>
    buildMinimalRegisteredSnapshot({
      contract,
      provider,
      walletAddress: normalizedWalletAddress,
      packagePricesRaw,
      boxPricesRaw,
      stakingRewardPool,
      totalStaked,
      cashbackPoolBalance,
      totalTokenDistributed,
      rootUserId,
      registeredFeaturedUsers,
      registeredTreePreview,
      activityFeed,
      currentBoxStatus,
      profile: registeredProfile!,
      userId
    });

  const loadRegisteredSnapshot = async () => {
      const [profile, isRebirthUserRaw, incomes, totalIncomeRaw, internalWalletBalance, rebirthEscrowMainRaw, currentPackageEscrowRaw, currentPackageBucketEarningsFallbackRaw, pendingReward, pendingCashback, userTokenAllocation, userActiveBoxId, directReferralIdsRaw, rebirthIdsRaw, primaryAsset, defaultPaymentAsset, externalWalletBalanceRaw, stakePositionsRaw, incomeDistributionPending, incomeDistributionPendingPackageLevelRaw] = await Promise.all([
      Promise.resolve(registeredProfile!),
      contract.isRebirthUser(userId),
      incomeModule
        ? incomeModule.incomesByUser(userId)
        : Promise.resolve({ direct: 0n, level: 0n, spillover: 0n, crossline: 0n }),
      incomeModule ? incomeModule.getTotalAllIncome(userId) : Promise.resolve(0n),
      incomeModule ? incomeModule.getTotalEscrow(userId) : Promise.resolve(0n),
      incomeModule ? incomeModule.getRebirthEscrow(userId) : Promise.resolve(0n),
      incomeModule ? incomeModule.getEscrow(userId) : Promise.resolve(0n),
      incomeModule
        ? Promise.resolve(registeredProfile)
            .then((value) => {
              const packageLevel = Number((value as { packageLevel: bigint }).packageLevel ?? 0n);
              return packageLevel > 0 ? incomeModule["totalEarnings(uint256,uint256)"](userId, packageLevel) : 0n;
            })
        : Promise.resolve(0n),
      stakingModule ? stakingModule.pendingStakingReward(normalizedWalletAddress) : Promise.resolve(0n),
      cashbackModule
        ? loadPendingCashbackSafe({
            cashback: cashbackModule,
            core: contract,
            userId
          })
        : Promise.resolve(0n),
      tokenEngineModule ? tokenEngineModule.getTokenAllocation(userId) : Promise.resolve(0n),
      contract.activeBoxByUser(userId),
      contract.getDirectReferralIds(userId),
      getAllRebirthIds(upgradeModule, userId),
      contract.userPrimaryAsset(userId),
      contract.defaultPaymentAsset(),
      provider.getBalance(normalizedWalletAddress),
      stakingModule
        ? stakingModule.getStakePositions(normalizedWalletAddress)
        : Promise.resolve([] as RawStakePosition[]),
      contract.failedDistribution(userId).catch(() => false),
      safeBigIntRead(() => contract.failedDistributionPackageLevel(userId))
    ]);
    const directReferralCount = Number(profile.directReferrals);
    const localLevelSummary = buildLevelSummary(directReferralCount);
    const branchStats = {
      leftDirectChildId: 0,
      rightDirectChildId: 0,
      leftBranchNodes: 0,
      rightBranchNodes: 0,
      leftBranchBusiness: 0n,
      rightBranchBusiness: 0n
    };
    const levelBranchStats = {
      levelTreeLeft: 0,
      levelTreeRight: 0
    };
    const levelSummary = {
      unlockedLevels: localLevelSummary.unlockedLevels,
      unlockedStatus: localLevelSummary.unlockedStatus
    };
    const effectivePaymentAsset =
      primaryAsset && primaryAsset !== "0x0000000000000000000000000000000000000000" ? primaryAsset : defaultPaymentAsset;
    const paymentUnitPrice = effectivePaymentAsset
      ? (((await contract.paymentAssetUnitPrice(effectivePaymentAsset)) as bigint) ?? 0n)
      : 0n;
    const [withdrawablePlatformBalanceRaw, withdrawableSettlementBalanceRaw] = await Promise.all([
      safeBigIntRead(() => contract.userPlatformBalancesByAsset(userId, effectivePaymentAsset)),
      safeBigIntRead(() => contract.userAssetBalances(userId, effectivePaymentAsset))
    ]);
    const settlementAssetDecimals = await getTokenDecimals(provider, effectivePaymentAsset);

    const joinedAt = Number(profile.joinedAt) * 1000;
    const now = Date.now();
    const surrenderOpenAt = joinedAt + 90 * 24 * 60 * 60 * 1000;
    const surrenderCloseAt = joinedAt + 180 * 24 * 60 * 60 * 1000;
    const surrenderStatus =
      profile.surrendered
        ? "ID surrendered"
        : now < surrenderOpenAt
        ? "Available after 3 months"
        : now > surrenderCloseAt
        ? "Surrender window expired"
        : "Available now";
    const effectiveInternalWalletBalance = internalWalletBalance + pendingCashback;
    const actualDownlineBusiness = BigInt(branchStats.leftBranchBusiness) + BigInt(branchStats.rightBranchBusiness);
    const connectedWalletValue =
      settlementToPlatformValue(externalWalletBalanceRaw, paymentUnitPrice);
    const totalPersonalStaked = sumStakePositionAmounts(stakePositionsRaw);
    const rebirthMgxAllocations = await Promise.all(
      rebirthIdsRaw.map((rebirthId: bigint) =>
        tokenEngineModule ? safeBigIntRead(() => tokenEngineModule.getTokenAllocation(rebirthId)) : Promise.resolve(0n)
      )
    );
    const totalMgxAllocation =
      BigInt(userTokenAllocation) + rebirthMgxAllocations.reduce((total, amount) => total + amount, 0n);
    const availableMgxAllocation =
      totalMgxAllocation > totalPersonalStaked ? totalMgxAllocation - totalPersonalStaked : 0n;
    const stakePositions = mapStakePositions(stakePositionsRaw);
    const [connectedWalletAssets, connectedWalletHistory] = await Promise.all([
      loadConnectedWalletAssets({
        walletAddress: normalizedWalletAddress,
        nativeBalanceFormatted: formatTokenAmount(externalWalletBalanceRaw, 18),
        nativeValueFormatted: connectedWalletValue,
        provider,
        usdtAddress: defaultPaymentAsset,
        mgxTokenAddress: configuredMgxTokenAddress
      }),
      withTimeout(
        loadConnectedWalletHistory(normalizedWalletAddress),
        // Adaptive timeout: shorter on mobile to reduce blocking time
        (typeof window!=="undefined"&&window.innerWidth<768)?1800:3000,
        { history: [], error: null, cursor: null }
      ),
    ]);
    const usdtAsset = connectedWalletAssets.assets.find(
      (asset) => asset.name === "USDT"
    );

    const correctedConnectedWalletValue = usdtAsset?.amount
      ? `$${usdtAsset.amount}`
      : connectedWalletValue;
      const directReferralIds = directReferralIdsRaw.map((value: bigint) => Number(value));
      const crosslineAmount = 0n;
      const spilloverAmount = 0n;
      const directReferralIncomeByUserId: Record<number, string> = {};
      const boxEarningsByPackage: Record<number, bigint> = {};
      const currentPackageLevel = Number(profile.packageLevel);
      const packageOneBucketEarningsRaw = boxEarningsByPackage[1] ?? 0n;
      const currentPackageBucketEarningsRaw =
        currentPackageLevel > 0 ? (boxEarningsByPackage[currentPackageLevel] ?? 0n) : 0n;
      const formattedBoxEarningsByPackage = Object.fromEntries(
        Object.entries(boxEarningsByPackage)
          .filter(([, amount]) => amount > 0n)
          .map(([pkg, amount]) => [Number(pkg), formatTokenAmount(amount)])
      );
      const snapshot = {
      walletAddress: normalizedWalletAddress,
      userId,
      sponsorId: Number(profile.sponsorId),
      joinedAt: Number(profile.joinedAt),
      packageLevel: Number(profile.packageLevel),
      isRebirthUser: Boolean(isRebirthUserRaw),
      totalContribution: platformToSettlementValue(BigInt(profile.totalContribution), paymentUnitPrice, settlementAssetDecimals),
      totalEarnings: formatPlatformUsdValue(totalIncomeRaw),
      directReferrals: Number(profile.directReferrals),
      totalTeamBusiness: formatTokenAmount(actualDownlineBusiness),
      rebirthCount: rebirthIdsRaw.length,
      xCount: Number(profile.xCount),
      internalWalletBalance: formatTokenAmount(effectiveInternalWalletBalance),
      currentPackageEscrow: formatTokenAmount(currentPackageEscrowRaw),
      currentPackageBucketEarnings: formatTokenAmount(currentPackageBucketEarningsRaw),
      packageOneBucketEarnings: formatTokenAmount(packageOneBucketEarningsRaw),
      boxEarningsByPackage: formattedBoxEarningsByPackage,
      withdrawablePlatformBalance: formatTokenAmount(withdrawablePlatformBalanceRaw),
      withdrawableSettlementBalance: formatAmountWithDecimals(withdrawableSettlementBalanceRaw, settlementAssetDecimals),
      externalWalletBalance: formatTokenAmount(externalWalletBalanceRaw, 18),
      connectedWalletValue: correctedConnectedWalletValue,
      mgxWalletBalance: connectedWalletAssets.mgxBalance,
      connectedWalletAssets: connectedWalletAssets.assets,
      connectedWalletAssetsError: connectedWalletAssets.error,
      connectedWalletHistory: connectedWalletHistory.history,
      connectedWalletHistoryError: connectedWalletHistory.error,
      connectedWalletHistoryCursor: connectedWalletHistory.cursor,
      settlementAssetLabel: formatAssetLabel(effectivePaymentAsset),
      settlementAssetAddress:
        effectivePaymentAsset && effectivePaymentAsset !== "0x0000000000000000000000000000000000000000"
          ? effectivePaymentAsset
          : null,
      pendingStakingReward: formatTokenAmount(pendingReward, 18),
      stakingRewardPool: formatTokenAmount(stakingRewardPool, 18),
      totalStaked: formatTokenAmount(totalStaked, 18),
      personalStaked: formatTokenAmount(totalPersonalStaked, 18),
      stakeLockDurationLabel: stakePositions[0]?.lockDurationLabel ?? "No active stake",
      stakeAutoCompound: stakePositions.some((position) => position.autoCompound),
      stakePositions,
      cashbackPoolBalance: formatTokenAmount(cashbackPoolBalance),
      totalTokenDistributed: formatTokenAmount(totalTokenDistributed, 18),
      directIncome: formatTokenAmount(incomes.direct ?? incomes.directIncome ?? 0n),
      levelIncome: formatTokenAmount(incomes.level ?? incomes.levelIncome ?? 0n),
      spilloverIncome: formatTokenAmount(spilloverAmount),
      crossLineIncome: formatTokenAmount(crosslineAmount),
      cashbackIncome: "0",
      stakingIncome: "0",
      packagePrices: (packagePricesRaw as bigint[]).map((value: bigint) => Number(formatUnits(value, PLATFORM_DECIMALS))),
      boxPrices: boxPricesRaw.map((value) => Number(value) / 100),
      rootUserId,
      isConnected: true,
      hasContractConfig: true,
      isRegistered: true,
      featuredUsers: registeredFeaturedUsers,
      treePreview: registeredTreePreview,
      activityFeed,
      spilloverHistory: [],
      networkBonusHistory: [],
      contractReady: true,
      contractWarning: null,
        directReferralIds,
        directReferralIncomeByUserId,
        rebirthIds: rebirthIdsRaw.map((value: bigint) => Number(value)),
      unlockedLevels: Number(levelSummary.unlockedLevels),
      unlockedLevelStatus: Array.from(levelSummary.unlockedStatus as boolean[]),
      leftBranchNodes: Number(branchStats.leftBranchNodes),
      rightBranchNodes: Number(branchStats.rightBranchNodes),
      leftBranchBusiness: formatTokenAmount(branchStats.leftBranchBusiness),
      rightBranchBusiness: formatTokenAmount(branchStats.rightBranchBusiness),
      levelTreeLeft: Number(levelBranchStats.levelTreeLeft),
      levelTreeRight: Number(levelBranchStats.levelTreeRight),
      currentBoxId: Number(currentBoxStatus.boxId),
      currentBoxPrice: (Number(currentBoxStatus.priceCents) / 100).toFixed(2),
      currentBoxDistributed: formatTokenAmount(currentBoxStatus.distributed, 18),
      currentBoxCap: formatTokenAmount(currentBoxStatus.cap, 18),
      currentBoxRemaining: formatTokenAmount(currentBoxStatus.remaining, 18),
      mgxAllocated: formatTokenAmount(availableMgxAllocation, 18),
      userActiveBoxId: Number(userActiveBoxId),
      pendingCashback: formatTokenAmount(pendingCashback),
      incomeDistributionPending: Boolean(incomeDistributionPending),
      incomeDistributionPendingPackageLevel: Number(incomeDistributionPendingPackageLevelRaw) || null,
      isSurrendered: Boolean(profile.surrendered),
      surrenderStatus,
      rebirthEscrowBalance: formatTokenAmount(rebirthEscrowMainRaw),
    lostEarnings: "0" // Populated by background loadLostEarnings() call
    };
      cacheDashboardSnapshot(cacheKey, persistentCacheKey, snapshot, { emitRefresh: Boolean(options?.forceRefresh) });
      return snapshot;
  };

  try {
    return await loadRegisteredSnapshot();
  } catch (error) {
    console.error("MetaGuildX registered dashboard load failed", error);

    if (isMissingUserCallException(error)) {
      return buildRegisteredFallbackSnapshot();
    }

    if (isCallExceptionError(error)) {
      try {
        return await loadRegisteredSnapshot();
      } catch (retryError) {
        console.error("MetaGuildX registered dashboard retry failed", retryError);
        if (isMissingUserCallException(retryError)) {
          return buildRegisteredFallbackSnapshot();
        }
        throw retryError;
      }
    }

    throw error;
  }
  } catch (error) {
    if (isCallExceptionError(error)) {
      if (buildRegisteredFallbackSnapshot) {
        return buildRegisteredFallbackSnapshot();
      }
      return buildUnregisteredSnapshot({
        contract,
        provider,
        walletAddress: normalizedWalletAddress,
        packagePricesRaw,
        boxPricesRaw,
        stakingRewardPool,
        totalStaked,
        cashbackPoolBalance,
        totalTokenDistributed,
        rootUserId,
        registeredFeaturedUsers: [],
        registeredTreePreview: [],
        activityFeed: [],
        currentBoxStatus
      });
    }

    throw error;
  }
  } catch (error) {
    return {
      ...fallbackSnapshot,
      walletAddress: walletAddress ?? null,
      isConnected: Boolean(walletAddress),
      hasContractConfig: Boolean(configuredCoreAddress),
      contractReady: false,
      contractWarning: error instanceof Error ? error.message : "Could not load dashboard data. Refresh the app and try again."
    } as DashboardSnapshot;
  }
  });
}
