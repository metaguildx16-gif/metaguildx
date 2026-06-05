import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore",
    "0x19F72c5a287334086fD34D41ebe6bb534524D202");

  const productionMode = await core.productionMode();
  const defaultAsset   = await core.defaultPaymentAsset();
  const usdtAddress    = await core.usdtAddress();

  console.log("productionMode:", productionMode);
  console.log("defaultPaymentAsset:", defaultAsset);
  console.log("usdtAddress:", usdtAddress);

  // Core USDT balance
  const usdt = await ethers.getContractAt("MockUSDT", defaultAsset);
  const coreBal = await usdt.balanceOf(
    "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  console.log("Core USDT balance:", ethers.formatUnits(coreBal, 18));

  // Router USDT balance
  const routerBal = await usdt.balanceOf(
    "0xe59Ad238162D9591BCC7659A10fe017004a4cA69");
  console.log("Router USDT balance:", ethers.formatUnits(routerBal, 18));
}

main().catch((e) => { console.error(e); process.exit(1); });
