import { ethers } from "hardhat";

async function main() {
  const INCOME = "0x87d752D160299c09BaDaac3dd66FBac483A5b67b";
  const [owner] = await ethers.getSigners();

  console.log("Rescuing stuck old-package escrow...");
  console.log("Income:", INCOME);
  console.log("Signer:", owner.address);

  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME, owner);

  const rescues = [
    { userId: 18, pkgLevel: 1, amount: 4n },
    { userId: 24, pkgLevel: 1, amount: 4n }
  ];

  for (const rescue of rescues) {
    const tx = await income.adminReleaseEscrowByPkgToUser(
      rescue.userId,
      rescue.pkgLevel,
      rescue.amount
    );
    await tx.wait();
    console.log(
      `Rescued user ${rescue.userId} pkg ${rescue.pkgLevel} amount ${rescue.amount.toString()} tx: ${tx.hash}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
