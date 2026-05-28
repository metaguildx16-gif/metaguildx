import { ethers } from "hardhat";

async function main() {
  const stk = await ethers.getContractAt("MGXStaking", "0xCf731C4d43E8a5948706A8A9bba0C713DcbE5FCb");
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const MGX  = "0x94CC4C342E96A4CB4618331e88309906F5ad3815";
  const rp = await stk.rewardPool();
  const pr1 = await stk.stakingRewardPoolPlatformReserve(USDT);
  const pr2 = await stk.stakingRewardPoolPlatformReserve(MGX);
  console.log("rewardPool:          ", ethers.formatEther(rp));
  console.log("platformReserve[USDT]:", ethers.formatEther(pr1));
  console.log("platformReserve[MGX]: ", ethers.formatEther(pr2));
}

main().catch(console.error);
