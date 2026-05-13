import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
const CORE = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  console.log("Before reset:");
  console.log("nextUserId:", ((await core.nextUserId()) as bigint).toString());
  console.log("rootUserId:", ((await core.rootUserId()) as bigint).toString());

  console.log("\nResetting system...");
  const tx = await core.adminResetForTesting();
  await tx.wait();
  console.log("Reset TX:", tx.hash);

  console.log("\nAfter reset:");
  console.log("nextUserId:", ((await core.nextUserId()) as bigint).toString());
  console.log("rootUserId:", ((await core.rootUserId()) as bigint).toString());

  console.log("\nSystem reset âœ…");
  console.log("Ready for fresh manual testing!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
