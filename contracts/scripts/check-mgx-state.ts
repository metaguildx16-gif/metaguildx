import { ethers } from "hardhat";

async function main() {
  const STAKING_PROXY = "0x415cdCFdD0Da9c1493bBEb69a2780C7EDa13aD06";
  const SYSTEM = process.env.SYSTEM_PROXY ?? process.env.SYSTEM_PROXY_ADDRESS ?? "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const staking = await ethers.getContractAt("MGXStaking", STAKING_PROXY);
  const system = await ethers.getContractAt("MetaGuildXSystem", SYSTEM);

  const userId = await system.userIdByAddress(USER);
  if (userId === 0n) {
    throw new Error(`User not found for wallet ${USER}`);
  }

  const stakePosition = await staking.getStakePosition(USER);
  const staked = stakePosition[0];
  const liquid = await system.tokenAllocationsByUser(userId);
  const total = staked + liquid;

  console.log("User wallet   :", USER);
  console.log("User ID       :", userId.toString());
  console.log("Staked MGX    :", ethers.formatUnits(staked, 18));
  console.log("Liquid MGX    :", ethers.formatUnits(liquid, 18));
  console.log("Total MGX     :", ethers.formatUnits(total, 18));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
