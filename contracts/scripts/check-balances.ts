import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const USDT    = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const CORE    = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const ROUTER  = "0xe59Ad238162D9591BCC7659A10fe017004a4cA69";
  const INCOME  = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
  const UPGRADE = "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50";

  const usdt = await ethers.getContractAt("MockUSDT", USDT);

  const coreBal    = await usdt.balanceOf(CORE);
  const routerBal  = await usdt.balanceOf(ROUTER);
  const incomeBal  = await usdt.balanceOf(INCOME);
  const upgradeBal = await usdt.balanceOf(UPGRADE);

  const fmt = (b: bigint) => ethers.formatUnits(b, 18);

  console.log("Core USDT:    ", fmt(coreBal));
  console.log("Router USDT:  ", fmt(routerBal));
  console.log("Income USDT:  ", fmt(incomeBal));
  console.log("Upgrade USDT: ", fmt(upgradeBal));
  console.log("\nTotal:        ", fmt(coreBal + routerBal + incomeBal + upgradeBal));
}

main().catch((e) => { console.error(e); process.exit(1); });
