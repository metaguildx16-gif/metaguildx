import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const TREE_PROXY = "0xf2aC2f87DFabf67EDAdCfFF8dbb9A1aAEB93c923";

  // Deploy new implementation directly
  const TreeFactory = await ethers.getContractFactory("BinaryTree");
  console.log("Deploying new BinaryTree implementation...");
  const newImpl = await TreeFactory.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log("New impl deployed:", newImplAddress);

  // Call upgradeTo directly on proxy
  const proxy = await ethers.getContractAt("BinaryTree", TREE_PROXY, deployer);
  console.log("Calling upgradeTo...");
  const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  await tx.wait();

  console.log("BinaryTree upgraded to:", newImplAddress);
}

main().catch((e) => { console.error(e); process.exit(1); });
