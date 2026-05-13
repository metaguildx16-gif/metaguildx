import { ethers } from "hardhat";

async function main() {
  const OLD_INCOME = "0x2A55927a1f521572096A4983767F126626D8ac21";
  const provider = ethers.provider;

  const implSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await provider.getStorage(OLD_INCOME, implSlot);
  const implAddr = "0x" + implRaw.slice(26);
  console.log("OLD Income impl slot:", implAddr);

  const isProxy = implAddr !== "0x0000000000000000000000000000000000000000";
  console.log("Is proxy:", isProxy);

  for (let i = 0; i <= 5; i += 1) {
    const val = await provider.getStorage(OLD_INCOME, i);
    console.log(`Slot ${i}:`, val);
  }

  const income = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function upgradeEngineContract() view returns (address)",
      "function owner() view returns (address)",
      "function getEscrow(uint256) view returns (uint256)",
    ],
    OLD_INCOME
  );

  try {
    const core = await income.coreContract();
    console.log("\ncoreContract:", core);
  } catch (e: any) {
    console.log("coreContract ERROR:", String(e.message).substring(0, 50));
  }

  try {
    const owner = await income.owner();
    console.log("owner:", owner);
  } catch (e: any) {
    console.log("owner ERROR:", String(e.message).substring(0, 50));
  }

  const OLD_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const router = await ethers.getContractAt(
    [
      "function incomeEngineContract() view returns (address)",
      "function coreContract() view returns (address)",
    ],
    OLD_ROUTER
  );

  console.log("\nOLD Router after fix:");
  console.log("  coreContract:", await router.coreContract());
  console.log("  incomeEngine:", await router.incomeEngineContract());

  console.log("\n=== OPTION: Use NEW income with OLD router ===");
  console.log("NEW Income: 0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB");
  console.log("NEW Income coreContract: 0x9490... ✅");
  console.log("If OLD router → NEW income:");
  console.log("  OLD router.onlyCore: msg.sender=0x9490 = coreContract ✅");
  console.log("  NEW income.onlyRouter: msg.sender=OLD_ROUTER ??");

  const NEW_INCOME = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";
  const newIncome = await ethers.getContractAt(
    ["function coreContract() view returns (address)"],
    NEW_INCOME
  );
  console.log("\nNEW Income coreContract:", await newIncome.coreContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
