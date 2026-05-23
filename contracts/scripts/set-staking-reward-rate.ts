import { ethers } from "hardhat";

const STAKING = "0xA50A46D9D925E1Faf8755113f36cE78c48709886";
const REWARD_RATE = 3; // 3 bps/day ~= 10.95% simple annualized

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);
  console.log("Target staking:", STAKING);

  const staking = await ethers.getContractAt("MGXStaking", STAKING, deployer);

  const currentRate = await staking.rewardRate();
  console.log("Current rewardRate:", currentRate.toString());

  if (currentRate === BigInt(REWARD_RATE)) {
    console.log("Reward rate already set correctly. Nothing to do.");
    return;
  }

  const tx = await staking.setRewardRate(REWARD_RATE);
  console.log("Setting rewardRate tx:", tx.hash);
  await tx.wait();

  const newRate = await staking.rewardRate();
  console.log("New rewardRate:", newRate.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
