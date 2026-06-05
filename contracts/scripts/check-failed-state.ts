import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore",
    "0x19F72c5a287334086fD34D41ebe6bb534524D202");

  const failedIds = await core.getFailedUserIds();
  console.log("failedUserIds array:", failedIds.map((x: bigint) => x.toString()));

  for (const id of failedIds) {
    const isFailed = await core.failedDistribution(id);
    console.log(`failedDistribution[${id}]:`, isFailed);
  }

  // Check latest DistributionRetried event
  const filter = core.filters.DistributionRetried();
  const events = await core.queryFilter(filter, 166737433);
  const last3 = events.slice(-3);
  console.log("\nLast 3 DistributionRetried events:");
  for (const e of last3) {
    console.log(`  userId: ${e.args[0]}, success: ${e.args[1]}, block: ${e.blockNumber}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
