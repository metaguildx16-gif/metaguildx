import { ethers } from "hardhat";

async function main() {
  const UPGRADE = "0x200301d8AdBF3C1AF85b35bf081A4A01eFE30322";
  const INCOME = "0x7307Fee5C8163a1eb9a5F050D26AAe6e09a44769";
  const CORE = "0xbBD9e768298E7b636A7a762478F19671954FF0C0";

  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  const ids = await upgrade.getRebirthIds(5);
  const inProg = await upgrade.rebirthInProgress(5);

  console.log("rebirthIds[5]      :", ids.toString());
  console.log("rebirthIds length  :", ids.length.toString());
  console.log("rebirthInProgress  :", inProg);

  const origPkg = await (core as any).getUserOriginalPackageLevel(5);
  const pkgLevel = 1;

  console.log("origPackageLevel   :", origPkg.toString());
  console.log("pkgLevel == 1      :", pkgLevel === 1);
  console.log("origPkg == 1       :", origPkg === 1n);
  console.log("rebirthIds.length==0:", ids.length === 0);
  console.log(
    "isRebirthEligible  :",
    pkgLevel === 1 && origPkg === 1n && ids.length === 0
  );
}

main().catch(console.error);
