import { ethers } from "hardhat";
async function main() {
  const receipt = await ethers.provider.getTransactionReceipt("0x3e1bce71749cf3db8f03a97c71bb3f809507ed43663353c7d2678225ae477b71");
  if (!receipt) { console.log("tx not found"); return; }
  const router = await ethers.getContractAt("IncomeRouter", "0x30ec8A79712A36Fc24C03C16e4fae3BD8bF3ff85");
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  console.log("=== Level Income Events ===");
  for (const log of receipt.logs) {
    try {
      const parsed = router.interface.parseLog(log);
      if (parsed) console.log(parsed.name + ":", parsed.args.toString());
    } catch {}
    try {
      const parsed = income.interface.parseLog(log);
      if (parsed) console.log(parsed.name + ":", parsed.args.toString());
    } catch {}
  }
}
main().catch(console.error);
