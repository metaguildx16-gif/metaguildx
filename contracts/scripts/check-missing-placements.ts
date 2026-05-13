import { ethers } from "hardhat";

async function main() {
  const TREE = process.env.BINARY_TREE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
      "function placeNodeExact(uint256 parentId, uint256 userId, bool isLeft) external",
      "function findNextSlotUnderSponsor(uint256) view returns (uint256, bool)",
    ],
    TREE
  );

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function nextUserId() view returns (uint256)",
    ],
    CORE
  );

  const nextId = await core.nextUserId();
  console.log("Total users:", (Number(nextId) - 1).toString());

  console.log("\n=== MISSING FROM BINARY TREE ===");
  const missing: number[] = [];

  for (let i = 1; i < Number(nextId); i += 1) {
    const node = await tree.nodes(BigInt(i));
    const u = await core.usersById(BigInt(i));

    if (i === 1) continue;

    if (node.parentId === 0n) {
      missing.push(i);
      console.log(`User ${i}: MISSING from tree`);
      console.log(`  sponsor: ${u.sponsorId}`);
      console.log(`  packageLevel: ${u.packageLevel}`);
    }
  }

  console.log("\nTotal missing:", missing.length);
  console.log("Missing users:", missing.join(", "));

  console.log("\n=== WHERE SHOULD THEY BE PLACED? ===");
  for (const userId of missing) {
    const u = await core.usersById(BigInt(userId));
    const sponsorId = u.sponsorId;

    try {
      const [parentId, isLeft] = await tree.findNextSlotUnderSponsor(sponsorId);
      console.log(
        `User ${userId}:`,
        `sponsor=${sponsorId}`,
        `→ parent=${parentId}`,
        `isLeft=${isLeft}`
      );
    } catch (e: any) {
      console.log(
        `User ${userId}:`,
        `sponsor=${sponsorId}`,
        `→ ERROR: ${String(e.message).substring(0, 50)}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
