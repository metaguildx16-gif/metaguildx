import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const STAKING_PROXY = process.env.MGX_STAKING_ADDRESS;
  if (!STAKING_PROXY) {
    throw new Error("MGX_STAKING_ADDRESS not set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await ethers.getContractFactory("MGXStaking");

  try {
    await upgrades.forceImport(STAKING_PROXY, Factory, {
      kind: "uups",
    });
    console.log("Imported staking proxy");
  } catch (error: any) {
    console.log("Proxy import skipped:", error.message);
  }

  await upgrades.upgradeProxy(STAKING_PROXY, Factory, {
    kind: "uups",
    redeployImplementation: "always",
  });
  console.log("Staking upgraded");

  const staking = await ethers.getContractAt(
    "MGXStaking",
    STAKING_PROXY
  );

  try {
    const initTx = await staking.initializeV2();
    await initTx.wait();
    console.log("initializeV2 called ✅");
  } catch (error: any) {
    console.log("initializeV2 skipped:", error.message);
  }

  try {
    const currentRate = await staking.rewardRate();
    if (currentRate === 0n) {
      const repairTx = await staking.initializeV4();
      await repairTx.wait();
      console.log("initializeV4 reward config called");
    }
  } catch (error: any) {
    console.log("initializeV4 skipped:", error.message);
  }

  const rate = await staking.rewardRate();
  console.log("rewardRate:", rate.toString());

  const m730 = await staking.lockMultiplier(730 * 86400);
  console.log("lockMultiplier[730d]:", m730.toString());

  const pending = await staking.pendingStakingReward(
    deployer.address
  );
  console.log("Pending reward:", ethers.formatEther(pending), "MGX");

  const impl = await upgrades.erc1967.getImplementationAddress(
    STAKING_PROXY
  );
  console.log("New impl:", impl);
}

main().catch(console.error);
