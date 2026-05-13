import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  const pkg1 = await core.getPackagePriceByLevel(1);

  const te1 = await income.totalEarnings(3, 1);
  const esc1 = await income.escrowBalances(3, 1);

  const bucketReceived = te1 > esc1 ? te1 - esc1 : 0n;
  const xSlot = bucketReceived / pkg1;

  console.log("=== User#3 Bucket 1 Analysis ===");
  console.log("totalEarnings[3][1]  :", te1.toString(), "units");
  console.log("escrowBalances[3][1] :", esc1.toString(), "units");
  console.log(
    "bucketReceived       :",
    bucketReceived.toString(),
    "(totalEarnings - escrow)"
  );
  console.log("pkg1 price           :", pkg1.toString(), "units");
  console.log("xSlot (bucket-based) :", xSlot.toString());
  console.log(
    "next income zone     :",
    xSlot === 0n
      ? "→ WALLET ✅"
      : xSlot === 1n || xSlot === 2n
        ? "→ ESCROW"
        : xSlot === 3n
          ? "→ WALLET ✅"
          : xSlot >= 4n
            ? "→ REBIRTH 🎯"
            : "→ WALLET"
  );

  console.log("\n--- 5X Journey ---");
  for (let i = 0; i < 5; i++) {
    const zoneStart = BigInt(i) * pkg1;
    const zoneEnd = BigInt(i + 1) * pkg1;
    const inZone = bucketReceived >= zoneEnd
      ? pkg1
      : bucketReceived > zoneStart
        ? bucketReceived - zoneStart
        : 0n;
    const rule = i === 0 || i === 3 ? "wallet" : i === 1 || i === 2 ? "escrow" : "REBIRTH";
    const status = inZone === pkg1 ? "✅ FULL" : inZone > 0n ? `🔄 ${inZone}/${pkg1}` : "⬜ empty";
    console.log(`  X${i + 1} (${i * 100}-${(i + 1) * 100 - 1}): ${status} → ${rule}`);
  }

  const te5 = await income.totalEarnings(5, 1);
  const esc5 = await income.escrowBalances(5, 1);
  const bucketRec5 = te5 > esc5 ? te5 - esc5 : 0n;
  const xSlot5 = bucketRec5 / pkg1;

  console.log("\n=== User#5 Bucket 1 Analysis ===");
  console.log("totalEarnings[5][1]  :", te5.toString());
  console.log("escrowBalances[5][1] :", esc5.toString());
  console.log("bucketReceived       :", bucketRec5.toString());
  console.log("xSlot (bucket-based) :", xSlot5.toString());
  console.log(
    "next income zone     :",
    xSlot5 === 0n
      ? "→ WALLET"
      : xSlot5 === 1n || xSlot5 === 2n
        ? "→ ESCROW"
        : xSlot5 === 3n
          ? "→ WALLET"
          : xSlot5 >= 4n
            ? "→ REBIRTH 🎯 ✅"
            : "→ WALLET"
  );
}

main().catch(console.error);
