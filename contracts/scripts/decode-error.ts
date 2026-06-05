import { ethers } from "hardhat";
async function main() {
  const selector = "0x3ee5aeb5";
  
  // Check all contracts for this error
  const contracts = [
    ["MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202"],
    ["IncomeRouter", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69"],
    ["MetaGuildXIncome", "0x72433Cd3d2e41ed2B230510496835803aD245a48"],
    ["MetaGuildXUpgrade", "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50"],
  ];
  
  for (const [name, addr] of contracts) {
    try {
      const c = await ethers.getContractAt(name, addr);
      for (const frag of c.interface.fragments) {
        if (frag.type === "error") {
          const sig = c.interface.getError((frag as any).name);
          if (sig) {
            const hash = ethers.id((frag as any).format()).slice(0, 10);
            if (hash === selector) {
              console.log("FOUND in", name, ":", (frag as any).name);
            }
          }
        }
      }
    } catch {}
  }
  console.log("Search complete");
}
main().catch(console.error);
