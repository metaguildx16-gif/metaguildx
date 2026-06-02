import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const latest = await ethers.provider.getBlockNumber();

  // All income events for User 3 pkg1
  const filter = income.filters.DirectPayout(3n);
  const filter2 = income.filters.EscrowCredited(3n);
  const filter3 = income.filters.EscrowReleased(3n);
  const filter4 = income.filters.IncomeReset(3n);

  const payouts = await income.queryFilter(filter, 165971200, latest);
  const escrows = await income.queryFilter(filter2, 165971200, latest);
  const releases = await income.queryFilter(filter3, 165971200, latest);
  const resets = await income.queryFilter(filter4, 165971200, latest);

  console.log("=== DirectPayout events ===");
  let totalDirect = 0n;
  for (const e of payouts) {
    const raw = (e as any).args[1];
    totalDirect += raw;
    console.log("tx:", e.transactionHash.slice(0,10), "raw:", raw.toString(), "xSlot:", (e as any).args[2].toString());
  }
  console.log("Total direct raw:", totalDirect.toString(), "=", (Number(totalDirect)*0.1).toFixed(1), "USDT");

  console.log("\n=== EscrowCredited events ===");
  let totalEscrowed = 0n;
  for (const e of escrows) {
    const raw = (e as any).args[1];
    totalEscrowed += raw;
    console.log("tx:", e.transactionHash.slice(0,10), "raw:", raw.toString(), "xSlot:", (e as any).args[2].toString());
  }
  console.log("Total escrowed raw:", totalEscrowed.toString());

  console.log("\n=== EscrowReleased events ===");
  for (const e of releases) {
    console.log("tx:", e.transactionHash.slice(0,10), "raw:", (e as any).args[1].toString());
  }

  console.log("\n=== IncomeReset events ===");
  for (const e of resets) {
    console.log("tx:", e.transactionHash.slice(0,10), "pkgLevel:", (e as any).args[1].toString());
  }

  console.log("\n=== Current state ===");
  const te = await income.totalEarnings(3, 1);
  const eb = await income.escrowBalances(3, 1);
  console.log("totalEarnings[3][1] raw:", te.toString(), "=", (Number(te)*0.1).toFixed(1), "USDT");
  console.log("escrowBalances[3][1] raw:", eb.toString(), "=", (Number(eb)*0.1).toFixed(1), "USDT");
  console.log("xSlot:", Math.floor((Number(te)-Number(eb))/100));
}
main().catch(console.error);
