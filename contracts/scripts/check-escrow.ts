import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const wallet3 = "0x8512264300Faa3d308Cfe630b7D2A2b8936597EC";
  try {
    const escrow = await income.escrowBalance(wallet3);
    console.log("User 3 escrow in Income:", escrow.toString());
  } catch(e) { console.log("escrow error:", e.message); }
  try {
    const escrow2 = await core.escrowBalance(3);
    console.log("User 3 escrow in Core:", escrow2.toString());
  } catch(e) { console.log("core escrow error:", e.message); }
}
main().catch(console.error);
