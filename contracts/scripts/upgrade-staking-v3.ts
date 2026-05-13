import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const STAKING = process.env.MGX_STAKING_ADDRESS;
  const MGX = process.env.MGX_TOKEN_ADDRESS;

  if (!STAKING || !MGX) {
    throw new Error("MGX_STAKING_ADDRESS and MGX_TOKEN_ADDRESS must be set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const staking = await ethers.getContractAt(
    "MGXStaking",
    STAKING
  );

  try {
    const treasury = await staking.treasury();
    if (treasury !== ethers.ZeroAddress) {
      console.log("V3 already initialized, skipping");
      console.log("Treasury:", treasury);
    } else {
      const tx = await staking.initializeV3();
      await tx.wait();
      console.log("initializeV3 ✅");
    }
  } catch (e: any) {
    console.log("treasury() failed:", e.message);
    console.log("Trying initializeV3 anyway...");
    try {
      const tx = await staking.initializeV3();
      await tx.wait();
      console.log("initializeV3 ✅");
    } catch (e2: any) {
      console.log("initializeV3 failed:", e2.message);
    }
  }

  const mgx = await ethers.getContractAt(
    "MGXToken",
    MGX
  );
  const approveTx = await mgx.approve(
    STAKING,
    ethers.parseEther("40940000")
  );
  await approveTx.wait();
  console.log("Treasury approved ✅");

  const treasury = await staking.treasury();
  const threshold = await staking.minBalanceThreshold();
  const topUp = await staking.topUpAmount();
  const cooldown = await staking.topUpCooldown();
  const [treaBal, allowance] = await staking.getTreasuryStatus();

  console.log("Treasury:", treasury);
  console.log("Threshold:", ethers.formatEther(threshold), "MGX");
  console.log("TopUp amount:", ethers.formatEther(topUp), "MGX");
  console.log("Cooldown:", Number(cooldown) / 3600, "hours");
  console.log("Treasury MGX:", ethers.formatEther(treaBal));
  console.log("Allowance:", ethers.formatEther(allowance));

  const impl = await upgrades.erc1967.getImplementationAddress(STAKING);
  console.log("New impl:", impl);
}

main().catch(console.error);
