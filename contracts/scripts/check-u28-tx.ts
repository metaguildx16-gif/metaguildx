import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const latest = await ethers.provider.getBlockNumber();
  const filter = core.filters.UserRegistered(28n);
  const events = await core.queryFilter(filter, 166737433, latest);
  console.log("User 28 registration events:", events.length);
  if (events.length > 0) {
    const tx = events[0].transactionHash;
    console.log("TX hash:", tx);
    const receipt = await ethers.provider.getTransactionReceipt(tx);
    console.log("Status:", receipt?.status, "(1=success, 0=fail)");
    console.log("Gas used:", receipt?.gasUsed.toString());
    
    // Check all events in tx
    const income = await ethers.getContractAt("MetaGuildXIncome", "0x72433Cd3d2e41ed2B230510496835803aD245a48");
    const router = await ethers.getContractAt("IncomeRouter", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69");
    for (const log of receipt!.logs) {
      try {
        const parsed = core.interface.parseLog(log);
        if (parsed) console.log("Core event:", parsed.name, parsed.args.toString());
      } catch {}
      try {
        const parsed = router.interface.parseLog(log);
        if (parsed) console.log("Router event:", parsed.name, parsed.args.toString());
      } catch {}
      try {
        const parsed = income.interface.parseLog(log);
        if (parsed) console.log("Income event:", parsed.name, parsed.args.toString());
      } catch {}
    }
  }
}
main().catch(console.error);
