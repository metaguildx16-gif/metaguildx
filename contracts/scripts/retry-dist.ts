import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  console.log("Retrying distribution for User 28...");
  const tx = await core.adminRetryDistribution(28n);
  await tx.wait();
  console.log("Retry done ✅");
  const failed = await core.getFailedUserIds();
  console.log("Failed userIds after retry:", failed.toString());
}
main().catch(console.error);
