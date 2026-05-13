import { ethers } from "hardhat";

async function main() {
  const NEW_ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  const OLD_ROUTER = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;
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

  const upgrade = await ethers.getContractAt(
    [
      "function getRebirthIds(uint256) view returns (uint256[] memory)"
    ],
    UPGRADE
  );

  console.log("=== REBIRTH IDs ===");
  const rebirthIds: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const ids = await upgrade.getRebirthIds(BigInt(i));
    if (ids.length > 0) {
      console.log(`User ${i} rebirthIds:`, ids.map((r: bigint) => r.toString()));
      ids.forEach((id: bigint) => rebirthIds.push(Number(id)));
    }
  }
  console.log("All rebirth IDs:", rebirthIds);

  console.log("\n=== CROSSLINE INCOME TO USER 1 ===");

  for (const routerAddr of [OLD_ROUTER, NEW_ROUTER]) {
    const router = await ethers.getContractAt(
      [
        "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)",
        "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)"
      ],
      routerAddr
    );

    const levelEvents = await queryChunked(router, router.filters.LevelIncomeRecorded(null, 1n));

    console.log(`\nRouter ${routerAddr.substring(0, 10)}...`);
    console.log("Level events to User 1:", levelEvents.length);

    let crosslineTotal = 0n;
    let normalTotal = 0n;

    for (const e of levelEvents) {
      const args = (e as any).args;
      const fromUser = Number(args.fromUserId);
      const amount = BigInt(args.amount);
      const isRebirthSource = rebirthIds.includes(fromUser);
      if (isRebirthSource) {
        crosslineTotal += amount;
      } else {
        normalTotal += amount;
      }
      console.log(
        `  from User ${fromUser}:`,
        `$${Number(amount) / 10}`,
        `level=${args.level}`,
        isRebirthSource ? "[REBIRTH SOURCE]" : ""
      );
    }

    console.log("Rebirth-source total:", `$${Number(crosslineTotal) / 10}`);
    console.log("Non-rebirth total   :", `$${Number(normalTotal) / 10}`);
  }

  console.log("\n=== FROM REBIRTH REGISTRATIONS ===");
  for (const rebirthId of rebirthIds) {
    console.log(`\nRebirth User ${rebirthId}:`);
    for (const routerAddr of [OLD_ROUTER, NEW_ROUTER]) {
      const router = await ethers.getContractAt(
        [
          "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)"
        ],
        routerAddr
      );

      const events = await queryChunked(
        router,
        router.filters.LevelIncomeRecorded(BigInt(rebirthId), 1n)
      );

      if (events.length > 0) {
        let total = 0n;
        for (const e of events) {
          const args = (e as any).args;
          total += args.amount;
          console.log(`  Router ${routerAddr.substring(0, 10)}: $${Number(args.amount) / 10} level=${args.level}`);
        }
        console.log(`  Total from User ${rebirthId}: $${Number(total) / 10}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
