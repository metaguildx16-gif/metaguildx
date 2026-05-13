import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);

  console.log("Switching to NEW stack...");

  await (await core.setIncomeRouterContract("0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8")).wait();
  console.log("Router → NEW ✅");

  await (await core.setIncomeEngineContract("0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB")).wait();
  console.log("Income → NEW ✅");

  await (await core.setUpgradeEngineContract("0x8CF75a78641a0e390C0101a1541Bed82E3214A9A")).wait();
  console.log("Upgrade → NEW ✅");

  await (await core.setBinaryTreeContract("0x93ceF78C90ED74f243123B51f153B601eF47010e")).wait();
  console.log("Tree → NEW ✅");

  await (await core.setCashbackPoolContract("0x1F207B70812652b9fd9b9CC0FCfcef35CeeEe755")).wait();
  console.log("Cashback → NEW ✅");

  const nextId = await core.nextUserId();
  const router = await core.incomeRouterContract();
  console.log("\nnextUserId:", nextId.toString());
  console.log("router:", router);
  console.log("Switch complete ✅");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
