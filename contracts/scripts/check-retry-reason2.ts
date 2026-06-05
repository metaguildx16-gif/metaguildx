import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE_ADDRESS = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const DEPLOY_BLOCK = 166737433;

  const core = await ethers.getContractAt("MetaGuildXCore", CORE_ADDRESS);

  // Check DistributionRetried events
  const retryFilter = core.filters.DistributionRetried();
  const retryEvents = await core.queryFilter(retryFilter, DEPLOY_BLOCK);
  console.log("DistributionRetried events:", retryEvents.length);
  for (const e of retryEvents) {
    console.log("userId:", e.args[0].toString(), "success:", e.args[1]);
  }

  // Check latest DistributionFailedReason
  const reasonFilter = core.filters.DistributionFailedReason();
  const reasonEvents = await core.queryFilter(reasonFilter, DEPLOY_BLOCK);
  console.log("\nLatest DistributionFailedReason:");
  const latest = reasonEvents[reasonEvents.length - 1];
  if (latest) {
    console.log("userId:", latest.args[0].toString());
    console.log("reason hex:", latest.args[1]);
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["string"], ethers.dataSlice(latest.args[1], 4)
      );
      console.log("decoded:", decoded[0]);
    } catch {
      console.log("selector:", latest.args[1].slice(0, 10));
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
