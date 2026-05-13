import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const TREE = process.env.BINARY_TREE_ADDRESS!;
  console.log("Tree proxy:", TREE);

  const tree = await ethers.getContractAt(
    [
      "function rootUserId() view returns (uint256)",
      "function coreContract() view returns (address)",
      "function maxDepth() view returns (uint256)",
      "function nodes(uint256) view returns (uint256,uint256,uint256,uint256)",
      "function nodeDepth(uint256) view returns (uint256)",
      "function findNextAvailableSlot(uint256) view returns (uint256,bool)",
      "function assignRoot(uint256)",
      "function placeNode(uint256,uint256)",
    ],
    TREE
  );

  try {
    const rootId = await tree.rootUserId();
    console.log("Tree rootUserId:", rootId.toString());
  } catch (e) {
    const err = e as { message?: string };
    console.log("rootUserId() FAILED:", err.message);
  }

  try {
    const core = await tree.coreContract();
    console.log("Tree coreContract:", core);
  } catch (e) {
    const err = e as { message?: string };
    console.log("coreContract() FAILED:", err.message);
  }

  try {
    const depth = await tree.maxDepth();
    console.log("Tree maxDepth:", depth.toString());
  } catch (e) {
    const err = e as { message?: string };
    console.log("maxDepth() FAILED:", err.message);
  }

  try {
    const node = await tree.nodes(1n);
    console.log("Node[1]:", {
      id: node[0].toString(),
      parentId: node[1].toString(),
      leftChildId: node[2].toString(),
      rightChildId: node[3].toString(),
    });
  } catch (e) {
    const err = e as { message?: string };
    console.log("nodes(1) FAILED:", err.message);
  }

  try {
    const [parentId, isLeft] = await tree.findNextAvailableSlot(1n);
    console.log("findNextAvailableSlot(1):", {
      parentId: parentId.toString(),
      isLeft,
    });
  } catch (e) {
    const err = e as { message?: string };
    console.log("findNextAvailableSlot(1) FAILED:", err.message);
  }

  try {
    const d = await tree.nodeDepth(1n);
    console.log("nodeDepth[1]:", d.toString());
  } catch (e) {
    const err = e as { message?: string };
    console.log("nodeDepth(1) FAILED:", err.message);
  }
}

main().catch(console.error);
