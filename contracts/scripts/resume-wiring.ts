import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const ADDRESSES = {
  core: process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY || "",
  income: process.env.INCOME_ENGINE_ADDRESS || "",
  upgrade: process.env.UPGRADE_ENGINE_ADDRESS || "",
  router: process.env.INCOME_ROUTER_ADDRESS || process.env.INCOME_ROUTER_PROXY || "",
  tree: process.env.BINARY_TREE_ADDRESS || "",
  cashback: process.env.CASHBACK_POOL_ADDRESS || "",
  staking: process.env.MGX_STAKING_ADDRESS || "",
  mgxToken: process.env.MGX_TOKEN_ADDRESS || "",
  usdt: process.env.MOCK_USDT_ADDRESS || process.env.USDT_ADDRESS || "",
} as const;

type Step = {
  label: string;
  run: () => Promise<void>;
  verify: () => Promise<string>;
};

async function main() {
  const [baseSigner] = await ethers.getSigners();
  const signer = new ethers.NonceManager(baseSigner);
  const creatorWallet = process.env.CREATOR_WALLET || baseSigner.address;
  const placementSigner = process.env.PLACEMENT_SIGNER_ADDRESS || baseSigner.address;
  const unitPrice = 10n ** 17n;

  for (const [label, value] of Object.entries(ADDRESSES)) {
    if (!value) {
      throw new Error(`Missing address for ${label} in .env`);
    }
  }

  console.log("Resuming MetaGuildX wiring...");
  console.log("Signer:", await signer.getAddress());

  const core = await ethers.getContractAt("MetaGuildXCore", ADDRESSES.core, signer);
  const income = await ethers.getContractAt("MetaGuildXIncome", ADDRESSES.income, signer);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", ADDRESSES.upgrade, signer);
  const router = await ethers.getContractAt("IncomeRouter", ADDRESSES.router, signer);
  const tree = await ethers.getContractAt("BinaryTree", ADDRESSES.tree, signer);
  const cashback = await ethers.getContractAt("CashbackPool", ADDRESSES.cashback, signer);
  const staking = await ethers.getContractAt("MGXStaking", ADDRESSES.staking, signer);

  const steps: Step[] = [
    {
      label: "core.setBinaryTreeContract",
      run: async () => { await (await core.setBinaryTreeContract(ADDRESSES.tree)).wait(); },
      verify: async () => `binaryTreeContract=${await core.binaryTreeContract()}`,
    },
    {
      label: "core.setIncomeRouterContract",
      run: async () => { await (await core.setIncomeRouterContract(ADDRESSES.router)).wait(); },
      verify: async () => `incomeRouterContract=${await core.incomeRouterContract()}`,
    },
    {
      label: "core.setIncomeEngineContract",
      run: async () => { await (await core.setIncomeEngineContract(ADDRESSES.income)).wait(); },
      verify: async () => `incomeEngineContract=${await core.incomeEngineContract()}`,
    },
    {
      label: "core.setUpgradeEngineContract",
      run: async () => { await (await core.setUpgradeEngineContract(ADDRESSES.upgrade)).wait(); },
      verify: async () => `upgradeEngineContract=${await core.upgradeEngineContract()}`,
    },
    {
      label: "core.setCashbackPoolContract",
      run: async () => { await (await core.setCashbackPoolContract(ADDRESSES.cashback)).wait(); },
      verify: async () => `cashbackPoolContract=${await core.cashbackPoolContract()}`,
    },
    {
      label: "core.setStakingContract",
      run: async () => { await (await core.setStakingContract(ADDRESSES.staking)).wait(); },
      verify: async () => `stakingContract=${await core.stakingContract()}`,
    },
    {
      label: "core.setUsdtAddress",
      run: async () => { await (await core.setUsdtAddress(ADDRESSES.usdt)).wait(); },
      verify: async () => `usdtAddress=${await core.usdtAddress()}`,
    },
    {
      label: "core.setMgxTokenAddress",
      run: async () => { await (await core.setMgxTokenAddress(ADDRESSES.mgxToken)).wait(); },
      verify: async () => `mgxTokenAddress=${await core.mgxTokenAddress()}`,
    },
    {
      label: "core.setDefaultPaymentAsset",
      run: async () => { await (await core.setDefaultPaymentAsset(ADDRESSES.usdt)).wait(); },
      verify: async () => `defaultPaymentAsset=${await core.defaultPaymentAsset()}`,
    },
    {
      label: "core.setCreatorFeeWallet",
      run: async () => { await (await core.setCreatorFeeWallet(creatorWallet)).wait(); },
      verify: async () => `creatorFeeWallet=${await core.creatorFeeWallet()}`,
    },
    {
      label: "core.setPlacementSigner",
      run: async () => { await (await core.setPlacementSigner(placementSigner)).wait(); },
      verify: async () => `placementSigner=${await core.placementSigner()}`,
    },
    {
      label: "core.configurePaymentAsset",
      run: async () => { await (await core.configurePaymentAsset(ADDRESSES.usdt, true, false, unitPrice)).wait(); },
      verify: async () => {
        const enabled = await core.enabledPaymentAssets(ADDRESSES.usdt);
        const price = await core.paymentAssetUnitPrice(ADDRESSES.usdt);
        return `paymentAsset enabled=${enabled} unitPrice=${price.toString()}`;
      },
    },
    {
      label: "core.setProductionMode",
      run: async () => { await (await core.setProductionMode(true, ADDRESSES.usdt)).wait(); },
      verify: async () => `productionMode=${await core.productionMode()}`,
    },
    {
      label: "cashback.setPaymentAsset",
      run: async () => { await (await cashback.setPaymentAsset(ADDRESSES.usdt)).wait(); },
      verify: async () => `paymentAsset=${await cashback.paymentAsset()}`,
    },
    {
      label: "income.setCoreContract",
      run: async () => { await (await income.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await income.coreContract()}`,
    },
    {
      label: "upgrade.setCoreContract",
      run: async () => { await (await upgrade.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await upgrade.coreContract()}`,
    },
    {
      label: "router.setCoreContract",
      run: async () => { await (await router.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await router.coreContract()}`,
    },
    {
      label: "tree.setCoreContract",
      run: async () => { await (await tree.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await tree.coreContract()}`,
    },
    {
      label: "income.setIncomeRouterContract",
      run: async () => { await (await income.setIncomeRouterContract(ADDRESSES.router)).wait(); },
      verify: async () => `incomeRouterContract=${await income.incomeRouterContract()}`,
    },
    {
      label: "income.setUpgradeEngineContract",
      run: async () => { await (await income.setUpgradeEngineContract(ADDRESSES.upgrade)).wait(); },
      verify: async () => `upgradeEngineContract=${await income.upgradeEngineContract()}`,
    },
    {
      label: "income.setDefaultPaymentAsset",
      run: async () => { await (await income.setDefaultPaymentAsset(ADDRESSES.usdt)).wait(); },
      verify: async () => `defaultPaymentAsset=${await income.defaultPaymentAsset()}`,
    },
    {
      label: "upgrade.setIncomeContract",
      run: async () => { await (await upgrade.setIncomeContract(ADDRESSES.income)).wait(); },
      verify: async () => `incomeContract=${await upgrade.incomeContract()}`,
    },
    {
      label: "upgrade.setDefaultPaymentAsset",
      run: async () => { await (await upgrade.setDefaultPaymentAsset(ADDRESSES.usdt)).wait(); },
      verify: async () => `defaultPaymentAsset=${await upgrade.defaultPaymentAsset()}`,
    },
    {
      label: "router.setIncomeEngineContract",
      run: async () => { await (await router.setIncomeEngineContract(ADDRESSES.income)).wait(); },
      verify: async () => `incomeEngineContract=${await router.incomeEngineContract()}`,
    },
    {
      label: "router.setCreatorWallet",
      run: async () => { await (await router.setCreatorWallet(creatorWallet)).wait(); },
      verify: async () => `creatorWallet=${await router.creatorWallet()}`,
    },
    {
      label: "cashback.setCoreContract",
      run: async () => { await (await cashback.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await cashback.coreContract()}`,
    },
    {
      label: "staking.setCoreContract",
      run: async () => { await (await staking.setCoreContract(ADDRESSES.core)).wait(); },
      verify: async () => `coreContract=${await staking.coreContract()}`,
    },
    {
      label: "staking.setIncomeContract",
      run: async () => { await (await staking.setIncomeContract(ADDRESSES.router)).wait(); },
      verify: async () => `incomeContract=${await staking.incomeContract()}`,
    },
  ];

  for (const step of steps) {
    console.log(`RUN  ${step.label}`);
    await step.run();
    const verified = await step.verify();
    console.log(`PASS ${step.label} -> ${verified}`);
  }

  console.log("");
  console.log("=== FINAL VERIFY ===");
  console.log("Core:", await core.getAddress());
  console.log("BinaryTree:", await core.binaryTreeContract());
  console.log("Router:", await core.incomeRouterContract());
  console.log("Income:", await core.incomeEngineContract());
  console.log("Upgrade:", await core.upgradeEngineContract());
  console.log("Cashback:", await core.cashbackPoolContract());
  console.log("Staking:", await core.stakingContract());
  console.log("USDT:", await core.usdtAddress());
  console.log("Default payment asset:", await core.defaultPaymentAsset());
  console.log("Placement signer:", await core.placementSigner());
  console.log("Production mode:", await core.productionMode());
  console.log("Tree core:", await tree.coreContract());
  console.log("Router core:", await router.coreContract());
  console.log("Income core:", await income.coreContract());
  console.log("Upgrade core:", await upgrade.coreContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
