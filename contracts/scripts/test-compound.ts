import { ethers } from "hardhat";
async function main() {
  const staking = await ethers.getContractAt("MGXStaking", "0x1f36aDb8eeB968000aFA1c8CFE6f38B0568D33b7");
  const deployer = (await ethers.getSigners())[0];
  const wallet = deployer.address;
  const positions = await staking.getStakePositions(wallet);
  const rewardBefore = await staking.pendingStakingReward(wallet);
  let totalBefore = 0n;
  for (const p of positions) totalBefore += p.amount;
  console.log("Positions:", positions.length);
  console.log("Total staked before:", ethers.formatUnits(totalBefore, 18), "MGX");
  console.log("Pending reward:", ethers.formatUnits(rewardBefore, 18), "MGX");
  if (rewardBefore === 0n) { console.log("No reward yet"); return; }
  console.log("\nCompounding position 0...");
  const tx = await staking.compound(wallet, 0);
  await tx.wait();
  const posAfter = await staking.getStakePositions(wallet);
  let totalAfter = 0n;
  for (const p of posAfter) totalAfter += p.amount;
  console.log("Total staked after:", ethers.formatUnits(totalAfter, 18), "MGX");
  console.log("Increase:", ethers.formatUnits(totalAfter - totalBefore, 18), "MGX");
  console.log("Compound success ✅");
}
main().catch(console.error);
