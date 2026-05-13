import { ethers } from "hardhat";

async function main() {
  const trees = [
    "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82",
    "0x93ceF78C90ED74f243123B51f153B601eF47010e",
    "0x59f18c8A55e441EE86f92b76e506bac8D08E7365"
  ];

  for (const treeAddr of trees) {
    const tree = await ethers.getContractAt(
      [
        "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
        "function rootUserId() view returns (uint256)"
      ],
      treeAddr
    );

    console.log("\nTree:", treeAddr);

    const root = await tree.rootUserId();
    console.log("root:", root.toString());

    for (let i = 1; i <= 10; i++) {
      const n = await tree.nodes(BigInt(i));
      if (n.parentId > 0n || i === 1) {
        console.log(
          `User ${i}: parent=${n.parentId}`,
          `left=${n.leftChildId}`,
          `right=${n.rightChildId}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
