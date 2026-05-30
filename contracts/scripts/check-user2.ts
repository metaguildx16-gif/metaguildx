import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xbF357543570E5f107513fa9955f646d2022bc78a");
  const mgx = await ethers.getContractAt("MGXToken", "0x72206e4c4e51C7fe704bd1F6E8aB6b622ad5feD5");
  const user2 = await core.usersById(2);
  console.log("User 2 wallet:", user2.account);
  const bal = await mgx.balanceOf(user2.account);
  const alloc = await core.tokenAllocationsByUser(2);
  console.log("MGX balance:", ethers.formatEther(bal));
  console.log("MGX allocation:", ethers.formatEther(alloc));
}
main().catch(console.error);
