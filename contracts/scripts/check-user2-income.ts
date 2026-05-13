import { ethers } from "hardhat";

async function main() {
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const router = await ethers.getContractAt(
    [
      "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)"
    ],
    ROUTER
  );

  const income = await ethers.getContractAt(
    [
      "function totalEarnings(uint256,uint256) view returns (uint256)",
      "function getTotalAllIncome(uint256) view returns (uint256)"
    ],
    INCOME
  );

  console.log("=== USER 2 INCOME CHECK ===");

  let directEvents: any[] = [];
  let from = 149800000;
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const events = await router.queryFilter(router.filters.DirectIncomeRecorded(null, 2n), from, to);
      directEvents.push(...events);
    } catch {}
    from = to + 1;
  }

  console.log("Direct income events to User 2:", directEvents.length);
  let totalDirect = 0n;
  for (const e of directEvents) {
    const args = (e as any).args;
    console.log(`  from User ${args.fromUserId}:`, `$${Number(args.amount) / 10}`, `block=${e.blockNumber}`);
    totalDirect += args.amount;
  }
  console.log("Total direct:", `$${Number(totalDirect) / 10}`);

  const totalAll = await income.getTotalAllIncome(2n);
  console.log("\ngetTotalAllIncome(2):", totalAll.toString(), `= $${Number(totalAll) / 10}`);

  for (let p = 1; p <= 3; p++) {
    const te = await income.totalEarnings(2n, BigInt(p));
    if (te > 0n) {
      console.log(`totalEarnings pkg${p}:`, te.toString(), `= $${Number(te) / 10}`);
    }
  }

  const u2Profile = await (
    await ethers.getContractAt(
      [
        "function usersById(uint256) view returns (tuple(uint256 id, address account, uint256 sponsorId, uint8 packageLevel, uint8 originalPackageLevel, uint256 totalContribution, uint256 totalEarnings, uint256 directReferrals, uint256 totalTeamBusiness, uint256 rebirthCount, uint256 xCount, uint256 joinedAt, bool surrendered))"
      ],
      process.env.SYSTEM_PROXY_ADDRESS!
    )
  ).usersById(2n);

  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)"
    ],
    process.env.USDT_ADDRESS!
  );

  const walletBal = await usdt.balanceOf(u2Profile.account);
  console.log("\nUser 2 wallet:", u2Profile.account);
  console.log("USDT balance:", ethers.formatUnits(walletBal, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
