import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const latest = await ethers.provider.getBlockNumber();
  const filter = income.filters.EscrowReleased(3n);
  const events = await income.queryFilter(filter, 165971200, latest);
  console.log("User 3 EscrowReleased events:", events.length);
  for (const e of events) {
    console.log("tx:", e.transactionHash, "amount raw:", (e as any).args[1].toString());
  }
}
main().catch(console.error);
