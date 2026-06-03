import { ethers } from "hardhat";
async function main() {
  const staking = await ethers.getContractAt("MGXStaking", "0x1f36aDb8eeB968000aFA1c8CFE6f38B0568D33b7");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  console.log("rewardRate:", (await staking.rewardRate()).toString(), "bps/day");
  console.log("rewardPool:", ethers.formatUnits(await staking.rewardPool(), 18), "MGX");
  console.log("totalStaked:", ethers.formatUnits(await staking.totalStaked(), 18), "MGX");
  const nextUser = await core.nextUserId();
  console.log("\n=== Active Stakers ===");
  for (let uid = 1n; uid < nextUser; uid++) {
    const wallet = await core.getUserWallet(uid);
    if (wallet === ethers.ZeroAddress) continue;
    try {
      const positions = await staking.getStakePositions(wallet);
      if (!positions || positions.length === 0) continue;
      const preview = await staking.pendingStakingReward(wallet);
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        if (pos.amount > 0n) {
          console.log("User " + uid + " pos" + i + ": staked=" + ethers.formatUnits(pos.amount, 18) + " MGX lockDays=" + pos.lockDays + " reward=" + ethers.formatUnits(preview, 18) + " MGX rewardDebt=" + pos.rewardDebt.toString());
        }
      }
    } catch(e: any) { }
  }
  console.log("Done");
}
main().catch(console.error);
