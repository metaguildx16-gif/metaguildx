import { ethers } from "hardhat";

async function main() {
  const OLD_TREES = [
    "0x3eac85Aa39084Bd016D84638926c45C5Bc71cB82",
    "0x93ceF78C90ED74f243123B51f153B601eF47010e",
  ];

  for (const treeAddr of OLD_TREES) {
    console.log(`\n=== Tree: ${treeAddr} ===`);

    const tree = await ethers.getContractAt(
      [
        "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
        "function rootUserId() view returns (uint256)",
      ],
      treeAddr
    );

    try {
      const root = await tree.rootUserId();
      console.log("rootUserId:", root.toString());
    } catch {
      console.log("rootUserId: ERROR");
    }

    for (let i = 1; i <= 26; i += 1) {
      try {
        const node = await tree.nodes(BigInt(i));
        if (
          node.id > 0n ||
          node.parentId > 0n ||
          node.leftChildId > 0n ||
          node.rightChildId > 0n
        ) {
          console.log(
            `User ${i}:`,
            `parent=${node.parentId}`,
            `left=${node.leftChildId}`,
            `right=${node.rightChildId}`
          );
        }
      } catch {}
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
