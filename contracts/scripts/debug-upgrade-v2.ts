import { ethers } from "hardhat";

async function main() {
const CORE = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
const INCOME = "0x2A55927a1f521572096A4983767F126626D8ac21";
  const USER1 = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  const pkg = await core.getUserPackageLevel(1);
  const escrow = await income.getEscrow(1);
  console.log("User1 package:", pkg.toString());
  console.log("User1 escrow:", escrow.toString());

  const usdtAddr = await core.defaultPaymentAsset();
  const usdt = await ethers.getContractAt(
    ["function balanceOf(address) view returns(uint256)",
     "function allowance(address,address) view returns(uint256)",
     "function decimals() view returns(uint8)"],
    usdtAddr
  );
  const dec = await usdt.decimals();
  const bal = await usdt.balanceOf(USER1);
  const allow = await usdt.allowance(USER1, CORE);
  console.log("USDT decimals:", dec.toString());
  console.log("User1 balance:", ethers.formatUnits(bal, dec));
  console.log("User1 allowance:", ethers.formatUnits(allow, dec));

  const prices = await core.getPackagePrices();
  const pkg1Price = prices[0];
  const upgradeAmount = pkg1Price * 2n;
  const walletCharge = upgradeAmount > escrow
    ? upgradeAmount - escrow
    : 0n;
  console.log("pkg1 price raw:", pkg1Price.toString());
  console.log("upgradeAmount raw:", upgradeAmount.toString());
  console.log("escrow raw:", escrow.toString());
  console.log("walletCharge raw:", walletCharge.toString());
  console.log("walletCharge USDT:", ethers.formatUnits(walletCharge, dec));

  const incomeCore = await income.coreContract();
  console.log("Income.coreContract:", incomeCore);
  console.log("Core match:", incomeCore.toLowerCase() === CORE.toLowerCase());

  const prodMode = await core.productionMode();
  console.log("productionMode:", prodMode);

  try {
    const fn = income.interface.getFunction("resetIncomeByCore");
    console.log("resetIncomeByCore exists:", fn.name);
  } catch(e) {
    console.log("resetIncomeByCore NOT found!");
  }

  try {
    const fn = income.interface.getFunction("releaseEscrow");
    console.log("releaseEscrow exists:", fn.name);
  } catch(e) {
    console.log("releaseEscrow NOT found!");
  }

  // Simulate upgrade
  try {
    const signer = (await ethers.getSigners())[0];
    const coreWithSigner = core.connect(signer) as any;
    await coreWithSigner.upgradePackage.staticCall(1, 2);
    console.log("Static call: SUCCESS");
  } catch(e: any) {
    console.log("Static call REVERT:", e.message);
    if (e.data) console.log("Revert data:", e.data);
    if (e.reason) console.log("Revert reason:", e.reason);
  }
}

main().catch(console.error);
