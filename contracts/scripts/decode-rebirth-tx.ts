import { ethers } from "hardhat";

async function main() {
  const txHash =
    "0xfab0863055fe516ed45ee0e95ed705476693c107ed802ae348e28328490edfc6";

  const provider = ethers.provider;
  const receipt = await provider.getTransactionReceipt(txHash);

  console.log("=== REBIRTH TX EVENTS ===");
  console.log("Total logs:", receipt?.logs.length);

  const ifaces = [
    new ethers.Interface([
      "event UserRegistered(uint256 indexed userId, address indexed wallet, uint256 sponsorId)",
      "event PackageUpgraded(uint256 indexed userId, uint256 newLevel)",
      "event RebirthCreated(uint256 indexed originalUserId, uint256 indexed newUserId)",
      "event DirectIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint256 amount)",
      "event LevelIncomeRecorded(uint256 indexed fromUserId, uint256 indexed toUserId, uint8 level, uint256 amount)",
      "event EscrowCredited(uint256 indexed userId, uint256 amount, uint256 xSlot)",
      "event EscrowReleased(uint256 indexed userId, uint256 amount)",
      "event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)",
      "event IncomeReset(uint256 indexed userId)",
      "event PaymentCollected(address indexed payer, address indexed asset, uint256 platformAmount, uint256 settlementAmount)",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event SpilloverIncome(uint256 indexed receiver, uint256 amount, uint8 fromLevel)",
      "event RebirthEscrowReleased(uint256 indexed userId, uint256 amount)",
    ]),
  ];

  for (let i = 0; i < (receipt?.logs.length ?? 0); i += 1) {
    const log = receipt!.logs[i];
    let decoded = false;

    for (const iface of ifaces) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed) {
          console.log(`\nLog ${i + 1}: ${parsed.name}`);
          console.log("  contract:", log.address);
          for (const [key, val] of Object.entries(parsed.args)) {
            if (Number.isNaN(Number(key))) {
              console.log(`  ${key}:`, val.toString());
            }
          }
          decoded = true;
          break;
        }
      } catch {}
    }

    if (!decoded) {
      console.log(`\nLog ${i + 1}: UNKNOWN`);
      console.log("  contract:", log.address);
      console.log("  topic0:", log.topics[0]);
    }
  }

  console.log("\n=== CASHBACK CHECK ===");
  const CASHBACK = process.env.CASHBACK_POOL_ADDRESS!;
  const cashbackLogs = receipt?.logs.filter(
    (l) => l.address.toLowerCase() === CASHBACK.toLowerCase()
  );
  console.log("Cashback pool logs:", cashbackLogs?.length ?? 0);

  const usdtLogs = receipt?.logs.filter(
    (l) => l.address.toLowerCase() === process.env.USDT_ADDRESS!.toLowerCase()
  );
  console.log("USDT transfer logs:", usdtLogs?.length ?? 0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
