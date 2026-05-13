import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const TREE = process.env.BINARY_TREE_ADDRESS!;

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))",
    ],
    TREE
  );

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))",
      "function isRebirthUser(uint256) view returns (bool)",
      "function isLevelEligibleUser(uint256) view returns (bool)",
    ],
    CORE
  );

  console.log("=== LEVEL PATH FROM USER 19 ===");
  console.log("(Level income flows UP through parents)");

  let currentId = 19n;
  for (let level = 1; level <= 15; level += 1) {
    const node = await tree.nodes(currentId);
    const parentId = node.parentId;

    if (parentId === 0n) {
      console.log(`Level ${level}: ROOT reached`);
      break;
    }

    const u = await core.usersById(parentId);
    const isRebirth = await core.isRebirthUser(parentId);
    const isEligible = await core.isLevelEligibleUser(parentId);

    console.log(`\nLevel ${level}: User ${parentId}`);
    console.log(`  wallet: ${u.account}`);
    console.log(`  packageLevel: ${u.packageLevel}`);
    console.log(`  originalPackageLevel: ${u.originalPackageLevel}`);
    console.log(`  rebirthCount: ${u.rebirthCount}`);
    console.log(`  isRebirthUser: ${isRebirth}`);
    console.log(`  isLevelEligible: ${isEligible}`);
    console.log(`  sponsorId: ${u.sponsorId}`);

    if (isRebirth) {
      console.log("  ⚠️  REBIRTH USER IN PATH!");
    }

    currentId = parentId;
  }

  console.log("\n=== USER 17 xSlot check ===");
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const income = await ethers.getContractAt(
    ["function totalEarnings(uint256,uint256) view returns (uint256)"],
    INCOME
  );

  const u17 = await core.usersById(17n);
  const pkgLevel17 = Number(u17.packageLevel);
  const pkgPrice = 100n;

  const te17 = await income.totalEarnings(17n, BigInt(pkgLevel17));
  const xSlot = Number(te17) / Number(pkgPrice);

  console.log("User 17 packageLevel:", pkgLevel17);
  console.log("totalEarnings pkg1:", te17.toString());
  console.log("xSlot:", Math.floor(xSlot));
  console.log("isRebirthUser:", await core.isRebirthUser(17n));
  console.log("originalPackageLevel:", u17.originalPackageLevel.toString());
  console.log("rebirthCount:", u17.rebirthCount.toString());

  console.log("\n=== KEY QUESTION ===");
  console.log("User 17 rebirthCount:", u17.rebirthCount.toString());
  console.log("isRebirthEligible check:");
  console.log("  originalPackageLevel==1:", u17.originalPackageLevel === 1n);
  console.log("  rebirthIds.length==0: need to check upgrade contract");

  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
  const upgrade = await ethers.getContractAt(
    ["function getRebirthIds(uint256) view returns (uint256[] memory)"],
    UPGRADE
  );

  const rebirthIds17 = await upgrade.getRebirthIds(17n);
  console.log("  getRebirthIds(17):", rebirthIds17.map((r: bigint) => r.toString()));
  console.log("  rebirthIds.length:", rebirthIds17.length);
  console.log("  isRebirthEligible:", u17.originalPackageLevel === 1n && rebirthIds17.length === 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
