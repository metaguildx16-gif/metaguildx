import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  for (let pkg = 1; pkg <= 3; pkg++) {
    const refs = await core.referralCountByPkg(3, pkg);
    console.log("User 3 refs pkg" + pkg + ":", refs.toString());
  }
  const total = await core.getUserSponsorId(3);
  console.log("User 3 sponsor:", total.toString());
  const data = await core.usersById(3);
  console.log("User 3 raw index6 (referralCount?):", data[6].toString());
  console.log("User 3 raw index7:", data[7].toString());
  console.log("User 3 raw index8:", data[8].toString());
}
main().catch(console.error);
