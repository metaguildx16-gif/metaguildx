import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50");
  
  console.log("=== Failed Distribution State ===");
  for (const uid of [28n, 40n, 41n]) {
    const fd = await core.failedDistribution(uid);
    const u = await core.usersById(uid);
    console.log("User " + uid + ": failed=" + fd + " pkg=" + u[3] + " sponsor=" + u[2]);
    const rebirthIds = await upgrade.getRebirthIds(uid);
    if (rebirthIds.length > 0) console.log("  rebirthIds:", rebirthIds.toString());
  }
  
  console.log("\n=== Upgrade contract state ===");
  const upImpl = await ethers.provider.getStorage("0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50", "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
  console.log("Upgrade impl:", "0x" + upImpl.slice(26));
}
main().catch(console.error);
