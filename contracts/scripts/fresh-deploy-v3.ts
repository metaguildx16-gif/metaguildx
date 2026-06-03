import fs from "fs";
import path from "path";
import { ethers, network, upgrades } from "hardhat";

type UupsDeployment = {
  proxy: Awaited<ReturnType<typeof upgrades.deployProxy>>;
  proxyAddress: string;
  implementationAddress: string;
};

type DeployedAddresses = {
  network: string;
  deployBlock: number;
  Core: string;
  Income: string;
  Router: string;
  BinaryTree: string;
  Upgrade: string;
  CashbackPool: string;
  MGXStaking: string;
  MGXToken: string;
  TokenEngine: string;
  USDT: string;
  timestamp: string;
};

const CREATOR_WALLET = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
const PLACEMENT_SIGNER = "0xeD1b72f5891Da4C4e011Ac6D0F5B96202C4a4168";
const PLATFORM_DECIMALS = 1n;
const SETTLEMENT_DECIMALS = 18n;
const USDT_UNIT_PRICE = 10n ** (SETTLEMENT_DECIMALS - PLATFORM_DECIMALS);
const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const DEPLOYMENT_CHECKLIST_PATH = path.join(__dirname, "..", "DEPLOYMENT_CHECKLIST.md");

async function deployUupsProxy(
  contractName: string,
  initializerArgs: unknown[],
  libraries?: Record<string, string>
): Promise<UupsDeployment> {
  console.log(`Deploying ${contractName} proxy...`);
  const factory = await ethers.getContractFactory(
    contractName,
    libraries ? { libraries } : undefined
  );
  const proxy = await upgrades.deployProxy(factory, initializerArgs, {
    kind: "uups",
    initializer: "initialize",
    unsafeAllowLinkedLibraries: Boolean(libraries)
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`${contractName} proxy: ${proxyAddress}`);
  console.log(`${contractName} implementation: ${implementationAddress}`);

  return { proxy, proxyAddress, implementationAddress };
}

function updateDeploymentChecklist(addresses: DeployedAddresses) {
  let checklist = fs.readFileSync(DEPLOYMENT_CHECKLIST_PATH, "utf8");

  checklist = checklist.replace(
    /## Contract Addresses \(opBNB Testnet\)[\s\S]*?## Critical Bug Fixes Applied/,
    `## Contract Addresses (opBNB Testnet)
Core:         ${addresses.Core}
Income:       ${addresses.Income}
Upgrade:      ${addresses.Upgrade}
Router:       ${addresses.Router}
BinaryTree:   ${addresses.BinaryTree}
CashbackPool: ${addresses.CashbackPool}
MGXStaking:   ${addresses.MGXStaking}
MGXToken:     ${addresses.MGXToken}
TokenEngine:  ${addresses.TokenEngine}
USDT:         ${addresses.USDT}
Deploy Block: ${addresses.deployBlock}

## Critical Bug Fixes Applied`
  );

  fs.writeFileSync(DEPLOYMENT_CHECKLIST_PATH, checklist);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const creatorWallet = process.env.CREATOR_WALLET || CREATOR_WALLET;
  const placementSigner = process.env.PLACEMENT_SIGNER_ADDRESS || PLACEMENT_SIGNER;
  const USDT_ADDRESS =
    network.name === "opbnbMainnet"
      ? "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3"
      : "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  console.log("=== MetaGuildX V3 Fresh Deploy ===");
  console.log("Network :", network.name);
  console.log("Deployer:", deployer.address);

  const paymentLibFactory = await ethers.getContractFactory("MetaGuildXPaymentLib");
  const paymentLib = await paymentLibFactory.deploy();
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();

  const placementLibFactory = await ethers.getContractFactory("MetaGuildXPlacementLib");
  const placementLib = await placementLibFactory.deploy();
  await placementLib.waitForDeployment();
  const placementLibAddress = await placementLib.getAddress();

  const upgradeCycleLibFactory = await ethers.getContractFactory("UpgradeCycleLib");
  const upgradeCycleLib = await upgradeCycleLibFactory.deploy();
  await upgradeCycleLib.waitForDeployment();
  const upgradeCycleLibAddress = await upgradeCycleLib.getAddress();

  console.log("\n1. Deploying MGXToken...");
  const mgxTokenFactory = await ethers.getContractFactory("MGXToken");
  const mgxToken = await mgxTokenFactory.deploy(deployer.address);
  await mgxToken.waitForDeployment();
  const mgxTokenAddress = await mgxToken.getAddress();

  console.log("2. Reusing fixed USDT...");
  const usdtAddress = process.env.USDT_ADDRESS || USDT_ADDRESS;

  await (await mgxToken.mintLaunchAllocations(deployer.address, deployer.address, deployer.address)).wait();

  console.log("3. Deploying MetaGuildXIncome...");
  const income = await deployUupsProxy("MetaGuildXIncome", [
    deployer.address,
    deployer.address,
    deployer.address,
    usdtAddress
  ]);

  console.log("4. Deploying MetaGuildXBinaryTree...");
  const binaryTree = await deployUupsProxy("BinaryTree", [deployer.address]);

  console.log("5. Deploying MetaGuildXCashbackPool...");
  const cashback = await deployUupsProxy("CashbackPool", [deployer.address]);

  console.log("6. Deploying MetaGuildXCore...");
  const core = await deployUupsProxy("MetaGuildXCore", [deployer.address], {
    MetaGuildXPaymentLib: paymentLibAddress,
    MetaGuildXPlacementLib: placementLibAddress,
    UpgradeCycleLib: upgradeCycleLibAddress
  });

  console.log("7. Deploying IncomeRouter...");
  const router = await deployUupsProxy("IncomeRouter", [deployer.address]);

  console.log("8. Deploying MetaGuildXUpgrade...");
  const upgrade = await deployUupsProxy("MetaGuildXUpgrade", [
    core.proxyAddress,
    income.proxyAddress,
    usdtAddress
  ]);

  console.log("9. Deploying MGXStaking...");
  const staking = await deployUupsProxy("MGXStaking", [deployer.address]);

  console.log("10. Deploying MetaGuildXTokenEngine...");
  const tokenEngine = await deployUupsProxy("MetaGuildXTokenEngine", [core.proxyAddress]);

  const coreContract = await ethers.getContractAt("MetaGuildXCore", core.proxyAddress);
  const incomeContract = await ethers.getContractAt("MetaGuildXIncome", income.proxyAddress);
  const routerContract = await ethers.getContractAt("IncomeRouter", router.proxyAddress);
  const binaryTreeContract = await ethers.getContractAt("BinaryTree", binaryTree.proxyAddress);
  const cashbackContract = await ethers.getContractAt("CashbackPool", cashback.proxyAddress);
  const upgradeContract = await ethers.getContractAt("MetaGuildXUpgrade", upgrade.proxyAddress);
  const stakingContract = await ethers.getContractAt("MGXStaking", staking.proxyAddress);
  const tokenEngineContract = await ethers.getContractAt("MetaGuildXTokenEngine", tokenEngine.proxyAddress);

  console.log("\nWiring contracts...");
  await (await coreContract.setIncomeRouterContract(router.proxyAddress)).wait();
  await (await coreContract.setBinaryTreeContract(binaryTree.proxyAddress)).wait();
  await (await coreContract.setCashbackPoolContract(cashback.proxyAddress)).wait();
  await (await coreContract.setUpgradeEngineContract(upgrade.proxyAddress)).wait();
  await (await coreContract.setIncomeEngineContract(income.proxyAddress)).wait();
  await (await coreContract.setTokenEngineContract(tokenEngine.proxyAddress)).wait();
  await (await coreContract.setStakingContract(staking.proxyAddress)).wait();
  await (await coreContract.setCreatorFeeWallet(creatorWallet)).wait();
  await (await coreContract.setPlacementSigner(placementSigner)).wait();
  await (await coreContract.setMgxTokenAddress(mgxTokenAddress)).wait();

  console.log("\nConfiguring USDT payment asset...");
  await (await coreContract.setUsdtAddress(usdtAddress)).wait();
  console.log("usdtAddress set ✅");
  await (await coreContract.setDefaultPaymentAsset(usdtAddress)).wait();
  console.log("defaultPaymentAsset set to USDT ✅");
  await (await coreContract.configurePaymentAsset(usdtAddress, true, false, USDT_UNIT_PRICE)).wait();
  console.log("USDT enabled as payment asset ✅");

  const defaultAsset = await coreContract.defaultPaymentAsset();
  const enabled = await coreContract.enabledPaymentAssets(usdtAddress);
  const unitPrice = await coreContract.paymentAssetUnitPrice(usdtAddress);
  const configuredUsdt = await coreContract.usdtAddress();

  if (defaultAsset.toLowerCase() !== usdtAddress.toLowerCase()) {
    throw new Error("defaultPaymentAsset not set correctly!");
  }
  if (configuredUsdt.toLowerCase() !== usdtAddress.toLowerCase()) {
    throw new Error("usdtAddress not set correctly!");
  }
  if (!enabled) {
    throw new Error("USDT payment asset was not enabled!");
  }
  if (unitPrice !== USDT_UNIT_PRICE) {
    throw new Error(`USDT unit price mismatch: expected ${USDT_UNIT_PRICE.toString()}, got ${unitPrice.toString()}`);
  }
  console.log("Payment asset verified ✅");

  await (await routerContract.setCoreContract(core.proxyAddress)).wait();
  await (await routerContract.setIncomeEngineContract(income.proxyAddress)).wait();
  await (await routerContract.setCreatorWallet(creatorWallet)).wait();

  await (await incomeContract.setCoreContract(core.proxyAddress)).wait();
  await (await incomeContract.setIncomeRouterContract(router.proxyAddress)).wait();
  await (await incomeContract.setUpgradeEngineContract(upgrade.proxyAddress)).wait();
  await (await incomeContract.setDefaultPaymentAsset(usdtAddress)).wait();

  await (await binaryTreeContract.setCoreContract(core.proxyAddress)).wait();

  await (await upgradeContract.setCoreContract(core.proxyAddress)).wait();
  await (await upgradeContract.setIncomeContract(income.proxyAddress)).wait();
  await (await upgradeContract.setRouterContract(router.proxyAddress)).wait();
  await (await upgradeContract.setDefaultPaymentAsset(usdtAddress)).wait();

  await (await tokenEngineContract.setCoreContract(core.proxyAddress)).wait();

  await (await cashbackContract.setCoreContract(core.proxyAddress)).wait();
  await (await cashbackContract.setPaymentAsset(usdtAddress)).wait();

  await (await stakingContract.setCoreContract(core.proxyAddress)).wait();
  await (await stakingContract.setIncomeContract(router.proxyAddress)).wait();

  console.log("\nPost-deploy config...");
  console.log("Package prices are already set in MetaGuildXCore.initialize()");
  const testnetProductionMode = true;
  await (await coreContract.setProductionMode(testnetProductionMode, usdtAddress)).wait();
  console.log("productionMode set to:", testnetProductionMode, "✅");

  const deployBlock = await ethers.provider.getBlockNumber();
  const addresses: DeployedAddresses = {
    network: network.name,
    deployBlock,
    Core: core.proxyAddress,
    Income: income.proxyAddress,
    Router: router.proxyAddress,
    BinaryTree: binaryTree.proxyAddress,
    Upgrade: upgrade.proxyAddress,
    CashbackPool: cashback.proxyAddress,
    MGXStaking: staking.proxyAddress,
    MGXToken: mgxTokenAddress,
    TokenEngine: tokenEngine.proxyAddress,
    USDT: usdtAddress,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(DEPLOYED_ADDRESSES_PATH, JSON.stringify(addresses, null, 2));
  updateDeploymentChecklist(addresses);

  console.log("\n=== DEPLOYED ADDRESSES ===");
  console.log("Core:", addresses.Core);
  console.log("Income:", addresses.Income);
  console.log("Router:", addresses.Router);
  console.log("BinaryTree:", addresses.BinaryTree);
  console.log("Upgrade:", addresses.Upgrade);
  console.log("CashbackPool:", addresses.CashbackPool);
  console.log("MGXStaking:", addresses.MGXStaking);
  console.log("MGXToken:", addresses.MGXToken);
  console.log("TokenEngine:", addresses.TokenEngine);
  console.log("USDT:", addresses.USDT);
  console.log("Deploy Block:", addresses.deployBlock);
  console.log("Addresses saved to deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
