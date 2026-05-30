import { ethers } from "hardhat";
async function main() {
  const mgx = await ethers.getContractAt("MGXToken", "0x72206e4c4e51C7fe704bd1F6E8aB6b622ad5feD5");
  const core = await ethers.getContractAt("MetaGuildXCore", "0xbF357543570E5f107513fa9955f646d2022bc78a");
  const stk = await ethers.getContractAt("MGXStaking", "0xe8A0Ae5ad1fd066Deb21c53A9652D89a778ec943");
  
  const user1wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const user2wallet = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";
  
  // MGX balances
  const bal1 = await mgx.balanceOf(user1wallet);
  const bal2 = await mgx.balanceOf(user2wallet);
  const coreBal = await mgx.balanceOf(await core.getAddress());
  
  console.log("User1 MGX balance:", ethers.formatEther(bal1));
  console.log("User2 MGX balance:", ethers.formatEther(bal2));
  console.log("Core MGX balance: ", ethers.formatEther(coreBal));
  
  // Staking positions
  const pos1 = await stk.getStakePositions(user1wallet);
  const pos2 = await stk.getStakePositions(user2wallet);
  console.log("User1 stake positions:", pos1.length);
  console.log("User2 stake positions:", pos2.length);
  
  // Allocations
  const alloc1 = await core.tokenAllocationsByUser(1);
  const alloc2 = await core.tokenAllocationsByUser(2);
  console.log("User1 allocation:", ethers.formatEther(alloc1));
  console.log("User2 allocation:", ethers.formatEther(alloc2));
}
main().catch(console.error);
