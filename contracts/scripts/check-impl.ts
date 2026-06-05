import { ethers } from "hardhat";
async function main() {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const incomeProxy = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
  const incomeImpl = await ethers.provider.getStorage(incomeProxy, implSlot);
  console.log("Income proxy:", incomeProxy);
  console.log("Income impl:", "0x" + incomeImpl.slice(26));
  console.log("Expected new: 0x1D9C94A0aB193e7e3053427d53941F2dDBf16e2b");
  
  // Try retry again with trace
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  try {
    const tx = await core.adminRetryDistribution(28n);
    const receipt = await tx.wait();
    console.log("Retry status:", receipt?.status);
    for (const log of receipt!.logs) {
      try {
        const parsed = core.interface.parseLog(log);
        if (parsed) console.log("Event:", parsed.name, parsed.args.toString());
      } catch {}
    }
  } catch(e: any) {
    console.log("Retry error:", e.message.slice(0, 200));
  }
}
main().catch(console.error);
