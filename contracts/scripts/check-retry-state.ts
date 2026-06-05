import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  
  const fd28 = await core.failedDistribution(28n);
  console.log("failedDistribution[28]:", fd28);
  
  const failed = await core.getFailedUserIds();
  console.log("getFailedUserIds():", failed.toString());
  console.log("count:", failed.length);
  
  // Check if retry actually succeeded last time
  const latest = await ethers.provider.getBlockNumber();
  const filter = core.filters.DistributionRetried(28n);
  const events = await core.queryFilter(filter, 166737433, latest);
  console.log("\nDistributionRetried events:", events.length);
  for (const e of events) {
    console.log("  success:", (e as any).args[1].toString(), "tx:", e.transactionHash.slice(0,10));
  }
}
main().catch(console.error);
