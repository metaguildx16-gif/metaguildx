import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implAddr = await ethers.provider.getStorage("0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5", implSlot);
  console.log("Current implementation:", "0x" + implAddr.slice(26));
  
  // Check if fix is active — manuallyUpgraded=false user with higher pkg should get direct payout
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const pkg3 = await core.getUserPackageLevel(3);
  const manual3 = await core.manuallyUpgraded(3);
  const eb3before = await income.escrowBalances(3n, 1n);
  console.log("User 3 pkg:", pkg3.toString(), "manual:", manual3, "escrow[3][1]:", eb3before.toString());
}
main().catch(console.error);
