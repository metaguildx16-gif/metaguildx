import { ethers } from "hardhat";

async function main() {
  const CORE = "0xbBD9e768298E7b636A7a762478F19671954FF0C0";
  const INCOME = "0x7307Fee5C8163a1eb9a5F050D26AAe6e09a44769";
  const UPGRADE = "0x200301d8AdBF3C1AF85b35bf081A4A01eFE30322";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);

  const pkg1 = await core.getPackagePriceByLevel(1);
  const pkg2 = await core.getPackagePriceByLevel(2);

  const we1 = await income.walletEarnings(5, 1);
  const we2 = await income.walletEarnings(5, 2);
  const te1 = await income.totalEarnings(5, 1);
  const te2 = await income.totalEarnings(5, 2);
  const esc1 = await income.escrowBalances(5, 1);
  const esc2 = await income.escrowBalances(5, 2);
  const reb = await income.rebirthEscrow(5);

  const pkgLv = await (core as any).getUserPackageLevel(5);
  const origLv = await (core as any).getUserOriginalPackageLevel(5);
  const rebirthIds = await upgrade.getRebirthIds(5);

  console.log("=== User#5 Full State ===");
  console.log("currentPkgLevel  :", pkgLv.toString());
  console.log("originalPkgLevel :", origLv.toString());
  console.log("rebirthIds count :", rebirthIds.length);

  console.log("\n--- Bucket 1 (pkg1=100 units) ---");
  console.log("walletEarnings[1]:", we1.toString());
  console.log("totalEarnings[1] :", te1.toString());
  console.log("escrowBal[1]     :", esc1.toString());
  console.log("xSlot pkg1       :", (we1 / pkg1).toString());

  console.log("\n--- Bucket 2 (pkg2=200 units) ---");
  console.log("walletEarnings[2]:", we2.toString());
  console.log("totalEarnings[2] :", te2.toString());
  console.log("escrowBal[2]     :", esc2.toString());
  console.log("xSlot pkg2       :", (we2 / pkg2).toString());

  console.log("\n--- Rebirth ---");
  console.log("rebirthEscrow    :", reb.toString());

  console.log("\n--- 5X Cycle Analysis (Bucket 1) ---");
  console.log("pkg1 total income:", te1.toString(), "units");
  console.log("5X target        : 500 units");
  console.log("Completed        :", te1.toString(), "/ 500 =", (Number(te1) / 500 * 100).toFixed(0) + "%");

  console.log("\n--- xSlot Journey ---");
  const slots = [
    "xSlot 0 (0-99)  ",
    "xSlot 1 (100-199)",
    "xSlot 2 (200-299)",
    "xSlot 3 (300-399)",
    "xSlot 4 (400-499)"
  ];
  const rules = [
    "→ wallet",
    "→ escrow (auto-upgrade)",
    "→ escrow (auto-upgrade)",
    "→ wallet",
    "→ REBIRTH"
  ];

  for (let i = 0; i < 5; i++) {
    const start = BigInt(i) * pkg1;
    const end = BigInt(i + 1) * pkg1;
    const received = te1 >= end ? pkg1 : te1 > start ? te1 - start : 0n;
    console.log(`${slots[i]}: ${received} units ${rules[i]}`);
  }

  console.log("\n--- Next Income Prediction ---");
  const xSlotNow = we1 / pkg1;
  console.log("Current xSlot    :", xSlotNow.toString());
  console.log(
    "Next income goes :",
    xSlotNow === 0n || xSlotNow === 3n
      ? "→ WALLET"
      : xSlotNow === 1n || xSlotNow === 2n
        ? "→ ESCROW (auto-upgrade)"
        : xSlotNow >= 4n
          ? "→ REBIRTH ESCROW 🎯"
          : "→ WALLET"
  );
}

main().catch(console.error);
