import { ethers } from "hardhat";

async function main() {
  const CORE = "0xbBD9e768298E7b636A7a762478F19671954FF0C0";
  const INCOME = "0x7307Fee5C8163a1eb9a5F050D26AAe6e09a44769";
  const UPGRADE = "0x200301d8AdBF3C1AF85b35bf081A4A01eFE30322";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);

  const pkg1 = await core.getPackagePriceByLevel(1);

  for (const uid of [1, 3, 5]) {
    const te1 = await income.totalEarnings(uid, 1);
    const te2 = await income.totalEarnings(uid, 2);
    const esc1 = await income.escrowBalances(uid, 1);
    const reb = await income.rebirthEscrow(uid);
    const pkgLv = await (core as any).getUserPackageLevel(uid);
    const origLv = await (core as any).getUserOriginalPackageLevel(uid);
    const rebirthIds = await upgrade.getRebirthIds(uid);

    const xSlot = te1 / pkg1;

    console.log(`\n=== User#${uid} ===`);
    console.log("currentPkgLevel  :", pkgLv.toString());
    console.log("originalPkgLevel :", origLv.toString());
    console.log("totalEarnings[1] :", te1.toString(), "units");
    console.log("totalEarnings[2] :", te2.toString(), "units");
    console.log("escrowBal[1]     :", esc1.toString(), "units");
    console.log("rebirthEscrow    :", reb.toString(), "units");
    console.log("rebirthIds count :", rebirthIds.length);
    console.log("current xSlot    :", xSlot.toString());

    const xSlotMeaning =
      xSlot === 0n
        ? "→ wallet"
        : xSlot === 1n || xSlot === 2n
          ? "→ escrow (auto-upgrade)"
          : xSlot === 3n
            ? "→ wallet"
            : xSlot >= 4n
              ? "→ REBIRTH ESCROW 🎯"
              : "→ wallet";

    console.log("next income      :", xSlotMeaning);

    const eligible = origLv === 1n && rebirthIds.length === 0;
    console.log("rebirth eligible :", eligible ? "✅ YES" : "❌ NO");

    const progress = (te1 * 100n) / (pkg1 * 5n);
    console.log("5X progress      :", progress.toString() + "%");

    console.log("--- Journey ---");
    for (let i = 0; i < 5; i++) {
      const start = BigInt(i) * pkg1;
      const end = BigInt(i + 1) * pkg1;
      const recv = te1 >= end ? pkg1 : te1 > start ? te1 - start : 0n;
      const rule = i === 0 || i === 3 ? "wallet" : i === 1 || i === 2 ? "escrow" : "REBIRTH";
      const done = recv === pkg1 ? "✅" : recv > 0n ? "🔄" : "⬜";
      console.log(`  xSlot ${i} (${i * 100}-${(i + 1) * 100 - 1}): ${recv}/${pkg1} units → ${rule} ${done}`);
    }
  }
}

main().catch(console.error);
