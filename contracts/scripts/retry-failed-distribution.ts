import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore",
    "0x19F72c5a287334086fD34D41ebe6bb534524D202", deployer);

  const failedIds = await core.getFailedUserIds();
  console.log("Failed distributions:", failedIds.length);

  if (failedIds.length === 0) {
    console.log("No failed distributions. System clean!");
    return;
  }

  for (const userId of failedIds) {
    const isFailed = await core.failedDistribution(userId);
    if (!isFailed) { console.log(`userId ${userId} already cleared`); continue; }
    console.log(`Retrying userId: ${userId}`);
    const tx = await core.adminRetryDistribution(userId, { gasLimit: 3000000 });
    await tx.wait();
    console.log("Done. tx:", tx.hash);
  }

  console.log("\nAll retries complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
