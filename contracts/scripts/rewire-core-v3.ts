import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  console.log("Rewiring Core:", CORE);
  console.log("Signer:", deployer.address);

  await (await core.setIncomeRouterContract(
    "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8"
  )).wait();
  console.log("Router set ✅");

  await (await core.setIncomeEngineContract(
    "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB"
  )).wait();
  console.log("Income set ✅");

  await (await core.setUpgradeEngineContract(
    "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A"
  )).wait();
  console.log("Upgrade set ✅");

  await (await core.setBinaryTreeContract(
    "0x93ceF78C90ED74f243123B51f153B601eF47010e"
  )).wait();
  console.log("BinaryTree set ✅");

  await (await core.setCashbackPoolContract(
    "0x1F207B70812652b9fd9b9CC0FCfcef35CeeEe755"
  )).wait();
  console.log("Cashback set ✅");

  const router = await core.incomeRouterContract();
  const income = await core.incomeEngineContract();
  const upgrade = await core.upgradeEngineContract();
  const tree = await core.binaryTreeContract();
  const nextId = await core.nextUserId();

  console.log("\n=== VERIFICATION ===");
  console.log("nextUserId:", nextId.toString());
  console.log("router:", router);
  console.log("income:", income);
  console.log("upgrade:", upgrade);
  console.log("tree:", tree);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
