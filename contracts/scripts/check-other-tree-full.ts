import { ethers } from "hardhat";

async function main() {
  const OTHER = "0x59f18c8A55e441EE86f92b76e506bac8D08E7365";

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))"
    ],
    OTHER
  );

  console.log("=== OTHER TREE FULL STRUCTURE ===");
  let maxUser = 0;
  for (let i = 1; i <= 30; i++) {
    const n = await tree.nodes(BigInt(i));
    if (n.parentId > 0n || i === 1) {
      maxUser = i;
      console.log(`User ${i}: parent=${n.parentId}`, `left=${n.leftChildId}`, `right=${n.rightChildId}`);
    }
  }
  console.log("\nMax user in tree:", maxUser);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
