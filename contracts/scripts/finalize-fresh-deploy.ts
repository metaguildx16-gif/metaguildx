import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const ROUTER = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";
  const UPGRADE = "0x5Af0aC3662e047cFF3383BB5d53b0c6a8DABAe44";
  const TREE = "0x46C76AAf6AC4e5697bd546914aF9975C84a08f73";
  const CASHBACK = "0x9c89200Ebf93f620946794312dE83638C948777F";
  const STAKING = "0x2554D58400Da06224130301FFEd21889d1662B85";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const tree = await ethers.getContractAt("BinaryTree", TREE);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);
  const cashback = await ethers.getContractAt("CashbackPool", CASHBACK);
  const staking = await ethers.getContractAt("MGXStaking", STAKING);
  const [deployer] = await ethers.getSigners();
  let nextNonce = await ethers.provider.getTransactionCount(deployer.address, "pending");

  const run = async (label: string, txFactory: (nonce: number) => Promise<any>) => {
    const nonce = nextNonce++;
    const tx = await txFactory(nonce);
    console.log(label, tx.hash, "nonce", nonce);
    await tx.wait();
  };

  await run("configurePaymentAsset", (nonce) =>
    core.configurePaymentAsset(USDT, true, false, 10n ** 17n, { nonce })
  );
  await run("setProductionMode", (nonce) =>
    core.setProductionMode(true, USDT, { nonce })
  );
  await run("BinaryTree.setCoreContract", (nonce) =>
    tree.setCoreContract(CORE, { nonce })
  );
  await run("IncomeRouter.setCoreContract", (nonce) =>
    router.setCoreContract(CORE, { nonce })
  );
  await run("IncomeRouter.setIncomeEngineContract", (nonce) =>
    router.setIncomeEngineContract(INCOME, { nonce })
  );
  await run("IncomeRouter.setCreatorWallet", (nonce) =>
    router.setCreatorWallet(CREATOR, { nonce })
  );
  await run("Income.setCoreContract", (nonce) =>
    income.setCoreContract(CORE, { nonce })
  );
  await run("Income.setIncomeRouterContract", (nonce) =>
    income.setIncomeRouterContract(ROUTER, { nonce })
  );
  await run("Income.setUpgradeEngineContract", (nonce) =>
    income.setUpgradeEngineContract(UPGRADE, { nonce })
  );
  await run("Income.setDefaultPaymentAsset", (nonce) =>
    income.setDefaultPaymentAsset(USDT, { nonce })
  );
  await run("Upgrade.setCoreContract", (nonce) =>
    upgrade.setCoreContract(CORE, { nonce })
  );
  await run("Upgrade.setIncomeContract", (nonce) =>
    upgrade.setIncomeContract(INCOME, { nonce })
  );
  await run("Upgrade.setDefaultPaymentAsset", (nonce) =>
    upgrade.setDefaultPaymentAsset(USDT, { nonce })
  );
  await run("Cashback.setCoreContract", (nonce) =>
    cashback.setCoreContract(CORE, { nonce })
  );
  await run("Cashback.setPaymentAsset", (nonce) =>
    cashback.setPaymentAsset(USDT, { nonce })
  );
  await run("Staking.setCoreContract", (nonce) =>
    staking.setCoreContract(CORE, { nonce })
  );
  await run("Staking.setIncomeContract", (nonce) =>
    staking.setIncomeContract(ROUTER, { nonce })
  );

  console.log("Finalize complete");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
