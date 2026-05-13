import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const core = await ethers.getContractAt(
    [
      "event UserRegistered(uint256 indexed userId, address indexed wallet, uint256 sponsorId)",
    ],
    CORE
  );

  console.log("=== SUCCESSFUL REGISTRATION GAS ===");

  const allEvents: any[] = [];
  let from = 149800000;
  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const events = await core.queryFilter(core.filters.UserRegistered(), from, to);
      allEvents.push(...events);
    } catch {}
    from = to + 1;
  }

  console.log("Total successful registrations:", allEvents.length);

  const recent = allEvents.slice(-5);
  for (const e of recent) {
    const receipt = await provider.getTransactionReceipt(e.transactionHash);
    const args = (e as any).args;
    console.log(`\nUser ${args.userId}:`);
    console.log("  txHash:", e.transactionHash);
    console.log("  gasUsed:", receipt?.gasUsed.toString());
    console.log("  blockNumber:", e.blockNumber);
    console.log("  logs count:", receipt?.logs.length);
  }

  console.log("\n=== USER 26 (last successful) ===");
  const user26Events = allEvents.filter((e) => (e as any).args.userId.toString() === "26");
  if (user26Events.length > 0) {
    const receipt = await provider.getTransactionReceipt(user26Events[0].transactionHash);
    console.log("gasUsed:", receipt?.gasUsed.toString());
    console.log("logs:", receipt?.logs.length);
    console.log("blockNumber:", user26Events[0].blockNumber);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
