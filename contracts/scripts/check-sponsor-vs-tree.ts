import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const TREE = process.env.BINARY_TREE_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))"
    ],
    CORE
  );

  const tree = await ethers.getContractAt(
    [
      "function nodes(uint256) view returns (tuple(uint256 id, uint256 parentId, uint256 leftChildId, uint256 rightChildId))"
    ],
    TREE
  );

  console.log("User | Sponsor | Tree Parent");
  for (let i = 1; i <= 10; i++) {
    const u = await core.usersById(BigInt(i));
    const n = await tree.nodes(BigInt(i));
    console.log(`User ${i}: sponsor=${u.sponsorId} tree_parent=${n.parentId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
