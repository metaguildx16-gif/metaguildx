import { ethers } from "hardhat";

async function main() {
  const OLD_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const router = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function incomeEngineContract() view returns (address)",
      "function creatorWallet() view returns (address)",
    ],
    OLD_ROUTER
  );

  console.log("OLD Router:");
  console.log("  coreContract:", await router.coreContract());
  console.log("  incomeEngine:", await router.incomeEngineContract());

  const NEW_ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const newRouter = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function incomeEngineContract() view returns (address)",
    ],
    NEW_ROUTER
  );

  console.log("\nNEW Router:");
  console.log("  coreContract:", await newRouter.coreContract());
  console.log("  incomeEngine:", await newRouter.incomeEngineContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
