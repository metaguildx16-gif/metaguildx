import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const core = await ethers.getContractAt(
    [
      "function nextUserId() view returns (uint256)",
      "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)"
    ],
    CORE
  );

  const nextId = await core.nextUserId();
  console.log("nextUserId:", nextId.toString());
  console.log("Total users:", (Number(nextId) - 1).toString());

  console.log("\n=== BLOCK 150874332 TXs ===");
  const block = await provider.getBlock(150874332, true);

  if (block) {
    console.log("Transactions:", block.transactions.length);
    for (const tx of block.transactions) {
      if (typeof tx === "string") continue;
      console.log("\nTX:", tx.hash);
      console.log("from:", tx.from);
      console.log("to:", tx.to);
      console.log("data selector:", tx.data.substring(0, 10));

      const receipt = await provider.getTransactionReceipt(tx.hash);
      console.log("status:", receipt?.status === 1 ? "SUCCESS ✅" : "FAILED ❌");
      console.log("gasUsed:", receipt?.gasUsed.toString());
      console.log("logs:", receipt?.logs.length);
    }
  }

  console.log("\n=== RECENT REGISTRATIONS ===");
  let events: any[] = [];
  const fromBlock = currentBlock - 10000;
  try {
    events = await core.queryFilter(core.filters.UserRegistered(), fromBlock, currentBlock);
  } catch {}

  console.log("Recent UserRegistered events:", events.length);
  for (const e of events) {
    const args = (e as any).args;
    console.log(`User ${args.userId}: block=${e.blockNumber}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
