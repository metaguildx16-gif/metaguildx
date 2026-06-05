import { ethers } from "hardhat";
async function main() {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const incomeProxy = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
  const impl = await ethers.provider.getStorage(incomeProxy, implSlot);
  console.log("Current Income impl:", "0x" + impl.slice(26));
  console.log("Latest upgrade impl: 0x5d795eEB98e85274fb417fDaa2c297AF121A7CAF");
  console.log("Match:", impl.toLowerCase().includes("5d795eeb") ? "YES ✅" : "NO ❌");
  
  // Check if nonReentrant is still on routeIncome by checking bytecode size difference
  const income = await ethers.getContractAt("MetaGuildXIncome", incomeProxy);
  // Try calling routeIncome from router address using impersonation
  console.log("\nIncome onlyRouter check:");
  console.log("Router address:", await income.incomeRouterContract());
}
main().catch(console.error);
