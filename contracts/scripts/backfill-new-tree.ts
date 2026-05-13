import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const NEW_TREE = process.env.BINARY_TREE_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function adminBackfillTree(uint256,uint256,bool) external",
      "function binaryTreeContract() view returns (address)",
      "function setBinaryTreeContract(address) external",
    ],
    CORE,
    deployer
  );

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
      "function coreContract() view returns (address)",
      "function setCoreContract(address) external",
    ],
    NEW_TREE,
    deployer
  );

  const missingUsers = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];

  console.log("Backfilling", missingUsers.length, "users...");
  console.log("Tree:", NEW_TREE);
  const currentTree = await core.binaryTreeContract();
  console.log("Current core tree:", currentTree);
  if (currentTree.toLowerCase() !== NEW_TREE.toLowerCase()) {
    await (await core.setBinaryTreeContract(NEW_TREE)).wait();
    console.log("Core tree switched to NEW for backfill ✅");
  }
  const treeCore = await tree.coreContract();
  console.log("New tree coreContract:", treeCore);
  if (treeCore.toLowerCase() !== CORE.toLowerCase()) {
    await (await tree.setCoreContract(CORE)).wait();
    console.log("New tree coreContract rewired to current Core ✅");
  }

  for (const userId of missingUsers) {
    const node = await tree.nodes(BigInt(userId));
    if (node.parentId > 0n || userId === 1) {
      console.log(`User ${userId}: Already in tree ✅`);
      continue;
    }

    const u = await core.usersById(BigInt(userId));
    const sponsorId = u.sponsorId;

    try {
      const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(sponsorId);

      console.log(`\nUser ${userId}:`);
      console.log(`  sponsor: ${sponsorId}`);
      console.log(`  placing under: ${parentId}`);
      console.log(`  isLeft: ${isLeft}`);

      const tx = await core.adminBackfillTree(BigInt(userId), parentId, isLeft);
      await tx.wait();
      console.log("  ✅ Placed!");
    } catch (err: any) {
      console.log(`  ❌ ERROR: ${String(err.message).substring(0, 100)}`);
    }
  }

  console.log("\n=== VERIFY BACKFILL ===");
  let allPlaced = true;
  for (const userId of missingUsers) {
    const node = await tree.nodes(BigInt(userId));
    if (node.parentId === 0n && userId !== 1) {
      console.log(`User ${userId}: ❌ Still missing!`);
      allPlaced = false;
    } else {
      console.log(`User ${userId}: ✅ parent=${node.parentId}`);
    }
  }
  console.log(allPlaced ? "\nAll placed! ✅" : "\nSome missing! ❌");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
