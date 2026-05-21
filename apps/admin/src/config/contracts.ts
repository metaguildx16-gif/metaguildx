const ENV_CORE_ADDRESS = import.meta.env.VITE_SYSTEM_PROXY_ADDRESS;
const ENV_USDT_ADDRESS = import.meta.env.VITE_USDT_ADDRESS;

export const CONTRACTS = {
  MetaGuildXCore: ENV_CORE_ADDRESS || "0x15E37A17030BF757FE34829377c4F002888a04af",
  MetaGuildXIncome: "0x531209f17946165dAF5e1bc754D94daafc3A41D3",
  MetaGuildXUpgrade: "0x8cB5D751015B2C8D5614C46Bc79BD37DE5647c62",
  IncomeRouter: "0xcDF7B576Ff441713926232F0821256a9Fd578308",
  BinaryTree: "0x6DB5CdADC9b8b1ed75aD5bcED833ddA414BAC27D",
  CashbackPool: "0x435EF13B968c5E813FA28be42B792A34E8d44309",
  MGXStaking: "0x3B05A0e99471b662381dAdb5D14b032a2ae49bEb",
  MGXToken: "0x1DCC909306214c5985d1a1CC38bE38497Af74D66",
  USDT: ENV_USDT_ADDRESS || "0xF4975eB104932bDBcA491A9Cb985439eA03863e0"
} as const;

export const NETWORK = {
  chainId: 5611,
  name: "OPBNB Testnet",
  rpc: "https://opbnb-testnet-rpc.bnbchain.org",
  explorer: "https://opbnb-testnet.bscscan.com",
  startBlock: 162144934
} as const;

export const ABIS = {
  MetaGuildXCore: [
    "function owner() view returns (address)",
    "function nextUserId() view returns (uint256)",
    "function creatorFeeWallet() view returns (address)",
    "function placementSigner() view returns (address)",
    "function defaultPaymentAsset() view returns (address)",
    "function productionMode() view returns (bool)",
    "function binaryTreeContract() view returns (address)",
    "function incomeRouterContract() view returns (address)",
    "function incomeEngineContract() view returns (address)",
    "function upgradeEngineContract() view returns (address)",
    "function cashbackPoolContract() view returns (address)",
    "function stakingContract() view returns (address)",
    "function usdtAddress() view returns (address)",
    "function getUserPackageLevel(uint256) view returns (uint256)",
    "function getUserOriginalPackageLevel(uint256) view returns (uint8)",
    "function isRebirthUser(uint256) view returns (bool)",
    "function userIdByAddress(address) view returns (uint256)",
    "function getDirectReferralIds(uint256) view returns (uint256[])",
    "function withdrawStake(uint256 amount)",
    "function usersById(uint256) view returns (uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered)",
    "function setCreatorFeeWallet(address)",
    "function setPlacementSigner(address)",
    "function setProductionMode(bool, address)",
    "function setUsdtAddress(address)",
    "function setBinaryTreeContract(address)",
    "function setIncomeRouterContract(address)",
    "function setIncomeEngineContract(address)",
    "function setUpgradeEngineContract(address)",
    "function setCashbackPoolContract(address)",
    "function setStakingContract(address)",
    "function adminReleaseStrandedEscrow(uint256)",
    "function adminSweepToCreator(address)",
    "function transferOwnership(address newOwner)",
    "function upgradeToAndCall(address newImplementation, bytes data) payable",
    "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
    "event PackageUpgraded(uint256 indexed userId, uint8 fromLevel, uint8 toLevel, uint256 amount)",
    "event RebirthUserCreated(uint256 indexed originalUserId, uint256 indexed newUserId, address wallet)",
    "function failedDistribution(uint256) view returns (bool)",
    "function getFailedUserIds() view returns (uint256[])",
    "function adminRetryDistribution(uint256) external",
    "event DistributionFailed(uint256 indexed userId, uint256 timestamp)",
    "event DistributionRetried(uint256 indexed userId, bool success)"
  ],
  USDT: [
    "function balanceOf(address) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ],
  MetaGuildXIncome: [
    "function getEscrow(uint256) view returns (uint256)",
    "function getTotalEscrow(uint256) view returns (uint256)",
    "function getTotalIncome(uint256) view returns (uint256)",
    "function getTotalAllIncome(uint256) view returns (uint256)",
    "function totalEarnings(uint256,uint256) view returns (uint256)",
    "function escrowBalances(uint256,uint256) view returns (uint256)",
    "function incomesByUser(uint256) view returns (uint256 direct, uint256 level, uint256 spillover, uint256 crossline)",
    "function adminAddEscrow(uint256 userId, uint256 amount) external",
    "function adminReleaseEscrow(uint256 userId, uint256 amount) external",
    "function adminReleaseRebirthEscrow(uint256 userId, uint256 amount) external",
    "function rebirthEscrow(uint256 userId) view returns (uint256)",
    "function getRebirthEscrow(uint256 userId) view returns (uint256)"
  ],
  MetaGuildXUpgrade: [
    "function getRebirthIds(uint256) view returns (uint256[])"
  ],
  IncomeRouter: [
    "function creatorWallet() view returns (address)",
    "function platformReserve() view returns (uint256)",
    "function directIncomeBps() view returns (uint256)",
    "function levelIncomeBps() view returns (uint256)",
    "function cashbackBps() view returns (uint256)",
    "function creatorFeeBps() view returns (uint256)",
    "function distributeJoinIncome(uint256,uint256,uint256,uint256,address)",
    "function emergencySweep(address token, address recipient)",
    "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel)",
    "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount, uint8 cyclePkgLevel)",
    "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)",
    "event CrossLineIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)",
    "event ResidualSweptToCreator(uint256 amount)"
  ],
  CashbackPool: [
    "function cashbackPoolBalance() view returns (uint256)",
    "function cashbackPoolBalanceByAsset(address) view returns (uint256)",
    "function totalSurrenderedUsers() view returns (uint256)",
    "event CashbackClaimed(uint256 indexed userId, address indexed paymentAsset, uint256 amount, uint256 settlementAmount)",
    "event UserSurrendered(uint256 indexed userId, uint256 timestamp)"
  ],
  BinaryTree: [
    "function rootUserId() view returns (uint256)",
    "function nodes(uint256) view returns (uint256 userId, uint256 parentId, uint256 leftChildId, uint256 rightChildId, uint8 depth)",
    "event NodePlaced(uint256 indexed userId, uint256 indexed parentId, bool isLeft, uint256 depth)"
  ],
  MGXStaking: [
    "function rewardPool() view returns (uint256)",
    "function totalStaked() view returns (uint256)",
    "function getStakePosition(address) view returns (uint256 amount, uint256 rewardDebt, uint256 accruedReward, uint256 lockStartedAt, uint256 lockDuration, bool autoCompound)"
  ]
} as const;
