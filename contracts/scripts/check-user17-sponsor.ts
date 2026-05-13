import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))"
    ],
    CORE
  );

  const u17 = await core.usersById(17n);
  const u31 = await core.usersById(31n);

  console.log("User 17:");
  console.log("  sponsorId:", u17.sponsorId.toString());
  console.log("  rebirthCount:", u17.rebirthCount.toString());

  console.log("User 31:");
  console.log("  sponsorId:", u31.sponsorId.toString());
  console.log("  rebirthCount:", u31.rebirthCount.toString());

  const router = await ethers.getContractAt(
    [
      "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)",
      "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)"
    ],
    ROUTER
  );

  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  async function queryChunked(contract: any, filter: any) {
    const results: any[] = [];
    let from = 149800000;
    while (from <= currentBlock) {
      const to = Math.min(from + 49000, currentBlock);
      try {
        const events = await contract.queryFilter(filter, from, to);
        results.push(...events);
      } catch {}
      from = to + 1;
    }
    return results;
  }

  for (const userId of [17, 31]) {
    console.log(`\n=== User ${userId} registration income ===`);

    const direct = await queryChunked(router, router.filters.DirectIncomeRecorded(BigInt(userId), null));
    for (const e of direct) {
      const args = (e as any).args;
      console.log(`  Direct → User ${args.toUserId}: $${Number(args.amount) / 10}`);
    }

    const level = await queryChunked(router, router.filters.LevelIncomeRecorded(BigInt(userId), null));
    for (const e of level) {
      const args = (e as any).args;
      console.log(`  Level L${args.level} → User ${args.toUserId}: $${Number(args.amount) / 10}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
