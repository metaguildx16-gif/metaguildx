import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const filter = core.filters.UserRegistered();
  const latest = await ethers.provider.getBlockNumber();
  const events = await core.queryFilter(filter, latest - 500, latest);
  for (const e of events.slice(-5)) {
    console.log("userId:", e.args[0].toString(), "tx:", e.transactionHash);
  }
}
main().catch(console.error);
