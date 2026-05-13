import { ethers } from "hardhat";

async function main() {
  const OLD_TREE = "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82";

  const tree = await ethers.getContractAt(
    [
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
      "function rootUserId() view returns (uint256)",
    ],
    OLD_TREE
  );

  console.log("=== OLD BINARY TREE CHECK ===");
  console.log("root:", (await tree.rootUserId()).toString());

  const node4 = await tree.nodes(4n);
  console.log("\nUser 4 tree node:");
  console.log("  left:", node4.leftChildId.toString());
  console.log("  right:", node4.rightChildId.toString());
  console.log("  parent:", node4.parentId.toString());

  try {
    const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(4n);
    console.log("\nfindNextSlotUnderSponsor(4):");
    console.log("  parentId:", parentId.toString());
    console.log("  isLeft:", isLeft);
  } catch (e: any) {
    console.log("findNextSlotUnderSponsor(4) ERROR:");
    console.log(String(e.message).substring(0, 100));
  }

  try {
    const [parentId2, isLeft2] = await tree.findNextSlotUnderSponsor(2n);
    console.log("\nfindNextSlotUnderSponsor(2):");
    console.log("  parentId:", parentId2.toString());
    console.log("  isLeft:", isLeft2);
  } catch (e: any) {
    console.log("findNextSlotUnderSponsor(2) ERROR:");
    console.log(String(e.message).substring(0, 100));
  }

  console.log("\n=== ALL NODES ===");
  for (let i = 1; i <= 15; i += 1) {
    const node = await tree.nodes(BigInt(i));
    if (node.parentId > 0n || i === 1) {
      console.log(
        `User ${i}: parent=${node.parentId} left=${node.leftChildId} right=${node.rightChildId}`
      );
    }
  }

  const NEW_TREE = process.env.BINARY_TREE_ADDRESS!;
  console.log("\n=== NEW TREE (0x93ceF78...) ===");

  const newTree = await ethers.getContractAt(
    [
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
    ],
    NEW_TREE
  );

  try {
    const [p4, l4] = await newTree.findNextSlotUnderSponsor(4n);
    console.log("findNextSlotUnderSponsor(4):", p4.toString(), l4);
  } catch (e: any) {
    console.log("ERROR:", String(e.message).substring(0, 100));
  }

  const newNode4 = await newTree.nodes(4n);
  console.log(
    "User 4: left=",
    newNode4.leftChildId.toString(),
    "right=",
    newNode4.rightChildId.toString()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
