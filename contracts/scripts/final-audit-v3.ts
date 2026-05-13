import { ethers } from "hardhat";

async function main() {
  const CORE = "0x0Ae6275740A14AD04B360940425cfb8Ff412C290";
  const INCOME = "0xE592477Dc37C04E29c66b5C549B11E6d6327f4dF";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const nextId = await core.nextUserId();
  const failed = await core.getFailedUserIds();
  const coreBal = await usdt.balanceOf(CORE);
  const unitPrice = await (core as any).paymentAssetUnitPrice(USDT);
  const pkg1 = await core.getPackagePriceByLevel(1);

  const te1 = await income.totalEarnings(1, 1);
  const esc1 = await income.escrowBalances(1, 1);
  const bucketRec = te1 > esc1 ? te1 - esc1 : 0n;
  const xSlot = bucketRec / pkg1;

  console.log("=== SYSTEM STATE ===");
  console.log("nextUserId  :", nextId.toString());
  console.log("failedIds   :", failed.toString() || "none ✅");
  console.log("Core USDT   :", ethers.formatUnits(coreBal, 18));
  console.log("unitPrice   :", unitPrice === 100000000000000000n ? "✅ 1e17" : "❌");

  console.log("\n=== USER#1 BUCKET 1 ===");
  console.log("totalEarnings  :", te1.toString());
  console.log("escrowBalances :", esc1.toString());
  console.log("bucketReceived :", bucketRec.toString());
  console.log("xSlot          :", xSlot.toString());
  console.log(
    "next income    :",
    xSlot === 0n || xSlot === 3n
      ? "→ WALLET"
      : xSlot === 1n || xSlot === 2n
        ? "→ ESCROW"
        : xSlot >= 4n
          ? "→ REBIRTH"
          : "→ WALLET"
  );

  const manUpg = await (core as any).manuallyUpgraded(1);
  console.log("manuallyUpgraded[1]:", manUpg);
}

main().catch(console.error);
