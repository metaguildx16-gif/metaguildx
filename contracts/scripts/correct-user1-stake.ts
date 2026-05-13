import { ethers } from "hardhat";

async function main() {
  const STAKING_PROXY = "0x415cdCFdD0Da9c1493bBEb69a2780C7EDa13aD06";
  const SYSTEM = process.env.SYSTEM_PROXY ?? process.env.SYSTEM_PROXY_ADDRESS ?? "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";
  const MISSING_AMOUNT = ethers.parseUnits("2", 18);

  const [owner] = await ethers.getSigners();
  const staking = await ethers.getContractAt("MGXStaking", STAKING_PROXY, owner);
  const system = await ethers.getContractAt("MetaGuildXSystem", SYSTEM, owner);
  const stakingOwner = await staking.owner();

  const userId = await system.userIdByAddress(USER);
  if (userId === 0n) {
    throw new Error(`User not found for wallet ${USER}`);
  }

  const user = await system.usersById(userId);
  const stakeBefore = await staking.getStakePosition(USER);
  const liquidAllocation = await system.tokenAllocationsByUser(userId);

  console.log("Owner                :", owner.address);
  console.log("Staking owner        :", stakingOwner);
  console.log("User wallet          :", USER);
  console.log("User ID              :", userId.toString());
  console.log("Package level        :", user.packageLevel.toString());
  console.log("Current staked MGX   :", ethers.formatUnits(stakeBefore[0], 18));
  console.log("Current liquid MGX   :", ethers.formatUnits(liquidAllocation, 18));
  console.log("Correction to apply  :", ethers.formatUnits(MISSING_AMOUNT, 18), "MGX");

  await staking.adminCorrectStake.staticCall(USER, MISSING_AMOUNT);
  const tx = await staking.adminCorrectStake(USER, MISSING_AMOUNT, {
    gasLimit: 200_000n
  });
  await tx.wait();
  console.log("Correction tx        :", tx.hash);

  const stakeAfter = await staking.getStakePosition(USER);
  console.log("Staked MGX after     :", ethers.formatUnits(stakeAfter[0], 18));
  console.log(
    "Expected stake after :",
    `${ethers.formatUnits(stakeBefore[0] + MISSING_AMOUNT, 18)} MGX`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
