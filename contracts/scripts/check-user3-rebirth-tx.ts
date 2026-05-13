import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const UPGRADE = process.env.UPGRADE_ENGINE_ADDRESS!;

  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const upgrade = await ethers.getContractAt(
    [
      "event RebirthCreated(uint256 indexed originalUserId, uint256 indexed newUserId)",
    ],
    UPGRADE
  );

  console.log("=== FINDING REBIRTH TX ===");

  const rebirthEvents: any[] = [];
  let from = 149800000;
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const events = await upgrade.queryFilter(upgrade.filters.RebirthCreated(), from, to);
      rebirthEvents.push(...events);
    } catch {}
    from = to + 1;
  }

  console.log("Total rebirths:", rebirthEvents.length);

  for (const e of rebirthEvents) {
    const args = (e as any).args;
    console.log("\nRebirth event:");
    console.log("  originalUserId:", args.originalUserId.toString());
    console.log("  newUserId:", args.newUserId.toString());
    console.log("  blockNumber:", e.blockNumber);
    console.log("  txHash:", e.transactionHash);
  }

  if (rebirthEvents.length > 0) {
    const rebirthTx = await provider.getTransaction(rebirthEvents[0].transactionHash);
    const rebirthReceipt = await provider.getTransactionReceipt(rebirthEvents[0].transactionHash);

    console.log("\n=== REBIRTH TX DETAILS ===");
    console.log("from:", rebirthTx?.from);
    console.log("to:", rebirthTx?.to);
    console.log("gasUsed:", rebirthReceipt?.gasUsed.toString());
    console.log("status:", rebirthReceipt?.status);
    console.log("logs count:", rebirthReceipt?.logs.length);

    const core = await ethers.getContractAt(
      [
        "event UserRegistered(uint256 indexed userId, address indexed wallet, uint256 sponsorId)",
      ],
      CORE
    );

    const blockNum = rebirthEvents[0].blockNumber;
    const regEvents = await core.queryFilter(core.filters.UserRegistered(), blockNum, blockNum);

    console.log("\n=== REGISTRATION IN SAME BLOCK ===");
    for (const e of regEvents) {
      const args = (e as any).args;
      console.log("userId:", args.userId.toString());
      console.log("wallet:", args.wallet);
      console.log("sponsorId:", args.sponsorId.toString());
    }

    console.log("\n=== KEY QUESTION ===");
    console.log("Was this registration under User 3?");
    console.log("What sponsorId triggered rebirth?");
    console.log("Same cashback pool issue then?");

    const cashback = await ethers.getContractAt(
      ["function coreContract() view returns (address)"],
      process.env.CASHBACK_POOL_ADDRESS!
    );

    const cashbackCore = await cashback.coreContract();
    console.log("\nCurrent cashback coreContract:", cashbackCore);
    console.log("Current CORE:", CORE);
    console.log("Match:", cashbackCore.toLowerCase() === CORE.toLowerCase());
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
