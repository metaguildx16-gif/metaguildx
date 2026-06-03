import { ethers } from "hardhat";
async function main() {
  const staking = await ethers.getContractAt("MGXStaking", "0x1f36aDb8eeB968000aFA1c8CFE6f38B0568D33b7");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const wallet2 = await core.getUserWallet(2n);
  console.log("User 2 wallet:", wallet2);
  const positions = await staking.getStakePositions(wallet2);
  console.log("User 2 positions:", positions.length);
  for (let i = 0; i < positions.length; i++) {
    console.log("pos" + i + ": amount=" + ethers.formatUnits(positions[i].amount, 18) + " autoCompound=" + positions[i].autoCompound + " accruedReward=" + ethers.formatUnits(positions[i].accruedReward, 18));
  }
  const pending = await staking.pendingStakingReward(wallet2);
  console.log("Pending reward:", ethers.formatUnits(pending, 18), "MGX");
  const latest = await ethers.provider.getBlockNumber();
  const filter = staking.filters.Compounded(wallet2);
  const events = await staking.queryFilter(filter, 165971200, latest);
  console.log("Compound events for User 2:", events.length);
  for (const e of events) {
    console.log("  amount:", ethers.formatUnits((e as any).args[1], 18), "MGX tx:", e.transactionHash.slice(0,10));
  }
}
main().catch(console.error);
