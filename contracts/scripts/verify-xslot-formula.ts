import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  const pkg1 = await core.getPackagePriceByLevel(1);

  for (const uid of [1, 3]) {
    const te = await income.totalEarnings(uid, 1);
    const esc = await income.escrowBalances(uid, 1);
    const bucketReceived = te > esc ? te - esc : 0n;
    const xSlot = bucketReceived / pkg1;

    console.log(`User#${uid}:`);
    console.log(`  totalEarnings  : ${te}`);
    console.log(`  escrowBalances : ${esc}`);
    console.log(`  bucketReceived : ${bucketReceived}`);
    console.log(`  xSlot          : ${xSlot}`);
    console.log(
      `  next income    :`,
      xSlot === 0n || xSlot === 3n
        ? "→ WALLET ✅"
        : xSlot === 1n || xSlot === 2n
          ? "→ ESCROW"
          : xSlot >= 4n
            ? "→ REBIRTH 🎯"
            : "→ WALLET"
    );
    console.log();
  }
}

main().catch(console.error);
