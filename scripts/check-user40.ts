import { ethers } from "hardhat";

async function main() {
  // Get 40th user details
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  const token = await ethers.getContractAt("MGXToken", "0xFBA4f9618ab7b76705669667542030a1549e68B3");
  const engine = await ethers.getContractAt("MetaGuildXTokenEngine", "0x3f5C41b0eBa48D26d7ef1A6D157241bb2B84C626");

  // Check user 40
  const user40 = await core.users(40);
  console.log("User 40 wallet:", user40.walletAddress);
  
  const bal = await token.balanceOf(user40.walletAddress);
  console.log("User 40 MGX balance:", ethers.formatEther(bal));
  
  // Check pkg level
  console.log("User 40 pkg:", user40.currentPkg?.toString());
  
  // Expected MGX for pkg1
  const mgxAmt = await engine.getMGXAllocation(1);
  console.log("Expected MGX for pkg1:", ethers.formatEther(mgxAmt));
}

main().catch(console.error);
