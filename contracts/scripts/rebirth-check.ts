import { ethers } from "hardhat";

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x9B343ae746538218F37f0DA77bdae8dF352ea41c");
  const stk = await ethers.getContractAt("MGXStaking", "0xFf2E00A180D4f4Eb03D94a4a736a452025bDe226");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  // Total allocated (primary + rebirth)
  const alloc1  = await core.tokenAllocationsByUser(1);
  const alloc59 = await core.tokenAllocationsByUser(59);
  const totalAlloc = alloc1 + alloc59;
  console.log("Primary alloc:  ", ethers.formatEther(alloc1));
  console.log("Rebirth alloc:  ", ethers.formatEther(alloc59));
  console.log("Total alloc:    ", ethers.formatEther(totalAlloc));

  // Total staked
  const positions = await stk.getStakePositions(wallet);
  let totalStaked = 0n;
  for(const p of positions) totalStaked += p[0];
  console.log("Total staked:   ", ethers.formatEther(totalStaked));

  // Available = allocated - staked
  const available = totalAlloc > totalStaked ? totalAlloc - totalStaked : 0n;
  console.log("Available MGX:  ", ethers.formatEther(available));
}

main().catch(console.error);
