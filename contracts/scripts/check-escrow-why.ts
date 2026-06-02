import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  for (const uid of [3, 5, 7, 16]) {
    const d = await core.usersById(uid);
    console.log("User " + uid + " index12=" + d[12] + " index11=" + d[11]);
  }
}
main().catch(console.error);
