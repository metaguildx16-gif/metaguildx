import { ethers } from "hardhat";

async function main() {
  const OLD_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const [deployer] = await ethers.getSigners();

  const router = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function setCoreContract(address) external",
      "function owner() view returns (address)",
    ],
    OLD_ROUTER,
    deployer
  );

  const current = await router.coreContract();
  const owner = await router.owner();

  console.log("OLD Router:", OLD_ROUTER);
  console.log("Current coreContract:", current);
  console.log("Should be:", CORE);
  console.log("Owner:", owner);
  console.log("Deployer:", deployer.address);

  if (current.toLowerCase() === CORE.toLowerCase()) {
    console.log("Already correct!");
  } else {
    console.log("\nUpdating OLD router coreContract...");
    const tx = await router.setCoreContract(CORE);
    await tx.wait();
    console.log("✅ Done!");
  }

  const newCore = await router.coreContract();
  console.log("New coreContract:", newCore);
  console.log("Match:", newCore.toLowerCase() === CORE.toLowerCase());

  const OLD_INCOME = "0x2A55927a1f521572096A4983767F126626D8ac21";

  const income = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function setCoreContract(address) external",
    ],
    OLD_INCOME,
    deployer
  );

  const incomeCore = await income.coreContract();
  console.log("\nOLD Income coreContract:", incomeCore);
  console.log("Should be:", CORE);

  if (incomeCore.toLowerCase() !== CORE.toLowerCase()) {
    const tx2 = await income.setCoreContract(CORE);
    await tx2.wait();
    console.log("OLD Income updated ✅");
  }

  console.log("Final OLD Income coreContract:", await income.coreContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
