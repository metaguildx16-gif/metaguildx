import { ethers } from "hardhat";
async function main() {
  const staking = await ethers.getContractAt("MGXStaking", "0x1f36aDb8eeB968000aFA1c8CFE6f38B0568D33b7");
  const mgx = await ethers.getContractAt("MGXToken", "0x74639F8Ee3864d5E374Fe4cA8d4aDd9e2b11dcBd");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const latest = await ethers.provider.getBlockNumber();
  const filter = staking.filters.Claimed();
  const events = await staking.queryFilter(filter, 165971200, latest);
  console.log("Total Claimed events:", events.length);
  for (const e of events) {
    console.log("account:", (e as any).args[0].slice(0,10), "amount:", ethers.formatUnits((e as any).args[1], 18), "MGX tx:", e.transactionHash.slice(0,10));
  }
  const filterW = staking.filters.Withdrawn();
  const eventsW = await staking.queryFilter(filterW, 165971200, latest);
  console.log("\nTotal Withdrawn events:", eventsW.length);
  for (const e of eventsW) {
    console.log("account:", (e as any).args[0].slice(0,10), "amount:", ethers.formatUnits((e as any).args[1], 18), "MGX tx:", e.transactionHash.slice(0,10));
  }
}
main().catch(console.error);
