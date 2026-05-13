import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  const pkg1Price = await core.getPackagePriceByLevel(1);

  for (const uid of [1, 3, 5]) {
    const we1 = await income.walletEarnings(uid, 1);
    const te1 = await income.totalEarnings(uid, 1);
    const esc1 = await income.escrowBalances(uid, 1);
    const reb = await income.rebirthEscrow(uid);
    const pkgLv = await (core as any).getUserPackageLevel(uid);
    const origLv = await (core as any).getUserOriginalPackageLevel(uid);

    const xSlot = we1 / pkg1Price;

    console.log(`\n=== User#${uid} ===`);
    console.log("currentPkgLevel  :", pkgLv.toString());
    console.log("originalPkgLevel :", origLv.toString());
    console.log("walletEarnings[1]:", we1.toString(), "units");
    console.log("totalEarnings[1] :", te1.toString(), "units");
    console.log("escrowBal[1]     :", esc1.toString(), "units");
    console.log("rebirthEscrow    :", reb.toString(), "units");
    console.log("current xSlot    :", xSlot.toString());

    const total = te1;
    const fullCycles = total / pkg1Price;
    let expectedWallet = 0n;
    let expectedEscrow = 0n;
    let expectedRebirth = 0n;

    for (let slot = 0n; slot < fullCycles; slot++) {
      if (slot === 0n || slot === 3n) expectedWallet += pkg1Price;
      else if (slot === 1n || slot === 2n) expectedEscrow += pkg1Price;
      else if (slot === 4n) expectedRebirth += pkg1Price;
      else expectedWallet += pkg1Price;
    }

    const partial = total % pkg1Price;
    const partialSlot = fullCycles;
    if (partial > 0n) {
      if (partialSlot === 0n || partialSlot === 3n) expectedWallet += partial;
      else if (partialSlot === 1n || partialSlot === 2n) expectedEscrow += partial;
      else if (partialSlot === 4n) expectedRebirth += partial;
      else expectedWallet += partial;
    }

    console.log("\n--- Expected vs Actual ---");
    console.log("Expected wallet  :", expectedWallet.toString(), "units");
    console.log("Actual wallet    :", we1.toString(), "units");
    console.log(
      "Wallet diff      :",
      (we1 - expectedWallet).toString(),
      we1 > expectedWallet ? "← OVERCOUNTED ❌" : we1 < expectedWallet ? "← UNDERCOUNTED ❌" : "✅ CORRECT"
    );
    console.log("Expected rebirth :", expectedRebirth.toString(), "units");
    console.log("Actual rebirth   :", reb.toString(), "units");
    console.log(
      "Rebirth diff     :",
      (reb - expectedRebirth).toString(),
      reb < expectedRebirth ? "← MISSING ❌" : "✅"
    );
  }

  console.log("\n=== CHECK: releaseEscrow updates walletEarnings? ===");
  console.log("Search MetaGuildXIncome.sol for releaseEscrow()");
  console.log("Paste exact function below:");
}

main().catch(console.error);
