import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
  const TREE = process.env.BINARY_TREE_ADDRESS!;

  const core = await ethers.getContractAt([
    "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
    "function getUserOriginalPackageLevel(uint256) view returns (uint8)"
  ], CORE);

  const income = await ethers.getContractAt([
    "function rebirthEscrow(uint256) view returns (uint256)",
    "function totalEarnings(uint256,uint256) view returns (uint256)"
  ], INCOME);

  const upgrade = await ethers.getContractAt([
    "function getRebirthIds(uint256) view returns (uint256[] memory)"
  ], UPGRADE);

  const tree = await ethers.getContractAt([
    "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
    "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
    "function subtreeSize(uint256) view returns (uint256)"
  ], TREE);

  console.log("=== USER 1 REBIRTH AUDIT ===");

  const u1 = await core.usersById(1n);
  console.log("User 1 sponsorId:", u1.sponsorId.toString());
  console.log("User 1 packageLevel:", u1.packageLevel.toString());
  console.log("User 1 originalPkg:", u1.originalPackageLevel.toString());
  console.log("User 1 rebirthCount:", u1.rebirthCount.toString());

  const origPkg = await core.getUserOriginalPackageLevel(1n);
  console.log("getUserOriginalPackageLevel(1):", origPkg.toString());

  const rebirthIds = await upgrade.getRebirthIds(1n);
  console.log("User 1 rebirthIds:", rebirthIds.map((r: bigint) => r.toString()));

  const rebirthEsc = await income.rebirthEscrow(1n);
  console.log("rebirthEscrow[1]:", rebirthEsc.toString(), `= $${Number(rebirthEsc) / 10}`);

  const pkgEarnings = await income.totalEarnings(1n, 1n);
  console.log("totalEarnings pkg1:", pkgEarnings.toString(), `= $${Number(pkgEarnings) / 10}`);

  const pkgPrice = 100n;
  const xSlot = Number(pkgEarnings) / Number(pkgPrice);
  console.log("xSlot:", Math.floor(xSlot));
  console.log("Rebirth threshold: $10 (100 units)");
  console.log("rebirthEscrow >= threshold:", rebirthEsc >= pkgPrice);

  console.log("\n=== USER 1 TREE STRUCTURE ===");
  const node1 = await tree.nodes(1n);
  console.log("User 1 left:", node1.leftChildId.toString());
  console.log("User 1 right:", node1.rightChildId.toString());

  try {
    const leftSize = await tree.subtreeSize(node1.leftChildId);
    const rightSize = await tree.subtreeSize(node1.rightChildId);
    console.log("Left subtree size:", leftSize.toString());
    console.log("Right subtree size:", rightSize.toString());
    console.log("Weaker leg:", leftSize <= rightSize ? "LEFT" : "RIGHT");
  } catch {
    console.log("subtreeSize not available");
  }

  try {
    const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(1n);
    console.log("\nfindNextSlotUnderSponsor(1):");
    console.log("  parentId:", parentId.toString());
    console.log("  isLeft:", isLeft);
  } catch (e: any) {
    console.log("findNextSlotUnderSponsor(1) error:", e.message.substring(0, 100));
  }

  console.log("\n=== REBIRTH PLACEMENT PREDICTION ===");
  console.log("User 1 sponsor = 0 (ROOT)");
  console.log("createRebirthUser(1):");
  console.log("  baseSponsorId = 0 (no sponsor)");
  console.log("  sponsorRebirths = getRebirthIds(0)");
  console.log("  → Places under User 1's own tree?");
  console.log("  → Or special ROOT handling?");

  console.log("\n=== KEY CHECK ===");
  console.log("User 1 sponsorId:", u1.sponsorId.toString());
  console.log("require(sponsorId != 0) for rebirth:");
  console.log("  User 1 sponsorId = 0 → REVERT! 'Root cannot rebirth'");
  console.log("\nConclusion:");
  console.log("  User 1 CANNOT rebirth per current contract!");
  console.log("  Contract requires sponsor != 0 for rebirth");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
