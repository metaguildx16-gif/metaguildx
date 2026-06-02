import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const tree = await ethers.getContractAt("BinaryTree", "0x6E10BD7c3aa13c5EC36C2DEc15Ba77bdBE3a883b");
  console.log("=== User 82 sponsor chain ===");
  let s = 7n;
  for (let i = 2; i <= 10; i++) {
    if (s === 0n) break;
    const refs = await core.referralCountByPkg(s, 1);
    console.log("L" + i + ": User " + s + " refs=" + refs + " unlocked=" + (Number(refs)*2));
    s = await core.getUserSponsorId(s);
  }
  console.log("=== User 82 placement chain from User 55 ===");
  let p = 55n;
  for (let i = 2; i <= 10; i++) {
    if (p === 0n) break;
    const refs = await core.referralCountByPkg(p, 1);
    console.log("L" + i + ": User " + p + " refs=" + refs + " unlocked=" + (Number(refs)*2));
    let next = await tree.getLevelParent(p);
    if (next === 0n) next = await core.getBinaryParent(p);
    p = next;
  }
}
main().catch(console.error);
