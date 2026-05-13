import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY;
  const USDT = process.env.MOCK_USDT_ADDRESS || process.env.USDT_ADDRESS;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS;
  const TREE = process.env.BINARY_TREE_ADDRESS;

  if (!CORE || !USDT || !INCOME || !TREE) {
    throw new Error("Missing system addresses in .env");
  }

  const provider = ethers.provider;

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const binaryTree = await ethers.getContractAt("BinaryTree", TREE);
  const usdt = new ethers.Contract(
    USDT,
    [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    provider
  );

  const decimals = await usdt.decimals();
  const fmt = (value: bigint) => ethers.formatUnits(value, decimals);

  console.log("================================");
  console.log("SYSTEM VERIFICATION v3");
  console.log("================================");

  const nextId = (await core.nextUserId()) as bigint;
  const rootId = (await core.rootUserId()) as bigint;
  console.log("\n[SYSTEM]");
  console.log("Next User ID:", nextId.toString());
  console.log("Root User ID:", rootId.toString());
  console.log("Total Users:", (nextId - 1n).toString());

  const totalUsers = Number(nextId) - 1;
  for (let i = 1; i <= totalUsers; i++) {
    const [
      userId,
      account,
      sponsorId,
      packageLevel,
      originalPackageLevel,
      totalContribution,
      totalUserEarnings,
      directReferrals,
      totalTeamBusiness,
      rebirthCount,
      xCount,
      joinedAt,
      surrendered
    ] = await core.usersById(i);
    const [left, right] = (await binaryTree.getChildren(i)) as [bigint, bigint];
    const parent = (await binaryTree.getParent(i)) as bigint;
    const leftLabel = left > 0n ? "1 member" : "0 members";
    const rightLabel = right > 0n ? "1 member" : "0 members";
    const parentLabel = parent === 0n ? "Root" : `User ${parent.toString()}`;

    console.log(`\n[USER ${i}]`);
    console.log("Wallet     :", account);
    console.log("Package    :", packageLevel.toString());
    console.log("OriginalPkg:", originalPackageLevel.toString());
    console.log("Sponsor    :", sponsorId.toString());
    console.log("Contribution:", totalContribution.toString());
    console.log("Earnings   :", totalUserEarnings.toString());
    console.log("DirectRefs :", directReferrals.toString());
    console.log("TeamBiz    :", totalTeamBusiness.toString());
    console.log("Rebirths   :", rebirthCount.toString());
    console.log("XCount     :", xCount.toString());
    console.log("JoinedAt   :", joinedAt.toString());
    console.log("Surrendered:", surrendered);

    const walletBal = (await usdt.balanceOf(account)) as bigint;
    console.log("USDT Wallet:", fmt(walletBal));

    console.log("Tree Left  :", leftLabel);
    console.log("Tree Right :", rightLabel);
    console.log("Tree Parent:", parentLabel);

    try {
      const totalEarned = (await income.totalEarnings(i)) as bigint;
      const escrow = (await income.escrowBalances(i)) as bigint;
      console.log("Total Earned:", fmt(totalEarned));
      console.log("Escrow      :", fmt(escrow));
    } catch {
      console.log("Income data : not available");
    }
  }

  console.log("\n[CONTRACT USDT BALANCES]");
  const coreBal = (await usdt.balanceOf(CORE)) as bigint;
  const incomeBal = (await usdt.balanceOf(INCOME)) as bigint;
  console.log("Core contract  :", fmt(coreBal));
  console.log("Income contract:", fmt(incomeBal));

  console.log("\n================================");
  console.log("CHECKS");
  console.log("================================");
  console.log("Root registered    :", rootId > 0n ? "YES" : "NO");
  console.log("Users in system    :", totalUsers);
  console.log("Core has USDT      :", coreBal > 0n ? "YES (check)" : "0 (clean)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
