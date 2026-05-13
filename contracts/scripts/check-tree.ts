import { ethers } from "hardhat";

async function main() {
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const router = await ethers.getContractAt("MetaGuildXSystem", ROUTER);

  const nextUserId = Number(await router.nextUserId());
  const totalUsers = nextUserId - 1;
  console.log("Total users:", totalUsers);
  console.log("");

  for (let i = 1; i <= totalUsers; i++) {
    const profile = await router.usersById(i);
    const node = await router.treeNodes(i);
    console.log(`User ${i}:`);
    console.log(`  Wallet      : ${profile.account}`);
    console.log(`  Sponsor     : ${profile.sponsorId}`);
    console.log(`  Package     : ${profile.packageLevel}`);
    console.log(`  Left child  : ${node.leftChildId}`);
    console.log(`  Right child : ${node.rightChildId}`);
    console.log(`  Parent      : ${node.parentId}`);
    console.log(`  Depth       : ${node.depth}`);
    console.log("");
  }

  console.log("=== PLACEMENT LOGIC VERIFY ===");
  console.log("Expected BFS order:");
  console.log("  User 1 = Root");
  console.log("  User 2 = Under User 1 (left)");
  console.log("  User 3 = Under User 1 (right)");
  console.log("  User 4 = Under User 2 (left)");
  console.log("  User 5 = Under User 2 (right) or User 3 (left)");
  console.log("");

  const node1 = await router.treeNodes(1);
  const node2 = nextUserId > 2 ? await router.treeNodes(2) : null;
  const node3 = nextUserId > 3 ? await router.treeNodes(3) : null;

  console.log("Actual placement:");
  console.log(`  User 1 left=${node1.leftChildId} right=${node1.rightChildId}`);
  console.log(`  User 2 left=${node2?.leftChildId ?? "-"} right=${node2?.rightChildId ?? "-"}`);
  console.log(`  User 3 left=${node3?.leftChildId ?? "-"} right=${node3?.rightChildId ?? "-"}`);

  const bfsCorrect =
    Number(node1.leftChildId) === 2 &&
    Number(node1.rightChildId) === 3;
  console.log("");
  console.log("BFS placement correct?", bfsCorrect ? "YES ✅" : "NO ❌");
}

main().catch(console.error);
