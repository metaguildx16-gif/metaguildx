import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore",
    "0x19F72c5a287334086fD34D41ebe6bb534524D202", deployer);

  console.log("Retrying userId 28 with explicit gas limit...");
  const tx = await core.adminRetryDistribution(28, {
    gasLimit: 3000000
  });
  const receipt = await tx.wait();
  console.log("TX:", tx.hash);
  console.log("Gas used:", receipt?.gasUsed.toString());
  console.log("Status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
}

main().catch((e) => { console.error(e); process.exit(1); });
