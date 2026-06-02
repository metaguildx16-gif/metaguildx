import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  for (let pkg = 1; pkg <= 3; pkg++) {
    const eb = await income.escrowBalances(3, pkg);
    if (eb > 0n) console.log("escrowBalances[3][" + pkg + "] raw:", eb.toString(), "=", (Number(eb) * 0.1).toFixed(1), "USDT");
  }
  const re = await income.rebirthEscrow(3);
  console.log("rebirthEscrow[3] raw:", re.toString());
  for (let pkg = 1; pkg <= 3; pkg++) {
    const te = await income.totalEarnings(3, pkg);
    if (te > 0n) console.log("totalEarnings[3][" + pkg + "] raw:", te.toString(), "=", (Number(te) * 0.1).toFixed(1), "USDT");
  }
}
main().catch(console.error);
