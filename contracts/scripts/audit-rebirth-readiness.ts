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
    const we1 = await income.walletEarnings(uid, 1);
    const te1 = await income.totalEarnings(uid, 1);
    const esc1 = await income.escrowBalances(uid, 1);
    const reb = await income.rebirthEscrow(uid);
    const pkgLv = await (core as any).getUserPackageLevel(uid);
    const origLv = await (core as any).getUserOriginalPackageLevel(uid);
    const rebirthIds = await upgrade.getRebirthIds(uid);
    const inProgress = await upgrade.rebirthInProgress(uid);

    const xSlot = we1 / pkg1;

    const zone3end = pkg1 * 4n;
    const zone4end = pkg1 * 5n;
    const rebirthZoneStart = zone3end;
    const unitsToRebirth = we1 >= rebirthZoneStart ? 0n : rebirthZoneStart - we1;

    console.log(`\n=== User#${uid} ===`);
    console.log("currentPkgLevel  :", pkgLv.toString());
    console.log("originalPkgLevel :", origLv.toString());
    console.log("walletEarnings[1]:", we1.toString(), "units");
    console.log("totalEarnings[1] :", te1.toString(), "units");
    console.log("escrowBal[1]     :", esc1.toString(), "units");
    console.log("rebirthEscrow    :", reb.toString(), "units");
    console.log("current xSlot    :", xSlot.toString());
    console.log("rebirthIds       :", rebirthIds.length, "(must be 0 for rebirth)");
    console.log("rebirthInProgress:", inProgress);

    const eligible = origLv === 1n && rebirthIds.length === 0 && !inProgress;
    console.log("rebirth eligible :", eligible ? "✅ YES" : "❌ NO");

    const progress = (we1 * 100n) / zone4end;
    console.log("rebirth progress :", progress.toString() + "%");
    console.log(
      "units to xSlot4  :",
      unitsToRebirth.toString(),
      unitsToRebirth === 0n ? "✅ REACHED" : "units remaining"
    );

    console.log(
      "next income xSlot:",
      xSlot.toString(),
      xSlot === 0n
        ? "→ wallet"
        : xSlot === 1n || xSlot === 2n
          ? "→ escrow"
          : xSlot === 3n
            ? "→ wallet"
            : xSlot === 4n
              ? "→ REBIRTH ESCROW 🎯"
              : "→ wallet"
    );
  }
}

main().catch(console.error);
