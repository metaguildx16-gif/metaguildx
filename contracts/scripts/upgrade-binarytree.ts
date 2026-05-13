import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const TREE_PROXY = process.env.BINARY_TREE_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading BinaryTree...");
  console.log("Proxy   :", TREE_PROXY);
  console.log("Signer  :", deployer.address);

  const BinaryTree = await ethers.getContractFactory("BinaryTree");
  const upgraded = await upgrades.upgradeProxy(TREE_PROXY, BinaryTree);

  await upgraded.waitForDeployment();
  const newImpl = await upgrades.erc1967.getImplementationAddress(TREE_PROXY);

  console.log("Proxy address (unchanged):", TREE_PROXY);
  console.log("New implementation      :", newImpl);
  console.log("BinaryTree upgrade complete ✅");
}

main().catch(console.error);
