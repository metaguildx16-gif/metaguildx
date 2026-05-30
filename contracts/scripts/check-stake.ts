import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x5002B39533AD5EeA9E09912ECbD6f250eE621737");
  const stk = await ethers.getContractAt("MGXStaking", "0xa24c3Be2fce7293490543B72d01c2f7D1059b289");
  const mgx = await ethers.getContractAt("MGXToken", "0x1C1E7E7707bD452FF46BCEf2288Ee9f5E0A1F59d");
  const wallet = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  
  const mgxBal = await mgx.balanceOf(wallet);
  const allowance = await mgx.allowance(wallet, await stk.getAddress());
  console.log("MGX balance:", ethers.formatEther(mgxBal));
  console.log("MGX allowance to staking:", ethers.formatEther(allowance));
  
  try {
    await core.stake.staticCall(ethers.parseEther("10"), 30, false, { from: wallet });
    console.log("Stake simulation: SUCCESS");
  } catch(e: any) {
    console.log("Stake REVERT:", e.message.slice(0, 150));
  }
}
main().catch(console.error);
