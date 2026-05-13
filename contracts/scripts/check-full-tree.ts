import { ethers } from "hardhat";

async function main() {
  const TREE = process.env.BINARY_TREE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
    ],
    TREE
  );

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function isRebirthUser(uint256) view returns (bool)",
    ],
    CORE
  );

  console.log("=== FULL BINARY TREE ===");
  console.log("Format: User X: parent=Y left=Z right=W");
  console.log("");

  for (let i = 1; i <= 26; i += 1) {
    const node = await tree.nodes(BigInt(i));
    const u = await core.usersById(BigInt(i));
    const isRebirth = await core.isRebirthUser(BigInt(i));

    console.log(
      `User ${i}:` +
        ` parent=${node.parentId}` +
        ` left=${node.leftChildId}` +
        ` right=${node.rightChildId}` +
        ` sponsor=${u.sponsorId}` +
        ` pkg=${u.packageLevel}` +
        (isRebirth ? " [REBIRTH]" : "")
    );
  }

  console.log("\n=== USER 17 TREE POSITION ===");
  const node17 = await tree.nodes(17n);
  console.log("parent:", node17.parentId.toString());
  console.log("left:", node17.leftChildId.toString());
  console.log("right:", node17.rightChildId.toString());

  console.log("\n=== USER 19 TREE POSITION ===");
  const node19 = await tree.nodes(19n);
  console.log("parent:", node19.parentId.toString());
  console.log("left:", node19.leftChildId.toString());
  console.log("right:", node19.rightChildId.toString());

  console.log("\n=== NEXT SLOT UNDER USER 4 ===");
  const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(4n);
  console.log("parentId:", parentId.toString());
  console.log("isLeft:", isLeft);

  console.log("\n=== NEXT SLOT UNDER USER 17 ===");
  const [parentId17, isLeft17] = await tree.findNextSlotUnderSponsor(17n);
  console.log("parentId:", parentId17.toString());
  console.log("isLeft:", isLeft17);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
