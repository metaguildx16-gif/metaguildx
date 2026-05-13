import { ethers } from "hardhat";

async function main() {
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  const usdt = await ethers.getContractAt("MockUSDT", USDT);

  const amount = ethers.parseUnits("1000", 18);
  const tx = await usdt.mint(deployer.address, amount);
  await tx.wait();

  const bal = await usdt.balanceOf(deployer.address);
  console.log("Deployer USDT balance:", ethers.formatUnits(bal, 18), "USDT");
}

main().catch(console.error);
