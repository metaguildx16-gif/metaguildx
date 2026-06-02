import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x4e699918bc27A9b98D1FFA1251f4CC3d212226Cd");
  const u3orig = await core.getUserOriginalPackageLevel(3);
  const u3pkg = await core.getUserPackageLevel(3);
  const r3 = await upgrade.getRebirthIds(3);
  console.log("User 3 originalPkg:", u3orig.toString());
  console.log("User 3 currentPkg:", u3pkg.toString());
  console.log("User 3 rebirthIds:", r3.toString(), "length:", r3.length);
  console.log("isRebirthEligible if cyclePkg=1:", (u3orig == 1n && r3.length == 0).toString());
  console.log("isRebirthEligible if cyclePkg=2:", false);
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const ue = await income.upgradeEngineContract();
  console.log("Income upgradeEngineContract:", ue);
  console.log("Expected Upgrade addr:        0x4e699918bc27A9b98D1FFA1251f4CC3d212226Cd");
}
main().catch(console.error);
