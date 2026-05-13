import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
  const TREE = process.env.BINARY_TREE_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function binaryTreeContract() view returns (address)"
    ],
    CORE
  );

  const income = await ethers.getContractAt(
    [
      "function rebirthEscrow(uint256) view returns (uint256)",
      "function getRebirthEscrow(uint256) view returns (uint256)"
    ],
    INCOME
  );

  const upgrade = await ethers.getContractAt(
    [
      "function getRebirthIds(uint256) view returns (uint256[] memory)"
    ],
    UPGRADE
  );

  const tree = await ethers.getContractAt(
    [
      "function coreContract() view returns (address)",
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))"
    ],
    TREE
  );

  console.log("=== USER 4 REBIRTH STATE ===");
  const u4 = await core.usersById(4n);
  console.log("sponsor:", u4.sponsorId.toString());
  console.log("originalPkg:", u4.originalPackageLevel.toString());

  const rebirthIds = await upgrade.getRebirthIds(4n);
  console.log("rebirthIds:", rebirthIds.map((r: bigint) => r.toString()));
  console.log("already rebirthed:", rebirthIds.length > 0);

  const escrow = await income.rebirthEscrow(4n);
  console.log("rebirthEscrow:", escrow.toString(), `= $${Number(escrow) / 10}`);

  console.log("\n=== REBIRTH PLACEMENT CHECK ===");
  const u3RebirthIds = await upgrade.getRebirthIds(3n);
  console.log("User 3 rebirthIds:", u3RebirthIds.map((r: bigint) => r.toString()));

  if (u3RebirthIds.length > 0) {
    const rebirthSponsor = u3RebirthIds[u3RebirthIds.length - 1];
    console.log("Rebirth sponsor (latest of User 3):", rebirthSponsor.toString());

    const currentTree = await core.binaryTreeContract();
    console.log("Current Core tree:", currentTree);

    const treeCore = await tree.coreContract();
    console.log("Tree coreContract:", treeCore);

    const node17 = await tree.nodes(rebirthSponsor);
    console.log(`\nUser ${rebirthSponsor} in tree:`);
    console.log("  parent:", node17.parentId.toString());
    console.log("  left:", node17.leftChildId.toString());
    console.log("  right:", node17.rightChildId.toString());
    console.log("  IN TREE:", node17.parentId > 0n || rebirthSponsor === 1n);

    const treeContract = await ethers.getContractAt(
      [
        "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)"
      ],
      TREE
    );

    try {
      const [parentId, isLeft] = await treeContract.findNextSlotUnderSponsor(rebirthSponsor);
      console.log(`\nfindNextSlotUnderSponsor(${rebirthSponsor}):`);
      console.log("  parentId:", parentId.toString());
      console.log("  isLeft:", isLeft);
    } catch (e: any) {
      console.log(`findNextSlotUnderSponsor(${rebirthSponsor}) ERROR:`);
      console.log(" ", e.message.substring(0, 100));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
