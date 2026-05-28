import { ethers } from "hardhat";

async function main() {
  const mgx = await ethers.getContractAt("MGXToken", "0xFBA4f9618ab7b76705669667542030a1549e68B3");
  const CORE = "0x9B343ae746538218F37f0DA77bdae8dF352ea41c";
  const STAKING = "0xFf2E00A180D4f4Eb03D94a4a736a452025bDe226";
  
  // Check stakeFor - does it use Core balance or user balance?
  const coreBal = await mgx.balanceOf(CORE);
  const stakingBal = await mgx.balanceOf(STAKING);
  console.log("Core MGX balance:   ", ethers.formatEther(coreBal));
  console.log("Staking MGX balance:", ethers.formatEther(stakingBal));
  
  // Check stakeFor source in MGXStaking
  const stk = await ethers.getContractAt("MGXStaking", STAKING);
  const allowance = await mgx.allowance(CORE, STAKING);
  console.log("Core→Staking allowance:", ethers.formatEther(allowance));
}

main().catch(console.error);
