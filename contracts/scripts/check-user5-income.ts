import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const INCOME = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  const pkg1 = await core.getPackagePriceByLevel(1);

  for (const uid of [5]) {
    const we1 = await income.walletEarnings(uid, 1);
    const we2 = await income.walletEarnings(uid, 2);
    const te1 = await income.totalEarnings(uid, 1);
    const te2 = await income.totalEarnings(uid, 2);
    const esc1 = await income.escrowBalances(uid, 1);
    const esc2 = await income.escrowBalances(uid, 2);
    const reb = await income.rebirthEscrow(uid);
    const pkgLevel = await (core as any).getUserPackageLevel(uid);
    const pkgLevelPrice = await core.getPackagePriceByLevel(pkgLevel);

    console.log(`\n=== User#${uid} ===`);
    console.log("walletEarnings[1]:", we1.toString());
    console.log("walletEarnings[2]:", we2.toString());
    console.log("totalEarnings[1] :", te1.toString());
    console.log("totalEarnings[2] :", te2.toString());
    console.log("escrowBal[1]     :", esc1.toString());
    console.log("escrowBal[2]     :", esc2.toString());
    console.log("rebirthEscrow    :", reb.toString());
    console.log("currentPkgLevel   :", pkgLevel.toString());
    console.log("currentPkgPrice   :", pkgLevelPrice.toString());
    console.log("xSlot pkg1       :", (we1 / pkg1).toString());
  }
}

main().catch(console.error);
