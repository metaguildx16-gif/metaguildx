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

  const upgraded = await upgrades.upgradeProxy(TREE_PROXY, BinaryTree, {
    unsafeAllow: ["external-library-linking"],
  });

  await upgraded.waitForDeployment();
  const newImpl = await upgrades.erc1967.getImplementationAddress(TREE_PROXY);

  console.log("Proxy address (unchanged):", TREE_PROXY);
  console.log("New implementation      :", newImpl);
  console.log("BinaryTree upgrade complete ✅");

  const tree = await ethers.getContractAt("BinaryTree", TREE_PROXY);

  try {
    const [parentId, isLeft] = await tree.findNextAvailableSlot(1n);
    console.log("findNextAvailableSlot(1):", {
      parentId: parentId.toString(),
      isLeft,
    });
    console.log("Tree placement: WORKING ✅");
  } catch (e) {
    const err = e as { message?: string };
    console.log("Tree placement still failing:", err.message);
  }
}

main().catch(console.error);
