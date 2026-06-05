import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE_ADDRESS = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const DEPLOY_BLOCK = 166737433;

  const core = await ethers.getContractAt("MetaGuildXCore", CORE_ADDRESS);

  const filter = core.filters.DistributionFailedReason();
  const events = await core.queryFilter(filter, DEPLOY_BLOCK);

  console.log("DistributionFailedReason events:", events.length);

  for (const e of events) {
    const userId = e.args[0];
    const reason = e.args[1];
    console.log("\nuserId:", userId.toString());
    console.log("raw reason:", reason);

    // Try decode as Error(string)
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["string"], ethers.dataSlice(reason, 4)
      );
      console.log("decoded error:", decoded[0]);
    } catch {
      // Try as custom error or panic
      console.log("reason hex:", reason);
      if (reason.length >= 10) {
        console.log("error selector:", reason.slice(0, 10));
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
