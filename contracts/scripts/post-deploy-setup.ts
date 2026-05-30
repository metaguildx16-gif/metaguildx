import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

type DeployedAddresses = {
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
  deployBlock: number;
};

const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const EXPECTED_USDT_UNIT_PRICE = 10n ** 17n;
const DEFAULT_STAKING_REWARD_RATE = 3; // 3 bps/day ~= 10.95% simple annualized

function loadAddresses(): DeployedAddresses {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

async function main() {
  const addresses = loadAddresses();
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const USDT_ADDRESS =
    network.name === "opbnbMainnet"
      ? "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3"
      : "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const SAFE_ADDRESS =
    network.name === "opbnbMainnet"
      ? "0x6D01d1E9771193467B5fae47Ce8463d7060098eA"
      : "";

  console.log("=== Post-Deploy Setup ===");
  console.log("Deployer:", deployer.address);
  if (SAFE_ADDRESS) {
    console.log("Target Safe owner:", SAFE_ADDRESS);
  }

  const core = await ethers.getContractAt("MetaGuildXCore", addresses.Core);
  const staking = await ethers.getContractAt("MGXStaking", addresses.MGXStaking);
  const token = await ethers.getContractAt("MGXToken", addresses.MGXToken);
  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function approve(address,uint256) returns (bool)",
      "function decimals() view returns (uint8)",
      "function mint(address,uint256)"
    ],
    USDT_ADDRESS,
    deployer
  );

  console.log("\n1. Verifying payment asset and wiring...");
  const [
    paymentAsset,
    usdtAddress,
    usdtEnabled,
    usdtUnitPrice,
    productionMode,
    creatorWallet,
    routerAddress,
    incomeAddress,
    tokenEngineAddress,
    binaryTreeAddress,
    packagePrices
  ] = await Promise.all([
    core.defaultPaymentAsset(),
    core.usdtAddress(),
    core.enabledPaymentAssets(USDT_ADDRESS),
    core.paymentAssetUnitPrice(USDT_ADDRESS),
    core.productionMode(),
    core.creatorFeeWallet(),
    core.incomeRouterContract(),
    core.incomeEngineContract(),
    core.tokenEngineContract(),
    core.binaryTreeContract(),
    core.getPackagePrices()
  ]);

  console.log("defaultPaymentAsset:", paymentAsset);
  console.log("usdtAddress:", usdtAddress);
  console.log("USDT enabled:", usdtEnabled);
  console.log("USDT unit price:", usdtUnitPrice.toString());
  console.log("productionMode:", productionMode);
  console.log("creatorWallet:", creatorWallet);
  console.log("router:", routerAddress);
  console.log("income:", incomeAddress);
  console.log("tokenEngine:", tokenEngineAddress);
  console.log("binaryTree:", binaryTreeAddress);

  if (paymentAsset.toLowerCase() !== USDT_ADDRESS.toLowerCase()) {
    throw new Error("CRITICAL: defaultPaymentAsset wrong!");
  }
  if (usdtAddress.toLowerCase() !== USDT_ADDRESS.toLowerCase()) {
    throw new Error("CRITICAL: usdtAddress wrong!");
  }
  if (!usdtEnabled) {
    throw new Error("CRITICAL: USDT payment asset not enabled!");
  }
  if (usdtUnitPrice !== EXPECTED_USDT_UNIT_PRICE) {
    throw new Error(
      `CRITICAL: paymentAssetUnitPrice wrong! Expected ${EXPECTED_USDT_UNIT_PRICE.toString()}, got ${usdtUnitPrice.toString()}`
    );
  }
  if (!productionMode) {
    throw new Error("CRITICAL: productionMode must be true before paid registrations!");
  }
  if (creatorWallet === ethers.ZeroAddress) {
    throw new Error("CRITICAL: creator wallet not set!");
  }
  if (
    routerAddress === ethers.ZeroAddress ||
    incomeAddress === ethers.ZeroAddress ||
    tokenEngineAddress === ethers.ZeroAddress ||
    binaryTreeAddress === ethers.ZeroAddress
  ) {
    throw new Error("CRITICAL: core wiring incomplete!");
  }
  console.log("Payment asset and wiring verified");

  console.log("\n2. Preparing paid root registration...");
  const placementSignerKey = process.env.PLACEMENT_SIGNER_PRIVATE_KEY;
  if (!placementSignerKey) {
    throw new Error("PLACEMENT_SIGNER_PRIVATE_KEY is required for root registration");
  }

  const signerWallet = new ethers.Wallet(placementSignerKey, ethers.provider);
  const nonce = await core.nonces(deployer.address);
  const hash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [network.chainId, addresses.Core, deployer.address, 0n, nonce]
  );
  const signature = await signerWallet.signMessage(ethers.getBytes(hash));

  const packageAmount = packagePrices[0];
  const settlementAmount = packageAmount * usdtUnitPrice;
  const [usdtDecimals, deployerUsdtBalance, deployerAllowance] = await Promise.all([
    usdt.decimals(),
    usdt.balanceOf(deployer.address),
    usdt.allowance(deployer.address, addresses.Core)
  ]);

  console.log("root package raw:", packageAmount.toString());
  console.log("required settlement raw:", settlementAmount.toString());
  console.log("required settlement:", ethers.formatUnits(settlementAmount, usdtDecimals));
  console.log("deployer USDT balance:", ethers.formatUnits(deployerUsdtBalance, usdtDecimals));
  console.log("deployer allowance to core:", ethers.formatUnits(deployerAllowance, usdtDecimals));

  if (deployerUsdtBalance < settlementAmount) {
    if (network.chainId === 5611n) {
      console.log("Insufficient deployer USDT on testnet. Attempting mint...");
      const mintAmount = settlementAmount * 2n;
      const mintTx = await usdt.mint(deployer.address, mintAmount);
      await mintTx.wait();
      console.log("Minted testnet USDT:", ethers.formatUnits(mintAmount, usdtDecimals));
    } else {
      throw new Error("Deployer USDT balance is insufficient for paid root registration");
    }
  }

  const allowanceAfterFunding = await usdt.allowance(deployer.address, addresses.Core);
  if (allowanceAfterFunding < settlementAmount) {
    console.log("Approving USDT to Core for root registration...");
    const approveTx = await usdt.approve(addresses.Core, settlementAmount);
    await approveTx.wait();
    console.log("USDT approved for root registration");
  }

  const nextUserId = await core.nextUserId();
  if (nextUserId <= 1n) {
    console.log("Registering root user with paid flow...");
    const tx = await core.registerWithPlacement(0n, 0n, true, signature, nonce);
    await tx.wait();
    console.log("Root user registered");
    console.log("Root registration TX:", tx.hash);
  } else {
    console.log("Root already registered, skipping");
  }

  console.log("\n3. Setting lock multipliers...");
  const lockDays = [30, 90, 180, 365, 730];
  const multipliers = [100, 105, 110, 112, 115];
  await (await staking.setLockMultipliers(lockDays, multipliers)).wait();
  console.log("Lock multipliers set");

  console.log("\n4. Funding staking pool...");
  const fundAmount = ethers.parseUnits("10235000", 18);
  await (await token.approve(addresses.MGXStaking, fundAmount)).wait();
  await (await staking.adminFundStakingPool(fundAmount)).wait();
  console.log("Staking pool funded: 10,235,000 MGX");

  console.log("4c. Funding Core with MGX for allocations...");
  const coreFundAmount = ethers.parseEther("10000000"); // 10M MGX
  await (await token.approve(addresses.Core, coreFundAmount)).wait();
  await (await token.transfer(addresses.Core, coreFundAmount)).wait();
  console.log("Core funded with 10,000,000 MGX ✅");

  console.log("\n4b. Setting staking reward rate...");
  await (await staking.setRewardRate(DEFAULT_STAKING_REWARD_RATE)).wait();
  const rewardRate = await staking.rewardRate();
  console.log("Reward rate set:", DEFAULT_STAKING_REWARD_RATE, "✅");
  console.log("rewardRate on-chain:", rewardRate.toString());

  console.log("\n5b. Setting treasury wallet...");
  const stakingContract = await ethers.getContractAt("MGXStaking", addresses.MGXStaking);
  const currentTreasury = await stakingContract.treasury();
  const TREASURY_WALLET = "0x63450D17A86E41ad7571040105a80c5860C6655b";
  if (currentTreasury.toLowerCase() === TREASURY_WALLET.toLowerCase()) {
    console.log("Treasury already set ✅");
  } else {
    const treasuryTx = await stakingContract.setTreasury(TREASURY_WALLET);
    await treasuryTx.wait();
    const verifiedTreasury = await stakingContract.treasury();
    console.log("Treasury set to:", verifiedTreasury, "✅");
  }

  console.log("\n5. Verifying wiring...");
  const [
    coreRouter,
    coreTree,
    coreUpgrade,
    coreTokenEngine,
    stakingCore,
    stakingIncome
  ] = await Promise.all([
    core.incomeRouterContract(),
    core.binaryTreeContract(),
    core.upgradeEngineContract(),
    core.tokenEngineContract(),
    staking.coreContract(),
    staking.incomeContract()
  ]);

  console.log("Core -> Router:", coreRouter);
  console.log("Core -> BinaryTree:", coreTree);
  console.log("Core -> Upgrade:", coreUpgrade);
  console.log("Core -> TokenEngine:", coreTokenEngine);
  console.log("Staking -> Core:", stakingCore);
  console.log("Staking -> Income:", stakingIncome);

  console.log("\n=== Post-Deploy Setup Complete ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
