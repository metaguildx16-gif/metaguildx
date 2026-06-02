import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x4e699918bc27A9b98D1FFA1251f4CC3d212226Cd");
  for (const uid of [1, 3]) {
    console.log("=== User " + uid + " ===");
    for (let pkg = 1; pkg <= 2; pkg++) {
      const te = await income.totalEarnings(uid, pkg);
      const eb = await income.escrowBalances(uid, pkg);
      const re = await income.rebirthEscrow(uid);
      console.log("Pkg" + pkg + " totalEarnings raw:", te.toString(), "escrow raw:", eb.toString());
    }
    const rebirthIds = await upgrade.getRebirthIds(uid);
    console.log("rebirthIds:", rebirthIds.toString());
    const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
    const manual = await core.manuallyUpgraded(uid);
    const pkg = await core.getUserPackageLevel(uid);
    const origPkg = await core.getUserOriginalPackageLevel(uid);
    console.log("currentPkg:", pkg.toString(), "origPkg:", origPkg.toString(), "manualUpgrade:", manual);
  }
}
main().catch(console.error);
