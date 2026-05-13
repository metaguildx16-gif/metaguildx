import { ethers } from "hardhat";

async function main() {
  const CORE = "0xc3c34e64E65a455B7274747C90d77680D340AE6C";
  const ROUTER = "0x18260cfDF4069ceD210B7973965C1c99800C56D5";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const INCOME = "0x8efA8CC997F28A3DFd69eC8B790Bf7148E3C91cA";

  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  console.log("=== Router Config ===");

  try {
    const incEngine = await router.incomeEngineContract();
    console.log("incomeEngineContract:", incEngine);
    console.log("Expected:", INCOME);
    console.log("Match:", incEngine.toLowerCase() === INCOME.toLowerCase());
  } catch (e: any) {
    console.log("incomeEngineContract error:", e.message);
  }

  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  console.log("\n=== Income Engine Config ===");

  try {
    const incRouter = await (income as any).incomeRouterContract?.();
    console.log("income.incomeRouter:", incRouter);
  } catch (e: any) {
    console.log("incomeRouter:", e.message);
  }

  try {
    const upgradeEngine = await (income as any).upgradeEngineContract?.();
    console.log("income.upgradeEngine:", upgradeEngine);
  } catch (e: any) {
    console.log("upgradeEngine:", e.message);
  }

  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  console.log("\n=== USDT State ===");
  const coreBal = await usdt.balanceOf(CORE);
  console.log("Core USDT:", ethers.formatEther(coreBal));

  const coreToRouter = await usdt.allowance(CORE, ROUTER);
  console.log("Core→Router allowance:", ethers.formatEther(coreToRouter));

  const coreToIncome = await usdt.allowance(CORE, INCOME);
  console.log("Core→Income allowance:", ethers.formatEther(coreToIncome));

  console.log("\n=== Router Payment Asset ===");
  try {
    const unitPrice = await (router as any).paymentAssetUnitPrice?.(USDT);
    console.log("Router USDT unit price:", unitPrice?.toString());
  } catch (e: any) {
    console.log("Router unitPrice:", e.message);
  }

  console.log("\n=== Simulate Distribution ===");

  const DEPLOY_BLOCK = 156420051;
  const latest = await ethers.provider.getBlockNumber();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const userRegisteredFilter = core.filters.UserRegistered();
  const regEvents = await core.queryFilter(userRegisteredFilter, DEPLOY_BLOCK, latest);
  console.log("Registration events:", regEvents.length);

  for (const e of regEvents) {
    const receipt = await e.getTransactionReceipt();
    console.log("\nTX:", receipt.hash);
    console.log("Status:", receipt.status);
    console.log("Logs count:", receipt.logs.length);

    receipt.logs.forEach((log, i) => {
      console.log(`Log ${i}: address=${log.address}`);
      console.log(`  topic0: ${log.topics[0]}`);
    });
  }
}

main().catch(console.error);
