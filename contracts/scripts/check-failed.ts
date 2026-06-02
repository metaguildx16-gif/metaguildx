import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const latest = await ethers.provider.getBlockNumber();
  const filter = core.filters.UserRegistered();
  const events = await core.queryFilter(filter, 165971200, latest);
  console.log("Total users:", events.length);
  for (const e of events) {
    const uid = (e as any).args[0];
    const fd = await core.failedDistribution(uid);
    if (fd > 0n) {
      console.log("FAILED User " + uid + ":", ethers.formatUnits(fd, 18), "USDT");
    }
  }
  console.log("Done checking all users");
}
main().catch(console.error);
