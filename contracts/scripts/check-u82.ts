import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const u82 = await core.usersById(82);
  console.log("User 82 package (index3):", u82[3].toString());
  const refs3_pkg1 = await core.referralCountByPkg(3, 1);
  const refs3_pkg2 = await core.referralCountByPkg(3, 2);
  console.log("User 3 refs pkg1:", refs3_pkg1.toString());
  console.log("User 3 refs pkg2:", refs3_pkg2.toString());
  console.log("unlockedLevels if juniorPkg=1:", (Number(refs3_pkg1)*2).toString());
  console.log("unlockedLevels if juniorPkg=2:", (Number(refs3_pkg2)*2).toString());
  const u82sponsor = await core.getUserSponsorId(82);
  console.log("User 82 sponsor:", u82sponsor.toString());
}
main().catch(console.error);
