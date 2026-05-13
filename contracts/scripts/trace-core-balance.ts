import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const provider = ethers.provider;

  const usdt = await ethers.getContractAt([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ], USDT);

  let allEvents: any[] = [];
  let from = 149800000;
  const currentBlock = await provider.getBlockNumber();
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const inEvents = await usdt.queryFilter(
        usdt.filters.Transfer(null, CORE),
        from,
        to
      );
      const outEvents = await usdt.queryFilter(
        usdt.filters.Transfer(CORE, null),
        from,
        to
      );
      allEvents.push(...inEvents, ...outEvents);
    } catch {}
    from = to + 1;
  }

  allEvents.sort((a, b) => a.blockNumber - b.blockNumber);

  console.log("=== CORE BALANCE TRACE ===");
  let runningBalance = 0n;
  let prevBlock = 0;

  for (const e of allEvents) {
    const args = (e as any).args;
    const isIn = args.to.toLowerCase() === CORE.toLowerCase();
    const amount = args.value;

    if (e.blockNumber !== prevBlock && prevBlock !== 0) {
      // Show balance after each block
    }

    if (isIn) {
      runningBalance += amount;
    } else {
      runningBalance -= amount;
    }

    const balanceUsdt = Number(runningBalance) / 1e18;
    const direction = isIn ? "IN " : "OUT";
    const amountUsdt = Number(amount) / 1e18;

    console.log(
      `Block ${e.blockNumber}:`,
      `${direction} ${amountUsdt.toFixed(1)} USDT`,
      `→ Balance: ${balanceUsdt.toFixed(1)} USDT`,
      `TX: ${e.transactionHash.substring(0, 12)}...`
    );

    prevBlock = e.blockNumber;
  }

  console.log("\n=== FINAL BALANCE ===");
  console.log("Calculated:", (Number(runningBalance) / 1e18).toFixed(1), "USDT");

  console.log("\n=== WHEN DID $10 GET STUCK? ===");
  let balance2 = 0n;
  let stuckBlock = 0;
  let stuckTx = "";

  for (const e of allEvents) {
    const args = (e as any).args;
    const isIn = args.to.toLowerCase() === CORE.toLowerCase();

    if (isIn) {
      balance2 += args.value;
    } else {
      balance2 -= args.value;
    }

    if (balance2 === 10n * 10n ** 18n) {
      stuckBlock = e.blockNumber;
      stuckTx = e.transactionHash;
    }
  }

  if (stuckBlock > 0) {
    console.log("Balance became $10 at block:", stuckBlock);
    console.log("TX:", stuckTx);

    const tx = await provider.getTransaction(stuckTx);
    const receipt = await provider.getTransactionReceipt(stuckTx);
    console.log("TX from:", tx?.from);
    console.log("TX gasUsed:", receipt?.gasUsed.toString());
    console.log("TX logs:", receipt?.logs.length);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
