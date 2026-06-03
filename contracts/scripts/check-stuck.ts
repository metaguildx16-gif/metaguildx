import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  for (const uid of [3, 5]) {
    for (let pkg = 1; pkg <= 3; pkg++) {
      const eb = await income.escrowBalances(uid, pkg);
      if (eb > 0n) console.log("User " + uid + " escrowBalances[" + pkg + "] raw:", eb.toString(), "=", (Number(eb)*0.1).toFixed(1), "USDT");
    }
    const re = await income.rebirthEscrow(uid);
    if (re > 0n) console.log("User " + uid + " rebirthEscrow:", (Number(re)*0.1).toFixed(1), "USDT");
  }
}
main().catch(console.error);
