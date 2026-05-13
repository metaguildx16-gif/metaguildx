import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);

  console.log("Rolling back Core wiring...");
  console.log("Core:", CORE);

  await (
    await core.setIncomeRouterContract(
      "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35"
    )
  ).wait();
  console.log("Router rolled back ✅");

  await (
    await core.setIncomeEngineContract(
      "0x2A55927a1f521572096A4983767F126626D8ac21"
    )
  ).wait();
  console.log("Income rolled back ✅");

  await (
    await core.setUpgradeEngineContract(
      "0x6527801f7726540fB8b052d0deb8648D755d4EEF"
    )
  ).wait();
  console.log("Upgrade rolled back ✅");

  await (
    await core.setCashbackPoolContract(
      "0x6A9d0A18B64ecECc06284D1d8ee87224e1a8a319"
    )
  ).wait();
  console.log("Cashback rolled back ✅");

  await (
    await core.setBinaryTreeContract(
      "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82"
    )
  ).wait();
  console.log("BinaryTree rolled back ✅");

  const router = await core.incomeRouterContract();
  const income = await core.incomeEngineContract();
  const nextId = await core.nextUserId();

  console.log("\n=== VERIFICATION ===");
  console.log("nextUserId:", nextId.toString());
  console.log("router:", router);
  console.log("income:", income);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
