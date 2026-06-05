import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  for (const uid of [1, 2, 3]) {
    const pkg = await core.getUserPackageLevel(uid);
    const wallet = await core.getUserWallet(uid);
    console.log("=== User " + uid + " pkg=" + pkg + " ===");
    for (let p = 1; p <= 3; p++) {
      const eb = await income.escrowBalances(uid, p);
      if (eb > 0n) console.log("  escrowBalances[" + p + "]:", eb.toString(), "raw =", (Number(eb)*0.1).toFixed(1), "USDT");
    }
    const re = await income.rebirthEscrow(uid);
    if (re > 0n) console.log("  rebirthEscrow:", re.toString());
  }
}
main().catch(console.error);
