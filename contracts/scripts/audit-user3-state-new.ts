import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";
  const UPGRADE = "0xf46b34911ad4d10660ce407e5516EEF5b493aF17";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);

  const pkg1 = await core.getPackagePriceByLevel(1);

  for (const uid of [1, 3]) {
    const te1 = await income.totalEarnings(uid, 1);
    const esc1 = await income.escrowBalances(uid, 1);
    const pkgLv = await (core as any).getUserPackageLevel(uid);
    const origLv = await (core as any).getUserOriginalPackageLevel(uid);
    const manUpg = await (core as any).manuallyUpgraded(uid);
    const xSlot = te1 / pkg1;

    console.log(`\n=== User#${uid} ===`);
    console.log("currentPkgLevel  :", pkgLv.toString());
    console.log("originalPkgLevel :", origLv.toString());
    console.log("manuallyUpgraded :", manUpg);
    console.log("totalEarnings[1] :", te1.toString(), "units");
    console.log("escrowBal[1]     :", esc1.toString(), "units");
    console.log("xSlot            :", xSlot.toString());
    console.log(
      "next income      :",
      xSlot === 0n || xSlot === 3n
        ? "→ wallet"
        : xSlot === 1n || xSlot === 2n
          ? "→ escrow"
          : xSlot >= 4n
            ? "→ rebirth"
            : "→ wallet"
    );

    if (xSlot === 1n || xSlot === 2n) {
      console.log("\n--- xSlot 1,2 condition ---");
      console.log("currentPkg > pkgLevel(1):", Number(pkgLv) > 1);
      console.log("manuallyUpgraded        :", manUpg);
      console.log("→ wallet?               :", Number(pkgLv) > 1 && manUpg);
      console.log("→ escrow?               :", !(Number(pkgLv) > 1 && manUpg));
    }
  }

  const filter = core.filters.UserRegistered(5);
  const events = await core.queryFilter(filter, -100000);
  if (events.length > 0) {
    const receipt = await ethers.provider.getTransactionReceipt(
      events[0].transactionHash
    );
    console.log("\n=== User#5 Registration Events (User#3 income) ===");
    const incomeIface = income.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = incomeIface.parseLog(log);
        if (
          parsed &&
          (parsed.args[0]?.toString() === "3" ||
            parsed.args[0]?.toString() === "1")
        ) {
          console.log(
            `[INCOME] ${parsed.name}:`,
            `userId=${parsed.args[0]}, amount=${parsed.args[1]}, xSlot=${parsed.args[2]}`
          );
        }
      } catch {}
    }
  }

  void upgrade;
}

main().catch(console.error);
