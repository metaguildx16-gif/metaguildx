import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;

  console.log("Core:", CORE);
  console.log("Income engine:", INCOME);
  console.log("Upgrade engine:", UPGRADE);

  const core = await ethers.getContractAt(
    [
      "function incomeEngineContract() view returns (address)",
      "function payoutUserIncome(uint256,uint256,address)",
      "function productionMode() view returns (bool)",
    ],
    CORE
  );

  const incomeEngine = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function upgradeEngineContract() view returns (address)",
      "function defaultPaymentAsset() view returns (address)",
      "function routeIncome(uint256,uint256,address,string)",
      "function getEscrow(uint256) view returns (uint256)",
      "function getTotalIncome(uint256) view returns (uint256)",
    ],
    INCOME
  );

  const upgradeEngine = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function incomeContract() view returns (address)",
      "function defaultPaymentAsset() view returns (address)",
      "function currentPackageLevel(uint256) view returns (uint256)",
      "function trackedIncome(uint256) view returns (uint256)",
      "function reactivationCount(uint256) view returns (uint256)",
    ],
    UPGRADE
  );

  console.log("core.incomeEngineContract():", await core.incomeEngineContract());
  console.log("core.productionMode():", await core.productionMode());

  console.log("income.coreContract():", await incomeEngine.coreContract());
  console.log("income.upgradeEngineContract():", await incomeEngine.upgradeEngineContract());
  console.log("income.defaultPaymentAsset():", await incomeEngine.defaultPaymentAsset());
  console.log("income.getEscrow(1):", (await incomeEngine.getEscrow(1n)).toString());
  console.log("income.getTotalIncome(1):", (await incomeEngine.getTotalIncome(1n)).toString());

  console.log("upgrade.coreContract():", await upgradeEngine.coreContract());
  console.log("upgrade.incomeContract():", await upgradeEngine.incomeContract());
  console.log("upgrade.defaultPaymentAsset():", await upgradeEngine.defaultPaymentAsset());

  for (const label of ["currentPackageLevel", "trackedIncome", "reactivationCount"] as const) {
    try {
      const value = await (upgradeEngine as unknown as Record<string, (arg: bigint) => Promise<bigint>>)[label](1n);
      console.log(`upgrade.${label}(1):`, value.toString());
    } catch (e) {
      const err = e as { message?: string };
      console.log(`upgrade.${label}(1) FAILED:`, err.message);
    }
  }

  const paymentAsset = await incomeEngine.defaultPaymentAsset();
  const directIncomeAmount = 46n;

  try {
    await incomeEngine.routeIncome.staticCall(1n, directIncomeAmount, paymentAsset, "direct");
    console.log("income.routeIncome.staticCall(): PASS");
  } catch (e) {
    const err = e as { message?: string; data?: unknown };
    console.log("income.routeIncome.staticCall() FAILED:", err.message);
    console.log(err.data ?? "no data");
  }

  try {
    await core.payoutUserIncome.staticCall(1n, directIncomeAmount, paymentAsset);
    console.log("core.payoutUserIncome.staticCall(): PASS");
  } catch (e) {
    const err = e as { message?: string; data?: unknown };
    console.log("core.payoutUserIncome.staticCall() FAILED:", err.message);
    console.log(err.data ?? "no data");
  }
}

main().catch(console.error);
