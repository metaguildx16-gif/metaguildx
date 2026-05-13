import { ethers } from "hardhat";

async function main() {
  const INCOME = "0x87d752D160299c09BaDaac3dd66FBac483A5b67b";
  const [owner] = await ethers.getSigners();

  console.log("Restoring User 1 pkg2 upgrade escrow...");
  console.log("Income:", INCOME);
  console.log("Signer:", owner.address);

  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME, owner);
  const tx = await income.adminRestoreEscrow(1, 2, 156n, { gasLimit: 250000n });
  await tx.wait();

  const restored = await income.escrowBalances(1, 2);
  console.log("Rescue tx:", tx.hash);
  console.log("escrowBalances(1,2):", restored.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
