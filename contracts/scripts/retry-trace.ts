import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x72433Cd3d2e41ed2B230510496835803aD245a48");
  const router = await ethers.getContractAt("IncomeRouter", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69");
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50");
  
  const tx = await core.adminRetryDistribution(28n);
  const receipt = await tx.wait();
  console.log("Status:", receipt?.status);
  
  for (const log of receipt!.logs) {
    for (const [name, contract] of [["Core", core], ["Income", income], ["Router", router], ["Upgrade", upgrade]] as any) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed) console.log(name + " event:", parsed.name, parsed.args.toString());
      } catch {}
    }
  }
}
main().catch(console.error);
