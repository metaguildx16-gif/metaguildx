import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const TX = "0x80e1c8b24ea07f6715c8b833341eeebf81d0f482f92227fb8ebcf8588a2c2981";
  const receipt = await ethers.provider.getTransactionReceipt(TX);
  console.log("TX status:", receipt?.status === 1 ? "SUCCESS" : "FAILED");
  console.log("Gas used:", receipt?.gasUsed.toString());

  // Check all events emitted
  const CORE   = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const INCOME = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
  const ROUTER = "0xe59Ad238162D9591BCC7659A10fe017004a4cA69";

  const core   = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  console.log("\nEvents in TX:");
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = core.interface.parseLog(log);
      if (parsed) console.log("CORE:", parsed.name, parsed.args.toString());
    } catch {}
    try {
      const parsed = income.interface.parseLog(log);
      if (parsed) console.log("INCOME:", parsed.name, parsed.args.toString());
    } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
