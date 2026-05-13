import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
  const USDT = process.env.USDT_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt([
    "function adminSweepToCreator(address) external"
  ], CORE, deployer);

  const usdt = await ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], USDT);

  const before = await usdt.balanceOf(CORE);
  const creatorBefore = await usdt.balanceOf(CREATOR);
  console.log("Core before:", ethers.formatUnits(before, 18));
  console.log("Creator before:", ethers.formatUnits(creatorBefore, 18));

  try {
    await (await core.adminSweepToCreator(USDT)).wait();
    console.log("Sweep done ✅");
  } catch {
    console.log("adminSweepToCreator not found");
    console.log("Need to add to MetaGuildXCore.sol");
  }

  const after = await usdt.balanceOf(CORE);
  const creatorAfter = await usdt.balanceOf(CREATOR);
  console.log("Core after:", ethers.formatUnits(after, 18));
  console.log("Creator after:", ethers.formatUnits(creatorAfter, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
