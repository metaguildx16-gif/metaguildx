import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const u3 = await core.usersById(3);
  console.log("User 3 full data:", u3);
  const wallet3 = u3[1];
  console.log("User 3 wallet:", wallet3);
  const isEligible = await core.isLevelEligibleUser(3);
  console.log("User 3 eligible:", isEligible);
}
main().catch(console.error);
