import { ethers } from "hardhat";

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  const mgx = await ethers.getContractAt("MGXToken", "0xFBA4f9618ab7b76705669667542030a1549e68B3");
  const user1 = await core.usersById(1);
  const user59 = await core.usersById(59);
  console.log("User 1 wallet: ", user1.account);
  console.log("User 59 wallet:", user59.account);
  const alloc1 = await core.tokenAllocationsByUser(1);
  const alloc59 = await core.tokenAllocationsByUser(59);
  console.log("User 1 MGX alloc: ", ethers.formatEther(alloc1));
  console.log("User 59 MGX alloc:", ethers.formatEther(alloc59));
  const isRebirth = await core.isRebirthUser(59);
  console.log("User 59 isRebirth:", isRebirth);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x3aB615f3027c3D4de73d053279b965DC63D8eeAd");
  try {
    const ids = await upgrade.getRebirthIds(1);
    console.log("User 1 rebirthIds:", ids.map((r: any) => r.toString()).join(", "));
  } catch(e: any) { console.log("getRebirthIds:", e.message.slice(0,80)); }
}
main().catch(console.error);
