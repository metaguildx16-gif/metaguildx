import { ethers } from "hardhat";

const UPGRADE_PROXY = "0x8CF75a78641a0e390C0101a1541Bed82E3214A9A";
const INCOME_PROXY  = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";

const UPGRADE_ABI = [
  "event PackageUpgraded(uint256 indexed userId, uint256 oldLevel, uint256 newLevel)",
];

const INCOME_ABI = [
  "event EscrowCredited(uint256 indexed userId, uint256 amount, uint256 xSlot)",
  "event DirectPayout(uint256 indexed userId, uint256 amount, uint256 xSlot)",
  "event IncomeReset(uint256 indexed userId)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://opbnb-testnet-rpc.bnbchain.org"
  );

  const upgrade = new ethers.Contract(UPGRADE_PROXY, UPGRADE_ABI, provider);
  const income  = new ethers.Contract(INCOME_PROXY, INCOME_ABI, provider);

  const FROM  = 149800000;
  const TO    = await provider.getBlockNumber();
  const CHUNK = 49000;

  const TARGET_USERS = ["1", "4"];

  // Step 1: PackageUpgraded — Users 1 and 4
  console.log("=== PackageUpgraded Events (Users 1 & 4) ===");
  for (let s = FROM; s <= TO; s += CHUNK) {
    const e = Math.min(s + CHUNK - 1, TO);
    const evs = await upgrade.queryFilter(
      upgrade.filters.PackageUpgraded(), s, e
    );
    for (const ev of evs) {
      const a = ev as any;
      const uid = a.args[0].toString();
      if (TARGET_USERS.includes(uid)) {
        console.log(
          "  userId:", uid,
          "| block:", ev.blockNumber,
          "| old:", a.args[1].toString(),
          "→ new:", a.args[2].toString(),
          "| TX:", ev.transactionHash
        );
      }
    }
  }

  // Step 2: IncomeReset — Users 1 and 4
  console.log("\n=== IncomeReset Events (Users 1 & 4) ===");
  for (let s = FROM; s <= TO; s += CHUNK) {
    const e = Math.min(s + CHUNK - 1, TO);
    const evs = await income.queryFilter(
      income.filters.IncomeReset(), s, e
    );
    for (const ev of evs) {
      const a = ev as any;
      const uid = a.args[0].toString();
      if (TARGET_USERS.includes(uid)) {
        console.log(
          "  userId:", uid,
          "| block:", ev.blockNumber,
          "| TX:", ev.transactionHash
        );
      }
    }
  }

  // Step 3: EscrowCredited — Users 1 and 4 (all xSlots)
  console.log("\n=== EscrowCredited (Users 1 & 4) ===");
  for (const uid of [1, 4]) {
    console.log(`\n  -- User #${uid} --`);
    let total = 0n;
    for (let s = FROM; s <= TO; s += CHUNK) {
      const e = Math.min(s + CHUNK - 1, TO);
      const evs = await income.queryFilter(
        income.filters.EscrowCredited(uid), s, e
      );
      for (const ev of evs) {
        const a = ev as any;
        console.log(
          "    block:", ev.blockNumber,
          "| amount:", a.args[1].toString(),
          "| xSlot:", a.args[2].toString()
        );
        total += a.args[1];
      }
    }
    console.log(`  TOTAL EscrowCredited User #${uid}:`, total.toString());
  }

  // Step 4: DirectPayout — Users 1 and 4 (all xSlots)
  console.log("\n=== DirectPayout (Users 1 & 4) ===");
  for (const uid of [1, 4]) {
    console.log(`\n  -- User #${uid} --`);
    let total = 0n;
    for (let s = FROM; s <= TO; s += CHUNK) {
      const e = Math.min(s + CHUNK - 1, TO);
      const evs = await income.queryFilter(
        income.filters.DirectPayout(uid), s, e
      );
      for (const ev of evs) {
        const a = ev as any;
        console.log(
          "    block:", ev.blockNumber,
          "| amount:", a.args[1].toString(),
          "| xSlot:", a.args[2].toString()
        );
        total += a.args[1];
      }
    }
    console.log(`  TOTAL DirectPayout User #${uid}:`, total.toString());
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
