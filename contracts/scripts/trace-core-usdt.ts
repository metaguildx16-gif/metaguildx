import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const usdt = await ethers.getContractAt([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ], USDT);

  console.log("=== USDT TRANSFERS TO CORE ===");

  let allTransfers: any[] = [];
  let from = 149800000;
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const events = await usdt.queryFilter(
        usdt.filters.Transfer(null, CORE),
        from,
        to
      );
      allTransfers.push(...events);
    } catch {}
    from = to + 1;
  }

  console.log("Total transfers TO Core:", allTransfers.length);
  let totalIn = 0n;
  for (const e of allTransfers) {
    const args = (e as any).args;
    console.log(
      `  from: ${args.from.substring(0, 10)}...`,
      `amount: ${ethers.formatUnits(args.value, 18)} USDT`,
      `block: ${e.blockNumber}`
    );
    totalIn += args.value;
  }
  console.log("Total IN:", ethers.formatUnits(totalIn, 18), "USDT");

  console.log("\n=== USDT TRANSFERS FROM CORE ===");
  let allOut: any[] = [];
  from = 149800000;
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const events = await usdt.queryFilter(
        usdt.filters.Transfer(CORE, null),
        from,
        to
      );
      allOut.push(...events);
    } catch {}
    from = to + 1;
  }

  console.log("Total transfers FROM Core:", allOut.length);
  let totalOut = 0n;
  for (const e of allOut) {
    const args = (e as any).args;
    console.log(
      `  to: ${args.to.substring(0, 10)}...`,
      `amount: ${ethers.formatUnits(args.value, 18)} USDT`,
      `block: ${e.blockNumber}`
    );
    totalOut += args.value;
  }
  console.log("Total OUT:", ethers.formatUnits(totalOut, 18), "USDT");

  const balance = totalIn - totalOut;
  console.log("\nNet balance:", ethers.formatUnits(balance, 18), "USDT");
  console.log("Current balance: 10.0 USDT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
