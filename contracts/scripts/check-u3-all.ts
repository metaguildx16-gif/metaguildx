import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const uid3 = 3n;
  const re = await income.rebirthEscrow(uid3);
  console.log("rebirthEscrow(3):", re.toString());
  const ge = await income.getEscrow("0x8512264300Faa3d308Cfe630b7D2A2b8936597EC");
  console.log("getEscrow(wallet3):", ge.toString());
  const te = await income.getTotalIncome(uid3);
  console.log("getTotalIncome(3):", te.toString());
  const ta = await income.getTotalAllIncome(uid3);
  console.log("getTotalAllIncome(3):", ta.toString());
  for (let pkg = 1; pkg <= 3; pkg++) {
    const eb = await income.getEscrowByPkg("0x8512264300Faa3d308Cfe630b7D2A2b8936597EC", pkg);
    console.log("escrowByPkg(wallet3," + pkg + "):", eb.toString());
  }
}
main().catch(console.error);
