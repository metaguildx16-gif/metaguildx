import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const [signer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore", CORE, signer);

  console.log("Calling adminRetryDistribution(28) with callStatic...");
  try {
    await core.adminRetryDistribution.staticCall(28);
    console.log("Static call SUCCESS!");
  } catch (e: any) {
    console.log("Static call FAILED");
    console.log("message:", e.message);
    console.log("data:", e.data);
    console.log("reason:", e.reason);
    if (e.errorName) console.log("errorName:", e.errorName);
    if (e.errorArgs) console.log("errorArgs:", e.errorArgs);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
