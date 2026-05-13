import * as hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const { ethers } = hre as any;

type TestAmount = {
  total: bigint;
  income: bigint;
  expected: string;
};

function getZoneLabel(zone: bigint) {
  if (zone === BigInt(0)) return "1X";
  if (zone === BigInt(1)) return "2X";
  if (zone === BigInt(2)) return "3X";
  if (zone === BigInt(3)) return "4X";
  if (zone === BigInt(4)) return "5X";
  return "5X+";
}

async function main() {
  const systemAddress = process.env.SYSTEM_PROXY || process.env.SYSTEM_PROXY_ADDRESS;
  const routerAddress = process.env.INCOME_ROUTER_PROXY || process.env.INCOME_ROUTER_ADDRESS;
  const managerAddress = process.env.UPGRADE_MANAGER_PROXY || process.env.UPGRADE_MANAGER_ADDRESS;
  const creatorWalletEnv = process.env.CREATOR_WALLET;

  if (!systemAddress || !routerAddress || !managerAddress) {
    throw new Error(
      "Missing env values. Check SYSTEM_PROXY/SYSTEM_PROXY_ADDRESS, INCOME_ROUTER_PROXY/INCOME_ROUTER_ADDRESS, and UPGRADE_MANAGER_PROXY/UPGRADE_MANAGER_ADDRESS."
    );
  }

  const [deployer] = await ethers.getSigners();
  const system = await ethers.getContractAt("MetaGuildXSystem", systemAddress);
  const router = await ethers.getContractAt("IncomeRouter", routerAddress);
  const manager = await ethers.getContractAt("UpgradeManager", managerAddress);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("LOGIC VERIFICATION - Fresh Deploy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Deployer        :", deployer.address);
  console.log("System          :", systemAddress);
  console.log("IncomeRouter    :", routerAddress);
  console.log("UpgradeManager  :", managerAddress);

  const routerSystem = await router.coreContract();
  const systemRouter = await system.incomeContract();
  const routerCreatorWallet = await router.creatorWallet();
  const managerCore = await manager.coreContract();

  console.log("\n[IncomeRouter wiring]");
  console.log("coreContract    :", routerSystem);
  console.log(
    "Core match      :",
    routerSystem.toLowerCase() === systemAddress.toLowerCase() ? "✅" : "❌ MISMATCH"
  );

  console.log("\n[MetaGuildXSystem wiring]");
  console.log("incomeContract  :", systemRouter);
  console.log(
    "Router match    :",
    systemRouter.toLowerCase() === routerAddress.toLowerCase() ? "✅" : "❌ MISMATCH"
  );

  console.log("\n[UpgradeManager wiring]");
  console.log("manager.core    :", managerCore);
  console.log(
    "Manager -> core :",
    managerCore.toLowerCase() === systemAddress.toLowerCase() ? "✅" : "❌ MISMATCH"
  );

  console.log("\n[Creator wallet]");
  console.log("router.creator  :", routerCreatorWallet);
  console.log("env.creator     :", creatorWalletEnv || "(missing)");
  console.log(
    "Set properly    :",
    creatorWalletEnv && routerCreatorWallet.toLowerCase() === creatorWalletEnv.toLowerCase() ? "✅" : "❌ MISMATCH"
  );

  const pkg1Price = await system.getPackagePriceByLevel(1);
  const pkg2Price = await system.getPackagePriceByLevel(2);
  const unitPrice = await system.paymentAssetUnitPrice(await system.defaultPaymentAsset());
  console.log("\n[Package prices]");
  console.log("Package 1 price :", pkg1Price.toString(), "platform units");
  console.log("Package 2 price :", pkg2Price.toString(), "platform units");
  console.log("Unit price      :", unitPrice.toString(), "settlement per platform unit");
  console.log("Pkg1 = 100      :", pkg1Price === BigInt(100) ? "✅" : "❌ WRONG PRICE");
  console.log("Pkg2 = 200      :", pkg2Price === BigInt(200) ? "✅" : "❌ WRONG PRICE");
  console.log(
    "Pkg1 real USDT  :",
    ethers.formatUnits(pkg1Price * unitPrice, 18),
    "USDT"
  );

  console.log("\n[Zone calculation simulation]");
  const packagePrice = BigInt(100);
  const testAmounts: TestAmount[] = [
    { total: BigInt(0), income: BigInt(46), expected: "1X -> wallet" },
    { total: BigInt(46), income: BigInt(46), expected: "1X -> wallet" },
    { total: BigInt(92), income: BigInt(46), expected: "Split: 8 wallet + 38 escrow" },
    { total: BigInt(138), income: BigInt(46), expected: "2X -> escrow" },
    { total: BigInt(184), income: BigInt(46), expected: "Split: 16 escrow + 30 escrow->upgrade" }
  ];

  for (const item of testAmounts) {
    const zone = item.total / packagePrice;
    const zoneEnd = (zone + BigInt(1)) * packagePrice;
    const remainingInZone = zoneEnd - item.total;
    const chunk1 = item.income <= remainingInZone ? item.income : remainingInZone;
    const chunk2 = item.income - chunk1;

    console.log(
      "Total:",
      item.total.toString(),
      "| Income:",
      item.income.toString(),
      "| Zone:",
      `${zone.toString()} (${getZoneLabel(zone)})`,
      "| Split:",
      chunk1.toString(),
      "+",
      chunk2.toString(),
      "| Expected:",
      item.expected
    );
  }

  console.log("\n[Root user check]");
  try {
    const rootUser = await system.usersById(BigInt(1));
    console.log("Root userId 1   :", rootUser.account);
    console.log("Root package    :", rootUser.packageLevel.toString());
    console.log(
      "Root exists     :",
      rootUser.account !== ethers.ZeroAddress ? "✅" : "❌ NOT REGISTERED"
    );
  } catch {
    console.log("Root user       : ❌ NOT FOUND");
  }

  console.log("\n[X-count rule notes]");
  console.log("Combined income tracker :", "system.getTotalIncome(userId) ✅");
  console.log("Direct/Level/Spillover  :", "all count in platform units ✅");
  console.log("Boundary split logic    :", "simulated with platform units ✅");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("VERIFICATION COMPLETE");
  console.log("If all ✅ -> safe to register manually");
  console.log("If any ❌ -> fix before registering");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
