import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const CASHBACK = process.env.CASHBACK_POOL_ADDRESS!;

  const [deployer] = await ethers.getSigners();
  const cashback = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function setCoreContract(address) external",
    ],
    CASHBACK,
    deployer
  );

  console.log("Fixing Cashback wiring");
  console.log("Signer:", deployer.address);
  console.log("CashbackPool:", CASHBACK);
  console.log("Expected Core:", CORE);

  const before = await cashback.coreContract();
  console.log("Current coreContract:", before);

  if (before.toLowerCase() !== CORE.toLowerCase()) {
    const tx = await cashback.setCoreContract(CORE);
    console.log("setCoreContract tx:", tx.hash);
    await tx.wait();
    console.log("setCoreContract ✅");
  } else {
    console.log("Already wired correctly ✅");
  }

  const after = await cashback.coreContract();
  console.log("Verified coreContract:", after);
  console.log("Match:", after.toLowerCase() === CORE.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
