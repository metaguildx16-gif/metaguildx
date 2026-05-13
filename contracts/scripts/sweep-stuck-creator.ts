import { ethers } from "hardhat";

async function main() {
  const CORE = "0xBD66787F1eBe0A135e64240F1822C9082d7a20eF";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const CREATOR = "0xbFF19De173697D07B904a4c7b79e4A524B456991";
  const AMOUNT = ethers.parseUnits("2.8", 18);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const core = await ethers.getContractAt(
    "MetaGuildXCore",
    CORE,
    deployer
  );

  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT,
    deployer
  );

  const balBefore = await usdt.balanceOf(CORE);
  console.log("Core USDT before:", ethers.formatUnits(balBefore, 18));

  const tx = await core.adminSweepAmountToCreator(USDT, AMOUNT);
  await tx.wait();
  console.log("Sweep TX:", tx.hash);

  const balAfter = await usdt.balanceOf(CORE);
  console.log("Core USDT after:", ethers.formatUnits(balAfter, 18));

  const creatorBal = await usdt.balanceOf(CREATOR);
  console.log("Creator wallet balance:", ethers.formatUnits(creatorBal, 18));
}

main().catch(console.error);
