import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;
  const currentBlock = await provider.getBlockNumber();

  const core = await ethers.getContractAt(
    [
      "event UserRegistered(uint256 indexed userId, uint256 indexed sponsorId, address indexed account, uint8 packageLevel, uint256 amount, uint256 placedUnderId, bool placedLeft)",
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

  const toCheck = [...allEvents.slice(0, 3), ...allEvents.slice(-3)];

  for (const e of toCheck) {
    const receipt = await provider.getTransactionReceipt(e.transactionHash);
    const args = (e as any).args;
    console.log(`\nUser ${args.userId}:`);
    console.log("  sponsorId:", args.sponsorId.toString());
    console.log("  placedUnderId:", args.placedUnderId.toString());
    console.log("  gasUsed:", receipt?.gasUsed.toString());
    console.log("  logs:", receipt?.logs.length);
    console.log("  block:", e.blockNumber);
  }

  console.log("\n=== COMPARISON ===");
  console.log("Failed TX gasUsed: 126,830");
  console.log("(If success gas >> 126,830 → revert early)");
  console.log("(If success gas ≈ 126,830 → revert very late)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
