import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const INCOME = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";
  const UPGRADE = "0xf46b34911ad4d10660ce407e5516EEF5b493aF17";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const upgrade = await ethers.getContractAt("MetaGuildXUpgrade", UPGRADE);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const pkgLv = await (core as any).getUserPackageLevel(3);
  const origLv = await (core as any).getUserOriginalPackageLevel(3);
  const manUpg = await (core as any).manuallyUpgraded(3);
  const rebirthIds = await upgrade.getRebirthIds(3);

  console.log("=== User#3 System Summary ===");
  console.log("currentPackage   :", pkgLv.toString());
  console.log("originalPackage  :", origLv.toString());
  console.log("manuallyUpgraded :", manUpg);
  console.log("rebirthIds       :", rebirthIds.length);

  console.log("\n=== Bucket Summary ===");
  for (let pkg = 1; pkg <= 3; pkg++) {
    const pkgPrice = await core.getPackagePriceByLevel(pkg);
    const te = await income.totalEarnings(3, pkg);
    const esc = await income.escrowBalances(3, pkg);
    const wallet = te > esc ? te - esc : 0n;
    const xSlot = wallet / pkgPrice;
    const upgradeNeed = pkgPrice * 2n;
    const escrowProgress = upgradeNeed > 0n ? (esc * 100n) / upgradeNeed : 0n;

    console.log(`\nBucket ${pkg} (1 unit = ${pkgPrice} units):`);
    console.log(
      `  Wallet income  : ${wallet} units (${ethers.formatUnits(wallet * 100000000000000000n, 18)} USDT)`
    );
    console.log(
      `  Escrow frozen  : ${esc} units (${ethers.formatUnits(esc * 100000000000000000n, 18)} USDT)`
    );
    console.log(`  xSlot now      : ${xSlot}`);
    console.log(`  Upgrade need   : ${upgradeNeed} units escrow`);
    console.log(`  Escrow progress: ${escrowProgress}%`);
    console.log(`  Need more      : ${esc >= upgradeNeed ? 0n : upgradeNeed - esc} units to trigger upgrade`);
    console.log(
      "  Next income    :",
      xSlot === 0n || xSlot === 3n
        ? "→ WALLET"
        : xSlot === 1n || xSlot === 2n
          ? "→ ESCROW"
          : xSlot >= 4n
            ? "→ REBIRTH 🎯"
            : "→ WALLET"
    );
  }

  const u3 = await (core as any).usersById(3);
  const walletAddress = u3.account ?? u3[1];
  const walletBal = await usdt.balanceOf(walletAddress);
  console.log("\n=== Wallet USDT ===");
  console.log("User#3 wallet USDT:", ethers.formatUnits(walletBal, 18));
}

main().catch(console.error);
