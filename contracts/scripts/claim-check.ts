import { ethers } from "hardhat";
async function main() {
  const stk = await ethers.getContractAt("MGXStaking", "0xa24c3Be2fce7293490543B72d01c2f7D1059b289");
  const MGX = "0x1C1E7E7707bD452FF46BCEf2288Ee9f5E0A1F59d";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  
  const rp = await stk.rewardPool();
  const pr_mgx = await stk.stakingRewardPoolPlatformReserve(MGX);
  const pr_usdt = await stk.stakingRewardPoolPlatformReserve(USDT);
  const ar_mgx = await stk.stakingRewardPoolAssetReserve(MGX);
  
  console.log("rewardPool:          ", ethers.formatEther(rp));
  console.log("platformReserve[MGX]:", ethers.formatEther(pr_mgx));
  console.log("platformReserve[USDT]:", ethers.formatEther(pr_usdt));
  console.log("assetReserve[MGX]:   ", ethers.formatEther(ar_mgx));
}
main().catch(console.error);
