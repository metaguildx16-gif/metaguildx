import { ethers } from "hardhat";
async function main() {
  const usdt = await ethers.getContractAt("MGXToken", "0xF4975eB104932bDBcA491A9Cb985439eA03863e0");
  const dec = await usdt.decimals();
  console.log("USDT decimals:", dec.toString());
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const eb = await income.escrowBalances(3, 1);
  const te1 = await income.totalEarnings(3, 1);
  const te2 = await income.totalEarnings(3, 2);
  console.log("escrowBalances[3][1] raw:", eb.toString());
  console.log("totalEarnings[3][1] raw:", te1.toString());
  console.log("totalEarnings[3][2] raw:", te2.toString());
  console.log("unitPrice raw:", (await (await ethers.getContractAt("MetaGuildXCore","0xF28019a3cC992619b652967B96B3813bA3830D91")).paymentAssetUnitPrice("0xF4975eB104932bDBcA491A9Cb985439eA03863e0")).toString());
}
main().catch(console.error);
