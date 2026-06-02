import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const wallet3 = "0x8512264300Faa3d308Cfe630b7D2A2b8936597EC";
  const userId3 = 3n;
  try {
    const e1 = await income.getEscrow(wallet3);
    console.log("getEscrow(wallet3):", e1.toString());
  } catch(e: any) { console.log("getEscrow error:", e.message); }
  try {
    const e2 = await income.escrowBalances(wallet3);
    console.log("escrowBalances(wallet3):", e2.toString());
  } catch(e: any) { console.log("escrowBalances error:", e.message); }
  try {
    const e3 = await income.getTotalEscrow();
    console.log("getTotalEscrow:", e3.toString());
  } catch(e: any) { console.log("getTotalEscrow error:", e.message); }
  try {
    const e4 = await income.getEscrowByPkg(wallet3, 1);
    console.log("getEscrowByPkg(wallet3,1):", e4.toString());
  } catch(e: any) { console.log("getEscrowByPkg error:", e.message); }
}
main().catch(console.error);
