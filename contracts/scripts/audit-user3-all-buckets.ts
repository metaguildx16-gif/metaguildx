import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  console.log("=== User#3 — Income Per Bucket ===\n");

  for (let pkg = 1; pkg <= 5; pkg++) {
    const pkgPrice = await core.getPackagePriceByLevel(pkg);
    const te = await income.totalEarnings(3, pkg);
    const esc = await income.escrowBalances(3, pkg);
    const bucketReceived = te > esc ? te - esc : 0n;
    const xSlot = pkgPrice > 0n ? bucketReceived / pkgPrice : 0n;

    if (te === 0n && esc === 0n) continue;

    console.log(`Bucket ${pkg} (pkg${pkg}, price=${pkgPrice} units):`);
    console.log(`  totalEarnings    : ${te} units`);
    console.log(`  escrowBalances   : ${esc} units`);
    console.log(`  bucketReceived   : ${bucketReceived} units`);
    console.log(`  xSlot            : ${xSlot}`);
    console.log(`  next income zone : ${
      xSlot === 0n
        ? "→ WALLET"
        : xSlot === 1n || xSlot === 2n
          ? "→ ESCROW"
          : xSlot === 3n
            ? "→ WALLET"
            : xSlot >= 4n
              ? "→ REBIRTH"
              : "→ WALLET"
    }`);
    console.log();
  }
}

main().catch(console.error);
