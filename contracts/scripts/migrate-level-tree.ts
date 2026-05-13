import { ethers } from "hardhat";

async function main() {
  const CORE = "0xBD66787F1eBe0A135e64240F1822C9082d7a20eF";
  const BINARY = "0x6d37A7A2c6C091F980afA3790bf28975E39ec558";

  const [deployer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore", CORE, deployer);
  const binary = await ethers.getContractAt("BinaryTree", BINARY, deployer);

  type EligibleUser = {
    userId: number;
    sponsorId: number;
    eligibleAt: number;
  };

  const candidateIds: number[] = [];
  for (let i = 1; i <= 50; i++) {
    if (await binary.isLevelEligible(BigInt(i))) {
      candidateIds.push(i);
    }
  }

  const users: EligibleUser[] = [];

  for (const id of candidateIds) {
    const profile = await core.usersById(BigInt(id));
    const sponsorId = Number(profile.sponsorId ?? profile[2] ?? 0n);

    let eligibleAt = Number(profile.joinedAt ?? profile[10] ?? 0n);

    try {
      const directReferrals = await core.getDirectReferralIds(BigInt(id));
      if (directReferrals && directReferrals.length > 0) {
        const firstReferralId = directReferrals
          .map((value: bigint) => Number(value))
          .sort((a, b) => a - b)[0];
        const firstChild = await core.usersById(BigInt(firstReferralId));
        eligibleAt = Number(firstChild.joinedAt ?? firstChild[10] ?? eligibleAt);
      }
    } catch {
      // fallback to joinedAt
    }

    users.push({ userId: id, sponsorId, eligibleAt });
    console.log(`User ${id}: sponsor=${sponsorId} eligibleAt=${eligibleAt}`);
  }

  users.sort((a, b) => a.eligibleAt - b.eligibleAt || a.userId - b.userId);

  console.log("\nSorted eligibility order:");
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. User ${u.userId} (sponsor=${u.sponsorId})`);
  });

  const userIds = users.map((u) => BigInt(u.userId));
  const sponsorIds = users.map((u) => BigInt(u.sponsorId));

  console.log("\nRunning adminResetAndRebuildLevelTree...");
  const tx = await core.adminResetAndRebuildLevelTree(userIds, sponsorIds);
  await tx.wait();
  console.log("Migration TX:", tx.hash);

  console.log("\n=== Verification ===");
  for (const u of users) {
    const parent = await binary.getLevelParent(BigInt(u.userId));
    const children = await binary.getLevelChildren(BigInt(u.userId));
    const eligible = await binary.isLevelEligible(BigInt(u.userId));
    console.log(
      `User ${u.userId}: parent=${parent.toString()} ` +
        `left=${children[0].toString()} right=${children[1].toString()} ` +
        `eligible=${eligible}`
    );
  }
}

main().catch(console.error);
