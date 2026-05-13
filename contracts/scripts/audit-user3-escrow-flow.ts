import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";
  const ROUTER = "0xD196777d3b2A4dDC005278D98616b70832C63C20";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);

  const latestBlock = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 50000);

  const escrowLogs = await income.queryFilter(
    income.filters.EscrowCredited(3),
    fromBlock,
    latestBlock
  );
  const payoutLogs = await income.queryFilter(
    income.filters.DirectPayout(3),
    fromBlock,
    latestBlock
  );
  const levelLogs = await router.queryFilter(
    router.filters.LevelIncomeRecorded(undefined, 3),
    fromBlock,
    latestBlock
  );
  const directLogs = await router.queryFilter(
    router.filters.DirectIncomeRecorded(undefined, 3),
    fromBlock,
    latestBlock
  );

  console.log("latestBlock:", latestBlock);
  console.log("fromBlock  :", fromBlock);

  console.log("\n=== ESCROW CREDIT EVENTS (User#3) ===");
  let escrowTotal = 0n;
  for (const ev of escrowLogs) {
    const amount = BigInt((ev.args as any).amount);
    const xSlot = BigInt((ev.args as any).xSlot);
    escrowTotal += amount;
    const receipt = await ethers.provider.getTransactionReceipt(ev.transactionHash);
    const regEvents = await core.queryFilter(core.filters.UserRegistered(), receipt.blockNumber, receipt.blockNumber);
    const regSameTx = regEvents.find((r) => r.transactionHash === ev.transactionHash);
    console.log(
      `tx=${ev.transactionHash} userRegistered=${regSameTx ? (regSameTx.args as any).userId.toString() : "n/a"} amount=${amount} xSlot=${xSlot}`
    );
  }
  console.log("escrowTotal units:", escrowTotal.toString());

  console.log("\n=== DIRECT PAYOUT EVENTS (User#3) ===");
  let payoutTotal = 0n;
  for (const ev of payoutLogs) {
    const amount = BigInt((ev.args as any).amount);
    const xSlot = BigInt((ev.args as any).xSlot);
    payoutTotal += amount;
    const receipt = await ethers.provider.getTransactionReceipt(ev.transactionHash);
    const regEvents = await core.queryFilter(core.filters.UserRegistered(), receipt.blockNumber, receipt.blockNumber);
    const regSameTx = regEvents.find((r) => r.transactionHash === ev.transactionHash);
    console.log(
      `tx=${ev.transactionHash} userRegistered=${regSameTx ? (regSameTx.args as any).userId.toString() : "n/a"} amount=${amount} xSlot=${xSlot}`
    );
  }
  console.log("payoutTotal units:", payoutTotal.toString());

  console.log("\n=== ROUTER DIRECT TO USER#3 ===");
  for (const ev of directLogs) {
    console.log(
      `tx=${ev.transactionHash} fromUser=${(ev.args as any).fromUserId.toString()} amount=${(ev.args as any).amount.toString()}`
    );
  }

  console.log("\n=== ROUTER LEVEL TO USER#3 ===");
  for (const ev of levelLogs) {
    console.log(
      `tx=${ev.transactionHash} fromUser=${(ev.args as any).fromUserId.toString()} level=${(ev.args as any).level.toString()} amount=${(ev.args as any).amount.toString()}`
    );
  }

  const te1 = await income.totalEarnings(3, 1);
  const esc1 = await income.escrowBalances(3, 1);
  console.log("\n=== FINAL STATE ===");
  console.log("totalEarnings[3][1]:", te1.toString());
  console.log("escrowBalances[3][1]:", esc1.toString());
}

main().catch(console.error);
