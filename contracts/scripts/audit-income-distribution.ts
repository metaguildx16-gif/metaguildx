import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const SYSTEM_PROXY = process.env.SYSTEM_PROXY || process.env.SYSTEM_PROXY_ADDRESS || "";
const INCOME_ROUTER = process.env.INCOME_ROUTER_ADDRESS || process.env.INCOME_ROUTER_PROXY || "";
const INCOME_ENGINE = process.env.INCOME_ENGINE_ADDRESS || "";
const USDT = process.env.USDT_ADDRESS || process.env.MOCK_USDT_ADDRESS || "";
const CREATOR_WALLET = process.env.CREATOR_WALLET || "0xbFF19De173697D07B904a4c7b79e4A524B456991";
const USER1_WALLET = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

function fmt(value: bigint, decimals = 18) {
  return Number(hre.ethers.formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
}

function zoneLabel(xSlot: bigint) {
  if (xSlot <= 0n) {
    return "1X";
  }
  if (xSlot === 1n) {
    return "2X";
  }
  if (xSlot === 2n) {
    return "3X";
  }
  if (xSlot === 3n) {
    return "4X";
  }
  return "5X+";
}

async function main() {
  const { ethers } = hre;

  if (!SYSTEM_PROXY || !INCOME_ROUTER || !INCOME_ENGINE || !USDT) {
    throw new Error("Missing one or more required addresses in contracts/.env");
  }

  const core = await ethers.getContractAt("MetaGuildXCore", SYSTEM_PROXY);
  const router = await ethers.getContractAt("IncomeRouter", INCOME_ROUTER);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME_ENGINE);
  const usdt = new ethers.Contract(
    USDT,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider
  );

  const user1Id = await core.userIdByAddress(USER1_WALLET);
  const user2Profile = await core.usersById(2n);
  const user2Wallet = String(user2Profile.account);

  const [user1Profile, packagePrices] = await Promise.all([
    core.usersById(user1Id),
    core.getPackagePrices()
  ]);

  console.log("===========================================");
  console.log("SECTION 1: USER STATE");
  console.log("===========================================");

  for (const userId of [1n, 2n]) {
    const profile = await core.usersById(userId);
    console.log(`User ${userId.toString()}:`);
    console.log(`  wallet address     : ${String(profile.account)}`);
    console.log(`  packageLevel       : ${Number(profile.packageLevel)}`);
    console.log(`  sponsorId          : ${Number(profile.sponsorId)}`);
    console.log(`  directReferrals    : ${Number(profile.directReferrals)}`);
    console.log(`  joinedAt timestamp : ${Number(profile.joinedAt)}`);
    console.log(`  totalEarnings      : ${profile.totalEarnings.toString()} (${fmt(profile.totalEarnings, 18)})`);
  }

  console.log("");
  console.log("===========================================");
  console.log("SECTION 2: USDT BALANCES ON-CHAIN");
  console.log("===========================================");

  const [user1Usdt, user2Usdt, coreUsdt, routerUsdt, creatorUsdt] = await Promise.all([
    usdt.balanceOf(String(user1Profile.account)),
    usdt.balanceOf(user2Wallet),
    usdt.balanceOf(SYSTEM_PROXY),
    usdt.balanceOf(INCOME_ROUTER),
    usdt.balanceOf(CREATOR_WALLET)
  ]);

  console.log(`User 1 wallet        : ${fmt(user1Usdt)} USDT`);
  console.log(`User 2 wallet        : ${fmt(user2Usdt)} USDT`);
  console.log(`Core contract        : ${fmt(coreUsdt)} USDT`);
  console.log(`Income router        : ${fmt(routerUsdt)} USDT`);
  console.log(`Creator wallet       : ${fmt(creatorUsdt)} USDT`);

  console.log("");
  console.log("===========================================");
  console.log("SECTION 3: INCOME ENGINE STATE");
  console.log("===========================================");

  const [totalIncomeUser1, escrowUser1, incomesUser1] = await Promise.all([
    income.getTotalIncome(1n),
    income.getEscrow(1n),
    income.incomesByUser(1n)
  ]);

  console.log("User 1:");
  console.log(`  totalEarnings      : ${totalIncomeUser1.toString()} (${fmt(totalIncomeUser1)})`);
  console.log(`  escrowBalances     : ${escrowUser1.toString()} (${fmt(escrowUser1)})`);
  console.log(
    `  incomesByUser      : direct=${fmt(incomesUser1.direct)} level=${fmt(incomesUser1.level)} spillover=${fmt(
      incomesUser1.spillover
    )} crossline=${fmt(incomesUser1.crossline)}`
  );

  console.log("");
  console.log("===========================================");
  console.log("SECTION 4: TX EVENT LOGS");
  console.log("===========================================");

  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50_000);
  console.log(`Scanning blocks      : ${fromBlock} -> ${currentBlock}`);

  const [directLogs, levelLogs, spilloverLogs, crosslineLogs, residualLogs] = await Promise.all([
    router.queryFilter(router.filters.DirectIncomeRecorded(), fromBlock, currentBlock),
    router.queryFilter(router.filters.LevelIncomeRecorded(), fromBlock, currentBlock),
    router.queryFilter(router.filters.SpilloverIncome(), fromBlock, currentBlock),
    router.queryFilter(router.filters.CrossLineIncomeRecorded(), fromBlock, currentBlock),
    router.queryFilter(router.filters.ResidualSweptToCreator(), fromBlock, currentBlock)
  ]);

  const normalized = [
    ...(directLogs as Array<typeof directLogs[number]>).map((log) => ({
      blockNumber: log.blockNumber,
      line: `DirectIncomeRecorded | fromUserId=${log.args.fromUserId.toString()} | toUserId=${log.args.toUserId.toString()} | amount=${fmt(log.args.amount)} | block=${log.blockNumber}`
    })),
    ...(levelLogs as Array<typeof levelLogs[number]>).map((log) => ({
      blockNumber: log.blockNumber,
      line: `LevelIncomeRecorded | fromUserId=${log.args.fromUserId.toString()} | toUserId=${log.args.toUserId.toString()} | amount=${fmt(log.args.amount)} | block=${log.blockNumber}`
    })),
    ...(spilloverLogs as Array<typeof spilloverLogs[number]>).map((log) => ({
      blockNumber: log.blockNumber,
      line: `SpilloverIncome | fromUserId=N/A | toUserId=${log.args.receiver.toString()} | amount=${fmt(log.args.amount)} | block=${log.blockNumber}`
    })),
    ...(crosslineLogs as Array<typeof crosslineLogs[number]>).map((log) => ({
      blockNumber: log.blockNumber,
      line: `CrossLineIncomeRecorded | fromUserId=${log.args.fromUserId.toString()} | toUserId=${log.args.toUserId.toString()} | amount=${fmt(log.args.amount)} | block=${log.blockNumber}`
    })),
    ...(residualLogs as Array<typeof residualLogs[number]>).map((log) => ({
      blockNumber: log.blockNumber,
      line: `ResidualSweptToCreator | fromUserId=N/A | toUserId=N/A | amount=${fmt(log.args.amount)} | block=${log.blockNumber}`
    }))
  ].sort((a, b) => b.blockNumber - a.blockNumber);

  if (normalized.length === 0) {
    console.log("No matching router events found in the last 50000 blocks.");
  } else {
    for (const event of normalized) {
      console.log(event.line);
    }
  }

  console.log("");
  console.log("===========================================");
  console.log("SECTION 5: INCOME MATH VERIFY");
  console.log("===========================================");

  const expectedCreatorTotal = 5.4;
  const expectedUser1Total = 4.6;
  const actualCreator = Number(ethers.formatUnits(creatorUsdt, 18));
  const actualUser1 = Number(ethers.formatUnits(user1Usdt, 18));

  console.log(`Creator wallet USDT balance : ${actualCreator.toFixed(6)}`);
  console.log(`Expected creator total      : ${expectedCreatorTotal.toFixed(1)} USDT`);
  console.log(`Creator MATCH?              : ${Math.abs(actualCreator - expectedCreatorTotal) < 0.000001 ? "MATCH" : "MISMATCH"}`);
  console.log(`User 1 wallet USDT balance  : ${actualUser1.toFixed(6)}`);
  console.log(`Expected User 1 receive     : ${expectedUser1Total.toFixed(1)} USDT`);
  console.log(`User 1 MATCH?               : ${Math.abs(actualUser1 - expectedUser1Total) < 0.000001 ? "MATCH" : "MISMATCH"}`);

  console.log("");
  console.log("===========================================");
  console.log("SECTION 6: CYCLE GATE STATE");
  console.log("===========================================");

  const currentPackageLevel = Number(user1Profile.packageLevel);
  const currentPackagePrice = packagePrices[currentPackageLevel - 1] ?? 0n;
  const currentXSlot = currentPackagePrice === 0n ? 0n : totalIncomeUser1 / currentPackagePrice;

  console.log(`Current package price       : ${currentPackagePrice.toString()} (${fmt(currentPackagePrice, 1)})`);
  console.log(`Total income tracked        : ${totalIncomeUser1.toString()} (${fmt(totalIncomeUser1)})`);
  console.log(`Current xSlot               : ${currentXSlot.toString()} (${zoneLabel(currentXSlot)})`);
  console.log(`Escrow balance              : ${escrowUser1.toString()} (${fmt(escrowUser1)})`);
  console.log("hasCompletedCycle           : function not found");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
