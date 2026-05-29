import { ethers } from "hardhat";

async function main() {
  const mgx = await ethers.getContractAt("MGXToken", "0xFBA4f9618ab7b76705669667542030a1549e68B3");
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  // Wallet actual MGX balance
  const walletBal = await mgx.balanceOf(wallet);
  console.log("Wallet MGX balance:", ethers.formatEther(walletBal));

  // Primary user allocation
  const uid = await core.userIdByAddress(wallet);
  const alloc = await core.tokenAllocationsByUser(uid);
  console.log("Primary userId:", uid.toString());
  console.log("Primary allocation:", ethers.formatEther(alloc));

  // Rebirth user 59 allocation
  const alloc59 = await core.tokenAllocationsByUser(59);
  console.log("Rebirth 59 allocation:", ethers.formatEther(alloc59));

  // Where is the 10 MGX? Check TokenEngine
  const engine = await ethers.getContractAt("MetaGuildXTokenEngine", "0x3f5C41b0eBa48D26d7ef1A6D157241bb2B84C626");
  const engineBal = await mgx.balanceOf(await engine.getAddress());
  const coreBal = await mgx.balanceOf(await core.getAddress());
  console.log("TokenEngine MGX balance:", ethers.formatEther(engineBal));
  console.log("Core MGX balance:", ethers.formatEther(coreBal));
}

main().catch(console.error);
