import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = hre as any;
  const provider = ethers.provider;

  const usdtAddress = process.env.USDT_ADDRESS;
  const systemAddress = process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY;
  const upgradeManagerAddress = process.env.UPGRADE_MANAGER_ADDRESS || process.env.UPGRADE_MANAGER_PROXY;
  const creatorWallet = process.env.CREATOR_WALLET;

  if (!usdtAddress || !systemAddress || !upgradeManagerAddress || !creatorWallet) {
    throw new Error("Missing env values. Check USDT_ADDRESS, SYSTEM_PROXY_ADDRESS/SYSTEM_PROXY, UPGRADE_MANAGER_ADDRESS/UPGRADE_MANAGER_PROXY, and CREATOR_WALLET.");
  }

  const usdt = new ethers.Contract(
    usdtAddress,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );

  const system = await ethers.getContractAt("MetaGuildXSystem", systemAddress);
  const upgradeManager = await ethers.getContractAt("UpgradeManager", upgradeManagerAddress);

  const fmt = (value: bigint) => ethers.formatUnits(value, 18);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("FULL SYSTEM CHECK");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const user1 = await system.usersById(1);
  console.log("\n[USER 1]");
  console.log("Wallet        :", user1.account);
  console.log("Package Level :", user1.packageLevel.toString());
  console.log("Direct Refs   :", user1.directReferrals.toString());
  console.log("Sponsor ID    :", user1.sponsorId.toString());

  const user1Income = await system.incomesByUser(1);
  const user1IncomeTotal =
    user1Income.directIncome +
    user1Income.levelIncome +
    user1Income.spilloverIncome +
    user1Income.crossLineIncome +
    user1Income.cashbackIncome +
    user1Income.stakingIncome;
  console.log("Total Income  :", user1IncomeTotal.toString(), "platform units");
  console.log("Direct Income :", user1Income.directIncome.toString());
  console.log("Level Income  :", user1Income.levelIncome.toString());
  console.log("Spillover     :", user1Income.spilloverIncome.toString());

  const user1Wallet = await system.internalWalletBalances(1);
  console.log("Inner Wallet  :", user1Wallet.toString(), "platform units");

  const user1Escrow = await system.autoUpgradeEscrowByUser(1);
  console.log("Upgrade Escrow:", user1Escrow.toString(), "platform units");

  const user1TwoX = await system.twoXIncomeByUser(1);
  const user1ThreeX = await system.threeXIncomeByUser(1);
  console.log("2X Income     :", user1TwoX.toString(), "platform units");
  console.log("3X Income     :", user1ThreeX.toString(), "platform units");

  console.log("\n[UPGRADE MANAGER - USER 1]");
  const umTotal = await upgradeManager.totalIncomeReceived(1);
  const umLevel = await upgradeManager.currentPackageLevel(1);
  const umReactivation = await upgradeManager.reactivationCount(1);
  console.log("Total Tracked :", umTotal.toString(), "platform units");
  console.log("Package Level :", umLevel.toString());
  console.log("Reactivations :", umReactivation.toString());

  console.log("\n[USER 2]");
  const user2 = await system.usersById(2);
  console.log("Wallet        :", user2.account);
  console.log("Package Level :", user2.packageLevel.toString());
  console.log("Sponsor ID    :", user2.sponsorId.toString());

  console.log("\n[BINARY TREE]");
  const treeNode1 = await system.treeNodes(1);
  console.log("Node 1 Left   :", treeNode1.leftChildId.toString());
  console.log("Node 1 Right  :", treeNode1.rightChildId.toString());
  console.log("Node 1 Parent :", treeNode1.parentId.toString());

  const treeNode2 = await system.treeNodes(2);
  console.log("Node 2 Parent :", treeNode2.parentId.toString());
  console.log("Node 2 Depth  :", treeNode2.depth.toString());

  console.log("\n[AUTO UPGRADE STATUS - USER 1]");
  const pkgPrice = 10n;
  const xCount = user1IncomeTotal / pkgPrice;
  console.log("Package Price :", "10 platform units");
  console.log("Total Income  :", user1IncomeTotal.toString(), "platform units");
  console.log("X Count       :", xCount.toString(), "X");

  if (xCount >= 1n) console.log("1X ✅ - paid to wallet");
  if (xCount >= 2n) console.log("2X ✅ - should be frozen");
  if (xCount >= 3n) console.log("3X ✅ - should trigger upgrade");
  if (xCount >= 4n) console.log("4X ✅ - paid to wallet");
  if (xCount >= 5n) console.log("5X ✅ - rebirth triggered");

  console.log("\n[WALLET USDT BALANCES]");
  const user1WalletAddr = user1.account;
  const user2WalletAddr = user2.account;

  const [b1, b2, bc] = await Promise.all([
    user1WalletAddr && user1WalletAddr !== ethers.ZeroAddress ? usdt.balanceOf(user1WalletAddr) : Promise.resolve(0n),
    user2WalletAddr && user2WalletAddr !== ethers.ZeroAddress ? usdt.balanceOf(user2WalletAddr) : Promise.resolve(0n),
    usdt.balanceOf(creatorWallet)
  ]);

  console.log("User1 USDT    :", fmt(b1));
  console.log("User2 USDT    :", fmt(b2));
  console.log("Creator USDT  :", fmt(bc));

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Router clean        :", "Check pre/post scripts");
  console.log("User2 registered    :", user2.packageLevel > 0n ? "✅" : "❌");
  console.log("User2 under User1   :", user2.sponsorId.toString() === "1" ? "✅" : "❌");
  console.log("Tree Node2 placed   :", treeNode2.parentId.toString() === "1" ? "✅" : "❌");
  console.log("User1 income > 0    :", user1IncomeTotal > 0n ? "✅" : "❌");
  console.log("Auto-upgrade ready  :", user1Escrow > 0n ? "⏳ Escrow active" : "❌ No escrow");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
