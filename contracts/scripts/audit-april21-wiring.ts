import { ethers } from "hardhat";

async function main() {
  const CORE = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";
  const INCOME = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";
  const UPGRADE = "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A";
  const ROUTER = "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  console.log("=== CORE WIRING ===");
  console.log("incomeRouterContract :", await core.incomeRouterContract());
  console.log("incomeEngineContract :", await core.incomeEngineContract());
  console.log("upgradeContract      :", await core.upgradeContract());
  console.log("binaryTreeContract   :", await core.binaryTreeContract());
  console.log("cashbackPoolContract :", await core.cashbackPoolContract());
  console.log("paymentContract      :", await core.paymentContract().catch(() => "N/A"));

  console.log("\n=== ROUTER WIRING ===");
  console.log("coreContract         :", await router.coreContract());
  console.log("incomeEngineContract :", await router.incomeEngineContract());
  console.log("creatorWallet        :", await router.creatorWallet());

  console.log("\n=== INCOME WIRING ===");
  console.log("coreContract         :", await income.coreContract());
  console.log("routerContract       :", await income.routerContract());
  console.log("upgradeEngineContract:", await income.upgradeEngineContract());

  console.log("\n=== UPGRADE WIRING ===");
  console.log("coreContract         :", await upgrade.coreContract());
  console.log("incomeContract       :", await upgrade.incomeContract());

  console.log("\n=== WIRING VALIDATION ===");
  const checks = [
    ["core→router", await core.incomeRouterContract(), ROUTER, "✅", "❌"],
    ["core→income", await core.incomeEngineContract(), INCOME, "✅", "❌"],
    ["core→upgrade", await core.upgradeContract(), UPGRADE, "✅", "❌"],
    ["router→core", await router.coreContract(), CORE, "✅", "❌"],
    ["router→income", await router.incomeEngineContract(), INCOME, "✅", "❌"],
    ["income→core", await income.coreContract(), CORE, "✅", "❌"],
    ["income→router", await income.routerContract(), ROUTER, "✅", "❌"],
    ["income→upgrade", await income.upgradeEngineContract(), UPGRADE, "✅", "❌"],
    ["upgrade→core", await upgrade.coreContract(), CORE, "✅", "❌"],
    ["upgrade→income", await upgrade.incomeContract(), INCOME, "✅", "❌"],
  ] as const;

  let allGood = true;
  for (const [label, actual, expected, ok, fail] of checks) {
    const match = actual.toLowerCase() === expected.toLowerCase();
    if (!match) allGood = false;
    console.log(`${label.padEnd(16)}: ${match ? ok : fail + " GOT: " + actual}`);
  }
  console.log("\nAll wiring correct:", allGood ? "✅ YES" : "❌ NO — fix needed");

  console.log("\n=== USER #1 STATE ===");
  const u1 = await core.getUserById(1);
  console.log("wallet      :", u1.wallet ?? u1[1]);
  console.log("packageLevel:", u1.packageLevel?.toString() ?? u1[3]?.toString());
  console.log("sponsorId   :", u1.sponsorId?.toString() ?? u1[2]?.toString());

  console.log("\n=== PACKAGE PRICE ===");
  const pkg1 = await core.packagePricesArray(0);
  console.log("pkg1 price (units):", pkg1.toString());
  console.log("pkg1 price (USDT) :", ethers.formatUnits(pkg1 * BigInt(1e16), 18));

  console.log("\n=== defaultPaymentAsset ===");
  const dpa = await core.defaultPaymentAsset().catch(() => "N/A");
  console.log("defaultPaymentAsset:", dpa);
  console.log(
    "Matches USDT:",
    typeof dpa === "string" && dpa.toLowerCase() === USDT.toLowerCase() ? "✅" : "❌ WRONG: " + dpa
  );
}

main().catch(console.error);
