import { ethers } from "hardhat";

async function main() {
  const CORE = "0x0Ae6275740A14AD04B360940425cfb8Ff412C290";
  const INCOME = "0xE592477Dc37C04E29c66b5C549B11E6d6327f4dF";
  const ROUTER = "0x232d052aE450fEE285343dACbE09DdD1FC71ee9F";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  console.log("=== CORE ===");
  console.log("incomeRouterContract:", await core.incomeRouterContract());
  console.log("incomeEngineContract:", await core.incomeEngineContract());
  console.log("defaultPaymentAsset :", await core.defaultPaymentAsset());

  console.log("\n=== ROUTER ===");
  console.log("coreContract        :", await router.coreContract());
  console.log("incomeEngineContract:", await router.incomeEngineContract());
  console.log("creatorWallet       :", await router.creatorWallet());

  console.log("\n=== INCOME ===");
  console.log("coreContract        :", await income.coreContract());
  console.log("incomeRouterContract:", await income.incomeRouterContract());

  console.log("\n=== VALIDATION ===");
  console.log("core→router :", (await core.incomeRouterContract()).toLowerCase() === ROUTER.toLowerCase() ? "✅" : "❌");
  console.log("core→income :", (await core.incomeEngineContract()).toLowerCase() === INCOME.toLowerCase() ? "✅" : "❌");
  console.log("router→core :", (await router.coreContract()).toLowerCase() === CORE.toLowerCase() ? "✅" : "❌");
  console.log("router→income:", (await router.incomeEngineContract()).toLowerCase() === INCOME.toLowerCase() ? "✅" : "❌");
  console.log("income→core :", (await income.coreContract()).toLowerCase() === CORE.toLowerCase() ? "✅" : "❌");
  console.log("income→router:", (await income.incomeRouterContract()).toLowerCase() === ROUTER.toLowerCase() ? "✅" : "❌");
  console.log("USDT match  :", (await core.defaultPaymentAsset()).toLowerCase() === USDT.toLowerCase() ? "✅" : "❌");

  console.log("\n=== STATE ===");
  console.log("nextUserId:", (await core.nextUserId()).toString());
  console.log("pkg1 price:", (await core.getPackagePriceByLevel(1)).toString(), "units");
}

main().catch(console.error);
