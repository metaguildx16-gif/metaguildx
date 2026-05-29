import { ethers } from "hardhat";

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  const mgx = await ethers.getContractAt("MGXToken", "0xFBA4f9618ab7b76705669667542030a1549e68B3");

  // User 1 details
  const user1 = await core.usersById(1);
  const user59 = await core.usersById(59);
  console.log("User 1 wallet: ", user1.account);
  console.log("User 59 wallet:", user59.account);

  // MGX allocations
  const alloc1  = await core.tokenAllocationsByUser(1);
  const alloc59 = await core.tokenAllocationsByUser(59);
  console.log("User 1 MGX allocation: ", ethers.formatEther(alloc1));
  console.log("User 59 MGX allocation:", ethers.formatEther(alloc59));

  // Wallet balances
  const bal1  = await mgx.balanceOf(user1.account);
  const bal59 = await mgx.balanceOf(user59.account);
  console.log("User 1 MGX wallet bal: ", ethers.formatEther(bal1));
  console.log("User 59 MGX wallet bal:", ethers.formatEther(bal59));

  // Is user 59 a rebirth of user 1?
  const isRebirth59 = await core.isRebirthUser(59);
  console.log("User 59 isRebirthUser:", isRebirth59);
  
  // Rebirth IDs of user 1
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", "0x3aB615f3027c3D4de73d053279b965DC63D8eeAd");
  try {
    const rebirthIds = await upgrade.getRebirthIds(1);
    console.log("User 1 rebirthIds:", rebirthIds.map((r: any) => r.toString()).join(", "));
  } catch(e: any) {
    console.log("getRebirthIds error:", e.message.slice(0,80));
  }
}

main().catch(console.error);
