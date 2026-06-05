import { ethers } from "hardhat";
async function main() {
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  const contracts = [
    ["Upgrade", "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50"],
    ["Router", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69"],
    ["Core", "0x19F72c5a287334086fD34D41ebe6bb534524D202"],
  ];
  
  for (const [name, proxy] of contracts) {
    const impl = await ethers.provider.getStorage(proxy, implSlot);
    console.log(name + " impl:", "0x" + impl.slice(26));
  }
  
  // Check if Upgrade has nonReentrant on checkAndTriggerRebirth
  // This is the new fix we added — may cause nested call issue
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50");
  console.log("\nUpgrade.incomeContract:", await upgrade.incomeContract());
}
main().catch(console.error);
