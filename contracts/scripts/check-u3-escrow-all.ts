import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  console.log("=== User 3 escrow all pkgs ===");
  for (let pkg = 1; pkg <= 5; pkg++) {
    const eb = await income.escrowBalances(3, pkg);
    console.log("escrowBalances[3][" + pkg + "]:", ethers.formatUnits(eb, 18), "USDT");
  }
  const re = await income.rebirthEscrow(3);
  console.log("rebirthEscrow[3]:", ethers.formatUnits(re, 18), "USDT");
  for (let pkg = 1; pkg <= 5; pkg++) {
    const te = await income.totalEarnings(3, pkg);
    console.log("totalEarnings[3][" + pkg + "]:", ethers.formatUnits(te, 18), "USDT");
  }
}
main().catch(console.error);
