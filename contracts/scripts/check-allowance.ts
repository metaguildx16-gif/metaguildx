import { ethers } from "hardhat";

async function main() {
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER = "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E";

  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);

  const balance = await usdt.balanceOf(USER);
  const allowance = await usdt.allowance(USER, ROUTER);
  const decimals = await usdt.decimals();

  console.log("Decimals  :", decimals.toString());
  console.log("Balance   :", ethers.formatUnits(balance, decimals), "USDT");
  console.log("Allowance :", ethers.formatUnits(allowance, decimals), "USDT");
  console.log("Need      : 20 USDT for Package 1→2 upgrade");
}

main().catch(console.error);
