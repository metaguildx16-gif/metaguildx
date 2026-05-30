import { ethers } from "hardhat";
async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer BNB:", ethers.formatEther(bal));
}
main().catch(console.error);
