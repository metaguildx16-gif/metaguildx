import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const OTHER_TREE = "0x59f18c8A55e441EE86f92b76e506bac8D08E7365";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function nextUserId() view returns (uint256)",
      "function adminBackfillTree(uint256,uint256,bool) external"
    ],
    CORE,
    deployer
  );

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
      "function coreContract() view returns (address)",
      "function setCoreContract(address) external"
    ],
    OTHER_TREE
  );

  const treeCore = await tree.coreContract();
  console.log("OTHER tree coreContract:", treeCore);
  console.log("Expected:", CORE);

  if (treeCore.toLowerCase() !== CORE.toLowerCase()) {
    console.log("Rewiring OTHER tree to current core...");
    await (await tree.setCoreContract(CORE)).wait();
    console.log("OTHER tree rewired ✅");
  }

  const nextId = await core.nextUserId();
  const totalUsers = Number(nextId) - 1;
  console.log("Total users:", totalUsers);

  console.log("\nChecking missing users...");
  const missing: number[] = [];

  for (let i = 1; i <= totalUsers; i++) {
    const node = await tree.nodes(BigInt(i));
    if (node.parentId === 0n && i !== 1) {
      missing.push(i);
      console.log(`User ${i}: MISSING from OTHER tree`);
    }
  }

  if (missing.length === 0) {
    console.log("All users already in OTHER tree ✅");
    return;
  }

  console.log("\nBackfilling", missing.length, "users...");

  for (const userId of missing) {
    const u = await core.usersById(BigInt(userId));
    const sponsorId = u.sponsorId;

    try {
      const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(sponsorId);

      console.log(`User ${userId}: sponsor=${sponsorId} → parent=${parentId} isLeft=${isLeft}`);

      const tx = await core.adminBackfillTree(BigInt(userId), parentId, isLeft);
      await tx.wait();
      console.log("  ✅ Placed!");
    } catch (err: any) {
      console.log(`  ❌ ERROR: ${err.message.substring(0, 100)}`);
    }
  }

  console.log("\n=== VERIFY ===");
  for (const userId of missing) {
    const node = await tree.nodes(BigInt(userId));
    console.log(`User ${userId}: parent=${node.parentId}`, node.parentId > 0n ? "✅" : "❌");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
