import { ethers } from "hardhat";

async function main() {
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const ROUTER = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";

  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);
  const decimals = await usdt.decimals();
  const balance = await usdt.balanceOf(USER2);
  const allowance = await usdt.allowance(USER2, ROUTER);

  console.log("User2 USDT Balance  :", ethers.formatUnits(balance, decimals));
  console.log("User2 USDT Allowance:", ethers.formatUnits(allowance, decimals));
  console.log("Need                : 10 USDT for Package 1 registration");
}

main().catch(console.error);
