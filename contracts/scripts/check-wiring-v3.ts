import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
  const MANAGER = "0xaDd9CB8B67D9710560F5BEa150393B085C726A91";
const CASHBACK = process.env.CASHBACK_POOL_ADDRESS!;
const TREE = process.env.BINARY_TREE_ADDRESS!;
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
  const SIGNER = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const provider = ethers.provider;

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const usdt = new ethers.Contract(
    USDT,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    provider
  );

  console.log("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
  console.log("V3 WIRING CHECK");
  console.log("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");

  const coreRouter = await core.incomeRouterContract();
  const coreIncome = await core.incomeEngineContract();
  const coreUpgrade = await core.upgradeEngineContract();
  const coreCashback = await core.cashbackPoolContract();
  const coreTree = await core.binaryTreeContract();
  const coreUsdt = await core.defaultPaymentAsset();
  const usdtEnabled = await core.enabledPaymentAssets(USDT);
  const usdtPrice = await core.paymentAssetUnitPrice(USDT);
  const production = await core.productionMode();
  const nextUser = await core.nextUserId();
  const rootUser = await core.rootUserId();
  const creator = await core.creatorFeeWallet();
  const signer = await core.placementSigner();

  console.log("\n[MetaGuildXCore]");
  console.log("incomeRouterContract :", coreRouter);
  console.log("incomeEngineContract :", coreIncome);
  console.log("upgradeEngineContract:", coreUpgrade);
  console.log("cashbackPoolContract :", coreCashback);
  console.log("binaryTreeContract   :", coreTree);
  console.log("defaultPaymentAsset  :", coreUsdt);
  console.log("USDT enabled         :", usdtEnabled);
  console.log("USDT unit price      :", usdtPrice.toString());
  console.log("productionMode       :", production);
  console.log("nextUserId           :", nextUser.toString());
  console.log("rootUserId           :", rootUser.toString());
  console.log("creatorFeeWallet     :", creator);
  console.log("placementSigner      :", signer);

  const routerCore = await router.coreContract();
  const routerCreator = await router.creatorWallet();
  let routerEngine = "N/A";
  try {
    routerEngine = await (router as any).incomeEngineContract();
  } catch {
    routerEngine = "no public getter";
  }

  console.log("\n[IncomeRouter]");
  console.log("coreContract  :", routerCore);
  console.log("creatorWallet :", routerCreator);
  console.log("incomeEngine  :", routerEngine);

  const incomeCore = await income.coreContract();
  const incomeUpgrade = await income.upgradeEngineContract();
  const incomeDefault = await income.defaultPaymentAsset();

  console.log("\n[MetaGuildXIncome]");
  console.log("coreContract         :", incomeCore);
  console.log("upgradeEngineContract:", incomeUpgrade);
  console.log("defaultPaymentAsset  :", incomeDefault);

  const decimals = await usdt.decimals();
  const fmt = (v: bigint) => ethers.formatUnits(v, decimals);
  const coreBal = await usdt.balanceOf(CORE);
  const routerBal = await usdt.balanceOf(ROUTER);
  const incomeBal = await usdt.balanceOf(INCOME);

  console.log("\n[USDT Balances]");
  console.log("Core contract   :", fmt(coreBal));
  console.log("Router contract :", fmt(routerBal));
  console.log("Income contract :", fmt(incomeBal));

  console.log("\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
  console.log("MATCH CHECKS");
  console.log("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");

  const check = (label: string, a: string, b: string) => {
    const match = a.toLowerCase() === b.toLowerCase();
    console.log(label + ":", match ? "âœ…" : "âŒ MISMATCH");
    if (!match) {
      console.log("  Expected:", b);
      console.log("  Got     :", a);
    }
  };

  check("Coreâ†’Router    ", coreRouter, ROUTER);
  check("Coreâ†’Income    ", coreIncome, INCOME);
  check("Coreâ†’Upgrade   ", coreUpgrade, UPGRADE);
  check("Coreâ†’Cashback  ", coreCashback, CASHBACK);
  check("Coreâ†’Tree      ", coreTree, TREE);
  check("Routerâ†’Core    ", routerCore, CORE);
  check("Incomeâ†’Core    ", incomeCore, CORE);
  check("Incomeâ†’Upgrade ", incomeUpgrade, UPGRADE);
  check("Coreâ†’Creator   ", creator, CREATOR);
  check("Routerâ†’Creator ", routerCreator, CREATOR);
  check("Coreâ†’Signer    ", signer, SIGNER);

  console.log("UpgradeManager  :", MANAGER);
  console.log("USDT configured   :", usdtEnabled ? "âœ…" : "âŒ NOT ENABLED");
  console.log("USDT price set    :", usdtPrice > 0n ? "âœ… " + usdtPrice.toString() : "âŒ ZERO");
  console.log("Production mode   :", production ? "âœ… ON" : "âš ï¸ OFF (test mode)");
  console.log("Root registered   :", rootUser > 0n ? "âœ… userId=" + rootUser : "âŒ NOT YET");
  console.log("Total users       :", (nextUser - 1n).toString());

  console.log("\nâ”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
  console.log(
    "SYSTEM READY:",
    [
      coreRouter.toLowerCase() === ROUTER.toLowerCase(),
      coreIncome.toLowerCase() === INCOME.toLowerCase(),
      routerCore.toLowerCase() === CORE.toLowerCase(),
      incomeCore.toLowerCase() === CORE.toLowerCase(),
      usdtEnabled,
      usdtPrice > 0n,
      rootUser > 0n
    ].every(Boolean)
      ? "âœ… YES"
      : "âŒ FIX NEEDED"
  );
  console.log("â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”");
}

main().catch(console.error);
