import { ethers } from "hardhat";

async function main() {
  const OLD_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const NEW_ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
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

  for (const routerAddr of [OLD_ROUTER, NEW_ROUTER]) {
    const router = await ethers.getContractAt(
      [
        "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)",
        "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)",
        "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)"
      ],
      routerAddr
    );

    console.log("\n=== Router:", routerAddr, "===");

    const direct = await queryChunked(router, router.filters.DirectIncomeRecorded(null, 1n));
    console.log("Direct income events:", direct.length);
    let totalDirect = 0n;
    for (const e of direct) {
      const args = (e as any).args;
      console.log(`  from User ${args.fromUserId}: $${Number(args.amount) / 10}`);
      totalDirect += args.amount;
    }
    console.log("Total direct:", `$${Number(totalDirect) / 10}`);

    const level = await queryChunked(router, router.filters.LevelIncomeRecorded(null, 1n));
    console.log("\nLevel income events:", level.length);
    let totalLevel = 0n;
    const levelByLevel: Record<number, bigint> = {};
    for (const e of level) {
      const args = (e as any).args;
      const lvl = Number(args.level);
      levelByLevel[lvl] = (levelByLevel[lvl] ?? 0n) + args.amount;
      totalLevel += args.amount;
    }
    for (const [lvl, amt] of Object.entries(levelByLevel)) {
      console.log(`  Level ${lvl}: $${Number(amt) / 10}`);
    }
    console.log("Total level:", `$${Number(totalLevel) / 10}`);

    const spillover = await queryChunked(router, router.filters.SpilloverIncome(1n));
    console.log("\nSpillover events:", spillover.length);
    let totalSpillover = 0n;
    for (const e of spillover) {
      const args = (e as any).args;
      console.log(`  level=${args.fromLevel}: $${Number(args.amount) / 10}`);
      totalSpillover += args.amount;
    }
    console.log("Total spillover:", `$${Number(totalSpillover) / 10}`);
  }

  const income = await ethers.getContractAt(
    [
      "function getTotalAllIncome(uint256) view returns (uint256)",
      "function totalEarnings(uint256,uint256) view returns (uint256)"
    ],
    INCOME
  );

  console.log("\n=== INCOME ENGINE ===");
  const totalAll = await income.getTotalAllIncome(1n);
  console.log("getTotalAllIncome(1):", `$${Number(totalAll) / 10}`);

  for (let p = 1; p <= 3; p++) {
    const te = await income.totalEarnings(1n, BigInt(p));
    if (te > 0n) {
      console.log(`totalEarnings pkg${p}:`, `$${Number(te) / 10}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
