import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const router = await ethers.getContractAt("IncomeRouter", "0xe59Ad238162D9591BCC7659A10fe017004a4cA69");
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x72433Cd3d2e41ed2B230510496835803aD245a48");
  
  try { console.log("Core paused:", await (core as any).paused()); } catch { console.log("Core: no paused"); }
  try { console.log("Router paused:", await (router as any).paused()); } catch { console.log("Router: no paused"); }
  try { console.log("Income paused:", await (income as any).paused()); } catch { console.log("Income: no paused"); }
  
  // Check core balance vs settlement needed
  const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", "0xF4975eB104932bDBcA491A9Cb985439eA03863e0");
  const coreBal = await usdt.balanceOf("0x19F72c5a287334086fD34D41ebe6bb534524D202");
  console.log("Core USDT balance:", ethers.formatUnits(coreBal, 18));
  
  const unitPrice = await core.paymentAssetUnitPrice("0xF4975eB104932bDBcA491A9Cb985439eA03863e0");
  console.log("USDT unitPrice:", unitPrice.toString());
  
  const pkg1Price = await core.getPackagePriceByLevel(1);
  console.log("Pkg1 price (platform):", pkg1Price.toString());
  const settlement = BigInt(pkg1Price.toString()) * BigInt(unitPrice.toString()) / BigInt("1000000000000000000");
  console.log("Settlement needed:", ethers.formatUnits(settlement, 18), "USDT");
}
main().catch(console.error);
