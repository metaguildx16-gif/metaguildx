import { ethers, upgrades } from "hardhat";

async function main() {
const PROXY = "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82";
  const BinaryTree = await ethers.getContractFactory("BinaryTree");
  const upgraded = await upgrades.upgradeProxy(PROXY, BinaryTree);
  await upgraded.waitForDeployment();
  console.log("BinaryTree upgraded âœ…");
  console.log("Proxy:", await upgraded.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
