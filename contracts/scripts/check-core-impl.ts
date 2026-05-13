import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const provider = ethers.provider;

  const implSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  const implRaw = await provider.getStorage(CORE, implSlot);
  const implAddr = "0x" + implRaw.slice(26);
  console.log("Core implementation:", implAddr);

  const adminSlot =
    "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
  const adminRaw = await provider.getStorage(CORE, adminSlot);
  const adminAddr = "0x" + adminRaw.slice(26);
  console.log("Core admin/owner:", adminAddr);

  const iface = new ethers.Interface([
    "event Upgraded(address indexed implementation)",
  ]);

  const upgradedEvents: any[] = [];
  let from = 149800000;
  const currentBlock = await provider.getBlockNumber();

  while (from <= currentBlock) {
    const to = Math.min(from + 49000, currentBlock);
    try {
      const logs = await provider.getLogs({
        address: CORE,
        topics: [iface.getEvent("Upgraded")!.topicHash],
        fromBlock: from,
        toBlock: to,
      });
      upgradedEvents.push(...logs);
    } catch {}
    from = to + 1;
  }

  console.log("\nCore Upgraded events:", upgradedEvents.length);
  for (const log of upgradedEvents) {
    const parsed = iface.parseLog(log);
    console.log("  impl:", parsed?.args.implementation);
    console.log("  block:", log.blockNumber);
  }

  const core = await ethers.getContractAt(
    [
      "function nextUserId() view returns (uint256)",
      "function getPackagePrices() view returns (uint256[] memory)",
    ],
    CORE
  );

  const nextId = await core.nextUserId();
  const prices = await core.getPackagePrices();

  console.log("\nnextUserId:", nextId.toString());
  console.log("packagePrices length:", prices.length);
  console.log("prices[0]:", prices[0].toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
