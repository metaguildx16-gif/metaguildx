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

function loadAddresses(): DeployedAddresses {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

async function main() {
  const addresses = loadAddresses();
  const [deployer] = await ethers.getSigners();

  console.log("=== Post-Deploy Setup ===");
  console.log("Deployer:", deployer.address);

  const core = await ethers.getContractAt("MetaGuildXCore", addresses.Core);
  const staking = await ethers.getContractAt("MGXStaking", addresses.MGXStaking);
  const token = await ethers.getContractAt("MGXToken", addresses.MGXToken);

  console.log("\n1. Registering root user...");
  const placementSignerKey = process.env.PLACEMENT_SIGNER_PRIVATE_KEY;
  if (!placementSignerKey) {
    throw new Error("PLACEMENT_SIGNER_PRIVATE_KEY is required for root registration");
  }

  const signerWallet = new ethers.Wallet(placementSignerKey, ethers.provider);
  const nonce = await core.nonces(deployer.address);
  const contractAddress = addresses.Core;
  const network = await ethers.provider.getNetwork();
  const hash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "address", "uint256", "uint256"],
    [network.chainId, contractAddress, deployer.address, 0n, nonce]
  );
  const signature = await signerWallet.signMessage(ethers.getBytes(hash));

  const nextUserId = await core.nextUserId();
  if (nextUserId <= 1n) {
    const tx = await core.registerWithPlacement(0n, 0n, true, signature, nonce);
    await tx.wait();
    console.log("Root user registered ✅");
  } else {
    console.log("Root already registered, skipping ✅");
  }

  console.log("\n2. Setting lock multipliers...");
  const lockDays = [30, 90, 180, 365, 730];
  const multipliers = [100, 105, 110, 112, 115];
  await (await staking.setLockMultipliers(lockDays, multipliers)).wait();
  console.log("Lock multipliers set ✅");

  console.log("\n3. Funding staking pool...");
  const fundAmount = ethers.parseUnits("10235000", 18);
  await (await token.approve(addresses.MGXStaking, fundAmount)).wait();
  await (await staking.adminFundStakingPool(fundAmount)).wait();
  console.log("Staking pool funded: 10,235,000 MGX ✅");

  console.log("\n4. Verifying wiring...");
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
