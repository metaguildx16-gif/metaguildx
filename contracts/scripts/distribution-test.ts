import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

type DeployedAddresses = {
  Core: string;
  Income: string;
  Router: string;
  BinaryTree: string;
  Upgrade: string;
  CashbackPool: string;
  MGXStaking: string;
  MGXToken: string;
  TokenEngine: string;
  USDT: string;
  deployBlock: number;
};

type ParsedDirectIncome = {
  fromUserId: bigint;
  toUserId: bigint;
  amount: bigint;
  cyclePkgLevel: bigint;
};

type ParsedLevelIncome = {
  fromUserId: bigint;
  toUserId: bigint;
  level: bigint;
  amount: bigint;
  cyclePkgLevel: bigint;
};

type ParsedSpilloverIncome = {
  toUserId: bigint;
  amount: bigint;
  level: bigint;
};

type ParsedPaymentCollected = {
  payer: string;
  asset: string;
  platformAmount: bigint;
  settlementAmount: bigint;
};

type ParsedPaymentWithdrawn = {
  recipient: string;
  asset: string;
  platformAmount: bigint;
  settlementAmount: bigint;
};

type RegistrationAnalysis = {
  userId: bigint;
  directEvents: ParsedDirectIncome[];
  levelEvents: ParsedLevelIncome[];
  spilloverEvents: ParsedSpilloverIncome[];
  paymentCollectedEvents: ParsedPaymentCollected[];
  paymentWithdrawnEvents: ParsedPaymentWithdrawn[];
  creatorWithdrawnSettlement: bigint;
  totalWithdrawnSettlement: bigint;
  coreTransfers: Map<string, bigint>;
  creatorTransferredSettlement: bigint;
  cashbackTransferredSettlement: bigint;
  totalTransferredOutOfCore: bigint;
  coreBalanceBefore: bigint;
  coreBalanceAfter: bigint;
};

const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const PLACEMENT_SIGNER_KEY = process.env.PLACEMENT_SIGNER_PRIVATE_KEY;
const GAS_FUNDING = ethers.parseEther("0.01");
const DIRECT_INCOME_BPS = 4_600n;
const LEVEL_INCOME_BPS = 400n;
const MAX_LEVELS = 10n;
const CASHBACK_BPS = 400n;
const CREATOR_FEE_BPS = 1_000n;

const coreAbi = [
  "function nextUserId() view returns (uint256)",
  "function nonces(address) view returns (uint256)",
  "function registerWithPlacement(uint256,uint256,bool,bytes,uint256) external payable returns (uint256)",
  "function paymentAssetUnitPrice(address) view returns (uint256)",
  "function getPackagePrices() view returns (uint256[])",
  "function creatorFeeWallet() view returns (address)",
  "function placementSigner() view returns (address)",
  "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)"
] as const;

const binaryTreeAbi = [
  "function findNextSlotUnderSponsor(uint256 sponsorId) view returns (uint256 parentId, bool isLeft)"
] as const;

const usdtAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
  "function mint(address,uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
] as const;

const mgxTokenAbi = [
  "function approve(address,uint256) returns (bool)"
] as const;

const stakingAbi = [
  "function adminFundStakingPool(uint256 amount)",
  "function rewardPool() view returns (uint256)",
  "function stakingRewardPoolPlatformReserve(address) view returns (uint256)"
] as const;

const routerEventInterface = new ethers.Interface([
  "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount, uint8 cyclePkgLevel)",
  "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount, uint8 cyclePkgLevel)",
  "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)"
]);

const coreEventInterface = new ethers.Interface([
  "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
  "event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount)",
  "event PaymentWithdrawn(address indexed recipient, address indexed asset, uint256 platformAmount, uint256 settlementAmount)"
]);

const erc20EventInterface = new ethers.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

function loadAddresses(): DeployedAddresses {
  if (!fs.existsSync(ADDRESSES_PATH)) {
    throw new Error("deployed-addresses.json not found");
  }
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

function formatPlatformRaw(amount: bigint) {
  return (Number(amount) / 10).toFixed(1);
}

function formatSettlement(amount: bigint, decimals = 18) {
  return ethers.formatUnits(amount, decimals);
}

function sum(values: bigint[]) {
  return values.reduce((acc, value) => acc + value, 0n);
}

function collectDuplicateRecipients(recipientIds: bigint[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const recipientId of recipientIds) {
    const key = recipientId.toString();
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }
  return [...duplicates];
}

async function fundAndPrepareUser(
  userWallet: ethers.Wallet,
  deployer: ethers.Signer,
  usdt: ethers.Contract,
  coreAddress: string,
  settlementAmount: bigint
) {
  const nativeBalance = await ethers.provider.getBalance(userWallet.address);
  if (nativeBalance < GAS_FUNDING / 2n) {
    await (
      await deployer.sendTransaction({
        to: userWallet.address,
        value: GAS_FUNDING
      })
    ).wait();
  }

  const currentUsdtBalance = await usdt.balanceOf(userWallet.address);
  if (currentUsdtBalance < settlementAmount) {
    const mintAmount = settlementAmount * 2n;
    const mintTx = await usdt.mint(userWallet.address, mintAmount);
    await mintTx.wait();
  }

  const usdtAsUser = usdt.connect(userWallet);
  const allowance = await usdt.allowance(userWallet.address, coreAddress);
  if (allowance < settlementAmount) {
    const approveTx = await usdtAsUser.approve(coreAddress, settlementAmount);
    await approveTx.wait();
  }
}

async function createPlacementSignature(
  chainId: bigint,
  coreAddress: string,
  account: string,
  sponsorId: bigint,
  nonce: bigint,
  signerWallet: ethers.Wallet
) {
  const hash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [chainId, coreAddress, account, sponsorId, nonce]
  );
  return signerWallet.signMessage(ethers.getBytes(hash));
}

function analyzeRegistrationReceipt(
  receipt: Awaited<ReturnType<ethers.TransactionResponse["wait"]>>,
  addresses: DeployedAddresses,
  creatorWallet: string,
  coreBalanceBefore: bigint,
  coreBalanceAfter: bigint
): RegistrationAnalysis {
  if (!receipt) {
    throw new Error("Missing transaction receipt");
  }

  const directEvents: ParsedDirectIncome[] = [];
  const levelEvents: ParsedLevelIncome[] = [];
  const spilloverEvents: ParsedSpilloverIncome[] = [];
  const paymentCollectedEvents: ParsedPaymentCollected[] = [];
  const paymentWithdrawnEvents: ParsedPaymentWithdrawn[] = [];
  const coreTransfers = new Map<string, bigint>();
  let userId = 0n;

  for (const log of receipt.logs) {
    try {
      const parsedRouter = routerEventInterface.parseLog(log);
      if (!parsedRouter) {
        throw new Error("not a router log");
      }

      if (parsedRouter.name === "DirectIncomeRecorded") {
        directEvents.push({
          fromUserId: BigInt(parsedRouter.args.fromUserId),
          toUserId: BigInt(parsedRouter.args.toUserId),
          amount: BigInt(parsedRouter.args.amount),
          cyclePkgLevel: BigInt(parsedRouter.args.cyclePkgLevel)
        });
      } else if (parsedRouter.name === "LevelIncomeRecorded") {
        levelEvents.push({
          fromUserId: BigInt(parsedRouter.args.fromUserId),
          toUserId: BigInt(parsedRouter.args.toUserId),
          level: BigInt(parsedRouter.args.level),
          amount: BigInt(parsedRouter.args.amount),
          cyclePkgLevel: BigInt(parsedRouter.args.cyclePkgLevel)
        });
      } else if (parsedRouter.name === "SpilloverIncome") {
        spilloverEvents.push({
          toUserId: BigInt(parsedRouter.args.receiver),
          amount: BigInt(parsedRouter.args.amount),
          level: BigInt(parsedRouter.args.fromLevel)
        });
      }
      continue;
    } catch {
      // ignore unrelated logs
    }

    try {
      const parsedCoreEvent = coreEventInterface.parseLog(log);
      if (!parsedCoreEvent) {
        throw new Error("not a core event");
      }

      if (parsedCoreEvent.name === "UserRegistered") {
        userId = BigInt(parsedCoreEvent.args.userId);
      } else if (
        parsedCoreEvent.name === "PaymentCollected" &&
        String(parsedCoreEvent.args.asset).toLowerCase() === addresses.USDT.toLowerCase()
      ) {
        paymentCollectedEvents.push({
          payer: String(parsedCoreEvent.args.payer),
          asset: String(parsedCoreEvent.args.asset),
          platformAmount: BigInt(parsedCoreEvent.args.platformAmount),
          settlementAmount: BigInt(parsedCoreEvent.args.settlementAmount)
        });
      } else if (
        parsedCoreEvent.name === "PaymentWithdrawn" &&
        String(parsedCoreEvent.args.asset).toLowerCase() === addresses.USDT.toLowerCase()
      ) {
        paymentWithdrawnEvents.push({
          recipient: String(parsedCoreEvent.args.recipient),
          asset: String(parsedCoreEvent.args.asset),
          platformAmount: BigInt(parsedCoreEvent.args.platformAmount),
          settlementAmount: BigInt(parsedCoreEvent.args.settlementAmount)
        });
      }
    } catch {
      // ignore unrelated logs
    }

    if (log.address.toLowerCase() !== addresses.USDT.toLowerCase()) {
      continue;
    }

    try {
      const parsedTransfer = erc20EventInterface.parseLog(log);
      if (parsedTransfer?.name !== "Transfer") {
        continue;
      }

      const from = String(parsedTransfer.args.from).toLowerCase();
      const to = String(parsedTransfer.args.to).toLowerCase();
      const value = BigInt(parsedTransfer.args.value);

      if (from === addresses.Core.toLowerCase()) {
        coreTransfers.set(to, (coreTransfers.get(to) ?? 0n) + value);
      }
    } catch {
      // ignore unrelated logs
    }
  }

  const creatorWithdrawnSettlement = sum(
    paymentWithdrawnEvents
      .filter((event) => event.recipient.toLowerCase() === creatorWallet.toLowerCase())
      .map((event) => event.settlementAmount)
  );
  const totalWithdrawnSettlement = sum(paymentWithdrawnEvents.map((event) => event.settlementAmount));
  const creatorTransferredSettlement = coreTransfers.get(creatorWallet.toLowerCase()) ?? 0n;
  const cashbackTransferredSettlement = coreTransfers.get(addresses.CashbackPool.toLowerCase()) ?? 0n;
  const totalTransferredOutOfCore = sum([...coreTransfers.values()]);

  return {
    userId,
    directEvents,
    levelEvents,
    spilloverEvents,
    paymentCollectedEvents,
    paymentWithdrawnEvents,
    creatorWithdrawnSettlement,
    totalWithdrawnSettlement,
    coreTransfers,
    creatorTransferredSettlement,
    cashbackTransferredSettlement,
    totalTransferredOutOfCore,
    coreBalanceBefore,
    coreBalanceAfter
  };
}

async function registerTestUser(
  expectedUserId: bigint,
  sponsorId: bigint,
  label: string,
  addresses: DeployedAddresses,
  deployer: ethers.Signer,
  core: ethers.Contract,
  binaryTree: ethers.Contract,
  usdt: ethers.Contract,
  signerWallet: ethers.Wallet,
  settlementAmount: bigint
) {
  const nextUserId = await core.nextUserId();
  if (nextUserId !== expectedUserId) {
    throw new Error(
      `${label}: expected nextUserId ${expectedUserId.toString()}, got ${nextUserId.toString()}`
    );
  }

  const testUser = ethers.Wallet.createRandom().connect(ethers.provider);
  await fundAndPrepareUser(testUser, deployer, usdt, addresses.Core, settlementAmount);

  const nonce = await core.nonces(testUser.address);
  const network = await ethers.provider.getNetwork();
  const signature = await createPlacementSignature(
    network.chainId,
    addresses.Core,
    testUser.address,
    sponsorId,
    nonce,
    signerWallet
  );
  const [placementParentId, isLeft] = await binaryTree.findNextSlotUnderSponsor(sponsorId);

  console.log(`- ${label}: registering ${testUser.address}`);
  console.log(`  sponsorId=${sponsorId.toString()} placementParent=${placementParentId.toString()} isLeft=${isLeft}`);

  const coreAsUser = core.connect(testUser);
  const coreBalanceBefore = await usdt.balanceOf(addresses.Core);
  const tx = await coreAsUser.registerWithPlacement(
    sponsorId,
    placementParentId,
    isLeft,
    signature,
    nonce,
    { gasLimit: 5_000_000n }
  );
  const receipt = await tx.wait();
  const coreBalanceAfter = await usdt.balanceOf(addresses.Core);
  const creatorWallet = await core.creatorFeeWallet();
  const analysis = analyzeRegistrationReceipt(
    receipt,
    addresses,
    creatorWallet,
    BigInt(coreBalanceBefore),
    BigInt(coreBalanceAfter)
  );

  console.log(`  tx=${tx.hash}`);
  console.log(`  assignedUserId=${analysis.userId.toString()}`);

  return analysis;
}

async function main() {
  if (!PLACEMENT_SIGNER_KEY) {
    throw new Error("PLACEMENT_SIGNER_PRIVATE_KEY is required");
  }

  const addresses = loadAddresses();
  const [deployer] = await ethers.getSigners();
  const core = await ethers.getContractAt(coreAbi, addresses.Core, deployer);
  const binaryTree = await ethers.getContractAt(binaryTreeAbi, addresses.BinaryTree, deployer);
  const usdt = await ethers.getContractAt(usdtAbi, addresses.USDT, deployer);
  const signerWallet = new ethers.Wallet(PLACEMENT_SIGNER_KEY, ethers.provider);

  const [creatorWallet, placementSigner, packagePrices, unitPrice, usdtDecimals] = await Promise.all([
    core.creatorFeeWallet(),
    core.placementSigner(),
    core.getPackagePrices(),
    core.paymentAssetUnitPrice(addresses.USDT),
    usdt.decimals()
  ]);

  if (placementSigner.toLowerCase() !== signerWallet.address.toLowerCase()) {
    throw new Error(
      `PLACEMENT_SIGNER_PRIVATE_KEY mismatch. Core expects ${placementSigner}, script has ${signerWallet.address}`
    );
  }

  const packageAmount = BigInt(packagePrices[0]);
  const settlementAmount = packageAmount * unitPrice;
  const expectedDirectRaw = (packageAmount * DIRECT_INCOME_BPS) / 10_000n;
  const expectedBaseLevelRaw = (packageAmount * LEVEL_INCOME_BPS) / 10_000n;
  const expectedLevelBudgetRaw = expectedBaseLevelRaw * MAX_LEVELS;

  let passed = 0;
  let failed = 0;

  function assertResult(label: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
      return;
    }

    console.log(`  ❌ ${label} — ${detail}`);
    failed++;
  }

  console.log("=== Distribution Test ===");
  console.log("Core:", addresses.Core);
  console.log("Router:", addresses.Router);
  console.log("USDT:", addresses.USDT);
  console.log("Creator:", creatorWallet);
  console.log("Package raw:", packageAmount.toString(), `(${formatPlatformRaw(packageAmount)} USDT displayed)`);
  console.log("Settlement:", formatSettlement(settlementAmount, usdtDecimals), "USDT");

  const startingNextUserId = await core.nextUserId();
  const testUserAId = startingNextUserId;
  const testUserBId = startingNextUserId + 1n;

  console.log("Starting nextUserId:", startingNextUserId.toString());
  console.log("Test User A ID:", testUserAId.toString());
  console.log("Test User B ID:", testUserBId.toString());

  const test1 = await registerTestUser(
    testUserAId,
    1n,
    "TEST 1 — Test User A Registration",
    addresses,
    deployer,
    core,
    binaryTree,
    usdt,
    signerWallet,
    settlementAmount
  );

  if (test1) {
    const levelRecipients = [
      ...test1.levelEvents.map((event) => event.toUserId),
      ...test1.spilloverEvents.map((event) => event.toUserId)
    ];
    const duplicateRecipients = collectDuplicateRecipients(levelRecipients);
    const directToUser1 = test1.directEvents.find((event) => event.toUserId === 1n);
    const level1ToUser1 = test1.levelEvents.find((event) => event.level === 1n && event.toUserId === 1n);
    const collectedSettlement = sum(test1.paymentCollectedEvents.map((event) => event.settlementAmount));
    const retainedSettlement =
      test1.coreBalanceAfter > test1.coreBalanceBefore ? test1.coreBalanceAfter - test1.coreBalanceBefore : 0n;

    assertResult(
      "Test User A assigned correctly",
      test1.userId === testUserAId,
      `got userId ${test1.userId.toString()}`
    );
    assertResult(
      "Direct income = 46 raw (4.6 USDT displayed) to User 1",
      directToUser1?.amount === expectedDirectRaw,
      `got ${directToUser1?.amount?.toString() ?? "none"} raw`
    );
    assertResult(
      "Level 1 income = 4 raw (0.4 USDT displayed) to User 1",
      level1ToUser1?.amount === expectedBaseLevelRaw,
      `got ${level1ToUser1?.amount?.toString() ?? "none"} raw`
    );
    assertResult(
      "No duplicate level/spillover recipients",
      duplicateRecipients.length === 0,
      `duplicate userIds: ${duplicateRecipients.join(", ")}`
    );
    assertResult(
      "Creator received wallet transfer",
      test1.creatorTransferredSettlement > 0n,
      `got ${formatSettlement(test1.creatorTransferredSettlement, usdtDecimals)} USDT`
    );
    assertResult(
      "Transfer accounting closes against Core balance",
      collectedSettlement === settlementAmount &&
        test1.totalTransferredOutOfCore + retainedSettlement === settlementAmount,
      `collected=${formatSettlement(collectedSettlement, usdtDecimals)} transferred=${formatSettlement(test1.totalTransferredOutOfCore, usdtDecimals)} retained=${formatSettlement(retainedSettlement, usdtDecimals)}`
    );
  }

  const test2 = await registerTestUser(
    testUserBId,
    testUserAId,
    "TEST 2 — Test User B Registration under Test User A",
    addresses,
    deployer,
    core,
    binaryTree,
    usdt,
    signerWallet,
    settlementAmount
  );

  if (test2) {
    const levelRecipients = [
      ...test2.levelEvents.map((event) => event.toUserId),
      ...test2.spilloverEvents.map((event) => event.toUserId)
    ];
    const duplicateRecipients = collectDuplicateRecipients(levelRecipients);
    const distributedLevelRaw = sum([
      ...test2.levelEvents.map((event) => event.amount),
      ...test2.spilloverEvents.map((event) => event.amount)
    ]);
    const collectedSettlement = sum(test2.paymentCollectedEvents.map((event) => event.settlementAmount));
    const retainedSettlement =
      test2.coreBalanceAfter > test2.coreBalanceBefore ? test2.coreBalanceAfter - test2.coreBalanceBefore : 0n;

    assertResult(
      "Test User B assigned correctly",
      test2.userId === testUserBId,
      `got userId ${test2.userId.toString()}`
    );
    assertResult(
      "No duplicate level/spillover recipients",
      duplicateRecipients.length === 0,
      `duplicate userIds: ${duplicateRecipients.join(", ")}`
    );
    assertResult(
      "Creator received wallet transfer",
      test2.creatorTransferredSettlement > 0n,
      `got ${formatSettlement(test2.creatorTransferredSettlement, usdtDecimals)} USDT`
    );
    assertResult(
      "Level distribution events stay within 40 raw budget",
      distributedLevelRaw <= expectedLevelBudgetRaw,
      `distributed=${distributedLevelRaw.toString()} expected<=${expectedLevelBudgetRaw.toString()}`
    );
    assertResult(
      "Transfer accounting closes against Core balance",
      collectedSettlement === settlementAmount &&
        test2.totalTransferredOutOfCore + retainedSettlement === settlementAmount,
      `collected=${formatSettlement(collectedSettlement, usdtDecimals)} transferred=${formatSettlement(test2.totalTransferredOutOfCore, usdtDecimals)} retained=${formatSettlement(retainedSettlement, usdtDecimals)}`
    );
    assertResult(
      "Cashback + creator + other wallet transfers match Core outflow",
      test2.creatorTransferredSettlement + test2.cashbackTransferredSettlement <= test2.totalTransferredOutOfCore,
      `creator=${formatSettlement(test2.creatorTransferredSettlement, usdtDecimals)} cashback=${formatSettlement(test2.cashbackTransferredSettlement, usdtDecimals)} outflow=${formatSettlement(test2.totalTransferredOutOfCore, usdtDecimals)}`
    );
  }

  const staking = await ethers.getContractAt(stakingAbi, addresses.MGXStaking, deployer);
  const mgxToken = await ethers.getContractAt(mgxTokenAbi, addresses.MGXToken, deployer);
  const stakingFundAmount = ethers.parseEther("1");

  const platformReserveBefore = await staking.stakingRewardPoolPlatformReserve(addresses.MGXToken);
  await (await mgxToken.approve(addresses.MGXStaking, stakingFundAmount)).wait();
  await (await staking.adminFundStakingPool(stakingFundAmount)).wait();
  const platformReserveAfter = await staking.stakingRewardPoolPlatformReserve(addresses.MGXToken);

  assertResult(
    "Bug #24 — adminFundStakingPool sets platformReserve",
    platformReserveAfter > platformReserveBefore,
    `before=${platformReserveBefore.toString()} after=${platformReserveAfter.toString()}`
  );

  const rewardPoolBefore = await staking.rewardPool();
  await (await mgxToken.approve(addresses.MGXStaking, stakingFundAmount)).wait();
  await (await staking.adminFundStakingPool(stakingFundAmount)).wait();
  const rewardPoolAfter = await staking.rewardPool();

  assertResult(
    "Bug #24 — rewardPool increases after adminFundStakingPool",
    rewardPoolAfter > rewardPoolBefore,
    `before=${rewardPoolBefore.toString()} after=${rewardPoolAfter.toString()}`
  );

  console.log("\n=== Distribution Test Results ===");
  console.log(`${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
