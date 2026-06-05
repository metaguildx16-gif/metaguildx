import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const mgx = await ethers.getContractAt("MGXToken", "0x74639F8Ee3864d5E374Fe4cA8d4aDd9e2b11dcBd");

  // User 3 full escrow state
  console.log("=== User 3 escrow ===");
  const u3wallet = await core.getUserWallet(3n);
  for (let p = 1; p <= 3; p++) {
    const eb = await income.escrowBalances(3n, p);
    console.log("escrowBalances[3][" + p + "]:", eb.toString());
  }
  const re3 = await income.rebirthEscrow(3n);
  console.log("rebirthEscrow[3]:", re3.toString());
  for (let p = 1; p <= 3; p++) {
    const te = await income.totalEarnings(3n, p);
    console.log("totalEarnings[3][" + p + "]:", te.toString());
  }

  // User 2 MGX check
  console.log("\n=== User 2 MGX ===");
  const u2wallet = await core.getUserWallet(2n);
  const u2pkg = await core.getUserPackageLevel(2n);
  const u2mgx = await mgx.balanceOf(u2wallet);
  console.log("User 2 wallet:", u2wallet);
  console.log("User 2 pkg:", u2pkg.toString());
  console.log("User 2 MGX balance:", ethers.formatUnits(u2mgx, 18), "MGX");
}
main().catch(console.error);
