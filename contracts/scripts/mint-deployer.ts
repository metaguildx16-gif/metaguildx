import { ethers } from "hardhat";

async function main() {
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const before = await usdt.balanceOf(deployer.address);
  console.log("Before:", ethers.formatUnits(before, 18), "USDT");

  const tx = await usdt.mint(deployer.address, ethers.parseUnits("1000", 18));
  await tx.wait();

  const after = await usdt.balanceOf(deployer.address);
  console.log("After:", ethers.formatUnits(after, 18), "USDT");
}

main().catch(console.error);
