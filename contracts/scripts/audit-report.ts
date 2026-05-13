import { ethers } from "hardhat";

const CORE_ADDRESS = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
const ROUTER_ADDRESS = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
const USER1_WALLET = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
const BLOCK_LOOKBACK = 50_000n;

function fmtUnits(value: bigint, decimals = 18) {
  return ethers.formatUnits(value, decimals);
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function printUserState(
  label: string,
  core: any,
  income: any,
  usdt: any,
  userId: bigint,
  walletOverride?: string
) {
  const profile = await core.usersById(userId);
  const wallet = walletOverride ?? profile.account;
  const totalEarned = await income.getTotalIncome(userId);
  const escrowBalance = await income.getEscrow(userId);
  const walletBalance = await usdt.balanceOf(wallet);

  console.log(`${label}:`);
  console.log(`  walletAddress : ${wallet}`);
  console.log(`  userId        : ${profile.id.toString()}`);
  console.log(`  sponsorId     : ${profile.sponsorId.toString()}`);
  console.log(`  packageLevel  : ${profile.packageLevel.toString()}`);
  console.log(`  totalEarned   : ${totalEarned.toString()} (${fmtUnits(totalEarned)} platform-ish raw)`);
  console.log(`  walletBalance : ${walletBalance.toString()} (${fmtUnits(walletBalance)} USDT)`);
  console.log(`  escrowBalance : ${escrowBalance.toString()} (${fmtUnits(escrowBalance)} raw)`);
}

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", CORE_ADDRESS);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER_ADDRESS);

  const routerFromCore = await core.incomeRouterContract();
  const creatorWallet = await core.creatorFeeWallet();
  const incomeAddress = await core.incomeEngineContract();
  const paymentAsset = await core.defaultPaymentAsset();

  const income = await ethers.getContractAt("MetaGuildXIncome", incomeAddress);
  const usdt = await ethers.getContractAt("MockUSDT", paymentAsset);

  const user1Id = await core.userIdByAddress(USER1_WALLET);
  const user2Profile = await core.usersById(2n);

  printSection("CORE ADDRESSES");
  console.log(`Core               : ${CORE_ADDRESS}`);
  console.log(`routerContract     : ${routerFromCore}`);
  console.log(`Router (script)    : ${ROUTER_ADDRESS}`);
  console.log(`creatorWallet      : ${creatorWallet}`);
  console.log(`incomeEngine       : ${incomeAddress}`);
  console.log(`defaultPaymentAsset: ${paymentAsset}`);

  printSection("USER STATES");
  await printUserState("User 1", core, income, usdt, user1Id, USER1_WALLET);
  await printUserState("User 2", core, income, usdt, 2n, user2Profile.account);

  const latestBlock = BigInt(await ethers.provider.getBlockNumber());
  const fromBlock = latestBlock > BLOCK_LOOKBACK ? latestBlock - BLOCK_LOOKBACK : 0n;

  printSection("ROUTER EVENT AUDIT");
  console.log(`Scanning blocks: ${fromBlock.toString()} -> ${latestBlock.toString()}`);

  const joinIncomeExists = router.interface.fragments.some(
    (fragment) => fragment.type === "event" && fragment.name === "JoinIncomeDistributed"
  );
  const upgradeIncomeExists = router.interface.fragments.some(
    (fragment) => fragment.type === "event" && fragment.name === "UpgradeIncomeDistributed"
  );

  console.log(`JoinIncomeDistributed exists   : ${joinIncomeExists ? "YES" : "NO"}`);
  console.log(`UpgradeIncomeDistributed exists: ${upgradeIncomeExists ? "YES" : "NO"}`);

  if (joinIncomeExists) {
    const logs = await router.queryFilter(
      router.filters.JoinIncomeDistributed(),
      Number(fromBlock),
      Number(latestBlock)
    );
    console.log("JoinIncomeDistributed events:");
    if (logs.length === 0) {
      console.log("  none");
    } else {
      for (const log of logs) {
        const { fromUserId, sponsorId, amount } = log.args as any;
        console.log(
          `  block=${log.blockNumber} fromUserId=${fromUserId.toString()} sponsorId=${sponsorId.toString()} amount=${amount.toString()}`
        );
      }
    }
  } else {
    console.log("JoinIncomeDistributed events: missing from current IncomeRouter ABI");
  }

  if (upgradeIncomeExists) {
    const logs = await router.queryFilter(
      router.filters.UpgradeIncomeDistributed(),
      Number(fromBlock),
      Number(latestBlock)
    );
    console.log("UpgradeIncomeDistributed events:");
    if (logs.length === 0) {
      console.log("  none");
    } else {
      for (const log of logs) {
        const { fromUserId, sponsorId, amount } = log.args as any;
        console.log(
          `  block=${log.blockNumber} fromUserId=${fromUserId.toString()} sponsorId=${sponsorId.toString()} amount=${amount.toString()}`
        );
      }
    }
  } else {
    console.log("UpgradeIncomeDistributed events: missing from current IncomeRouter ABI");
  }

  const actualDirectLogs = await router.queryFilter(
    router.filters.DirectIncomeRecorded(),
    Number(fromBlock),
    Number(latestBlock)
  );
  console.log("\nActual router direct-income events (DirectIncomeRecorded):");
  if (actualDirectLogs.length === 0) {
    console.log("  none");
  } else {
    for (const log of actualDirectLogs) {
      const { fromUserId, toUserId, amount } = log.args as any;
      console.log(
        `  block=${log.blockNumber} fromUserId=${fromUserId.toString()} sponsorId=${toUserId.toString()} amount=${amount.toString()}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
