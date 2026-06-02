import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const tree = await ethers.getContractAt("BinaryTree", "0x6E10BD7c3aa13c5EC36C2DEc15Ba77bdBE3a883b");
  console.log("=== User Chain Analysis ===");
  for (let uid = 1; uid <= 10; uid++) {
    try {
      const pkg = await core.getUserPackageLevel(uid);
      const refs = await core.referralCountByPkg(uid, 1);
      const sponsor = await core.getUserSponsorId(uid);
      const eligible = await core.isLevelEligibleUser(uid);
      const unlocked = Number(refs) * 2;
      let pp = 0n;
      try { pp = await tree.getLevelParent(uid); } catch {}
      console.log("User " + uid + ": sponsor=" + sponsor + " placement=" + pp + " pkg=" + pkg + " refs=" + refs + " unlocked=" + unlocked + " eligible=" + eligible);
    } catch { console.log("User " + uid + ": not registered"); }
  }
}
main().catch(console.error);
