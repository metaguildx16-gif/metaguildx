import { ethers } from "hardhat";

async function main() {
  const CORE = "0x03810a53e98f74AC17531569e84D0feA4C4Ec616";
  const INCOME = "0x7356f01125250e673e9501036e0527D1A63060A9";
  const UPGRADE = "0xE70bCB0F51Caa513d43C6016fC09C80fC06f94E5";
  const ROUTER = "0xa118BaCFF75B37b6dE3D84C5f1d675Dcc634196f";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata",
    USDT
  );

  console.log("=== WIRING ===");
  const w = {
    "core→router": [await core.incomeRouterContract(), ROUTER],
    "core→income": [await core.incomeEngineContract(), INCOME],
    "core→upgrade": [await core.upgradeContract(), UPGRADE],
    "core→tree": [await core.binaryTreeContract(), "0x6dAe8253a7444b8448202E84E3887baE81Cf6C45"],
    "router→core": [await router.coreContract(), CORE],
    "router→income": [await router.incomeEngineContract(), INCOME],
    "income→core": [await income.coreContract(), CORE],
    "income→router": [await income.routerContract(), ROUTER],
    "income→upgrade": [await income.upgradeEngineContract(), UPGRADE],
    "upgrade→core": [await upgrade.coreContract(), CORE],
    "upgrade→income": [await upgrade.incomeContract(), INCOME],
  } as const;

  let allGood = true;
  for (const [label, [actual, expected]] of Object.entries(w)) {
    const ok = actual.toLowerCase() === expected.toLowerCase();
    if (!ok) allGood = false;
    console.log(`${label.padEnd(16)}: ${ok ? "✅" : "❌ GOT: " + actual}`);
  }
  console.log("\nAll wiring OK:", allGood ? "✅" : "❌");

  console.log("\n=== STATE ===");
  const nextId = await core.nextUserId();
  const dpa = await core.defaultPaymentAsset();
  const pkg1 = await core.packagePricesArray(0);
  console.log("nextUserId         :", nextId.toString());
  console.log("defaultPaymentAsset:", dpa);
  console.log("USDT match         :", dpa.toLowerCase() === USDT.toLowerCase() ? "✅" : "❌");
  console.log("pkg1 price (units) :", pkg1.toString());
  console.log("pkg1 price (USDT)  :", ethers.formatUnits(pkg1 * BigInt(1e16), 18));

  console.log("\n=== ROUTER BALANCE ===");
  const routerBal = await usdt.balanceOf(ROUTER);
  console.log("Router USDT:", ethers.formatUnits(routerBal, 18));
}

main().catch(console.error);
