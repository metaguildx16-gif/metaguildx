import { ethers } from "hardhat";
async function main() {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const upgrade = "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50";
  const impl = await ethers.provider.getStorage(upgrade, implSlot);
  console.log("Upgrade impl:", "0x" + impl.slice(26));
  console.log("Expected:    0x92388d1ce7dcd4f95c1635d087e3eaca0712edf8");
  console.log("Match:", impl.toLowerCase().includes("92388d") ? "YES ✅" : "NO ❌ — needs upgrade");
}
main().catch(console.error);
