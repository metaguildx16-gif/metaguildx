import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;

  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50_000);

  console.log(`Block range: ${fromBlock} -> ${currentBlock}`);

  const income = await ethers.getContractAt(
    [
      "event EscrowCredited(uint256 indexed userId, uint256 amount, uint256 xSlot)",
      "event EscrowReleased(uint256 indexed userId, uint256 amount)",
      "event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)",
      "event IncomeReset(uint256 indexed userId)"
    ],
    INCOME
  );

  const core = await ethers.getContractAt(
    [
      "event PackageUpgraded(uint256 indexed userId, uint256 newLevel)",
      "event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount)"
    ],
    CORE
  );

  console.log("\n=== ESCROW EVENTS ===");

  const credited = await income.queryFilter(
    income.filters.EscrowCredited(),
    fromBlock, currentBlock
  );
  for (const e of credited) {
    const args = (e as any).args;
    console.log(
      `block=${e.blockNumber} EscrowCredited` +
      ` userId=${args.userId}` +
      ` amount=${args.amount}` +
      ` xSlot=${args.xSlot}`
    );
  }

  const released = await income.queryFilter(
    income.filters.EscrowReleased(),
    fromBlock, currentBlock
  );
  for (const e of released) {
    const args = (e as any).args;
    console.log(
      `block=${e.blockNumber} EscrowReleased` +
      ` userId=${args.userId}` +
      ` amount=${args.amount}`
    );
  }

  const payouts = await income.queryFilter(
    income.filters.DirectPayout(),
    fromBlock, currentBlock
  );
  for (const e of payouts) {
    const args = (e as any).args;
    console.log(
      `block=${e.blockNumber} DirectPayout` +
      ` userId=${args.userId}` +
      ` amount=${args.amount}` +
      ` xSlot=${args.xSlot}`
    );
  }

  console.log("\n=== UPGRADE EVENTS ===");

  const upgrades = await core.queryFilter(
    core.filters.PackageUpgraded(),
    fromBlock, currentBlock
  );
  for (const e of upgrades) {
    const args = (e as any).args;
    console.log(
      `block=${e.blockNumber} PackageUpgraded` +
      ` userId=${args.userId}` +
      ` newLevel=${args.newLevel}`
    );
  }

  const payments = await core.queryFilter(
    core.filters.PaymentCollected(),
    fromBlock, currentBlock
  );
  for (const e of payments) {
    const args = (e as any).args;
    console.log(
      `block=${e.blockNumber} PaymentCollected` +
      ` payer=${args.payer}` +
      ` platform=${args.platformAmount}` +
      ` settlement=${ethers.formatUnits(
          args.settlementAmount, 18
        )} USDT`
    );
  }
}

main().catch(console.error);
