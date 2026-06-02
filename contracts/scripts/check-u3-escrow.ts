import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const re3 = await income.rebirthEscrow(3);
  const eb3 = await income.getEscrowByPkg("0x8512264300Faa3d308Cfe630b7D2A2b8936597EC", 1);
  console.log("User 3 rebirthEscrow:", ethers.formatUnits(re3, 18), "USDT");
  console.log("User 3 escrowByPkg1:", ethers.formatUnits(eb3, 18), "USDT");
}
main().catch(console.error);
