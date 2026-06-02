import { ethers } from "hardhat";
async function main() {
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5");
  const user3wallet = "0x8512e9f3a5e8a5a9b9c9b9c9b9c9b9c9b9c9b9c9";
  
  // Check User 3 inner balance
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const user3 = await core.usersById(3);
  console.log("User 3 wallet:", user3.account);
  
  // Check pending withdrawable balance
  const bal = await income.getWithdrawableBalance(3);
  console.log("User 3 withdrawable:", ethers.formatEther(bal));
  
  // Core balance
  const usdt = await ethers.getContractAt("MockUSDT", "0xF4975eB104932bDBcA491A9Cb985439eA03863e0");
  const coreBal = await usdt.balanceOf(await core.getAddress());
  console.log("Core USDT balance:", ethers.formatUnits(coreBal, 18));
}
main().catch(console.error);
