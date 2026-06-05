import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  
  console.log("=== User 3 Complete State ===");
  const pkg = await core.getUserPackageLevel(3n);
  console.log("currentPkg:", pkg.toString());
  
  for (let p = 1; p <= 3; p++) {
    const te = await income.totalEarnings(3n, p);
    const eb = await income.escrowBalances(3n, p);
    console.log("pkg" + p + ": totalEarnings=" + te + " escrow=" + eb + " xSlot=" + Math.floor(Number(te-eb)/100));
  }
  
  const re = await income.rebirthEscrow(3n);
  console.log("rebirthEscrow:", re.toString());
  
  // Admin panel shows 23 total users — verify
  const nextId = await core.nextUserId();
  console.log("\nnextUserId:", nextId.toString());
  console.log("Total registered:", (Number(nextId)-1).toString());
  
  // User 3 referrals
  for (let pkg = 1; pkg <= 3; pkg++) {
    const refs = await core.referralCountByPkg(3n, pkg);
    if (refs > 0n) console.log("User 3 refs pkg" + pkg + ":", refs.toString());
  }
}
main().catch(console.error);
