import { ethers } from "hardhat";

async function main() {
  const MOCK_USDT = "0x9FD1B3670693bEDb515305F3e3c1Dbc0c342B502";
  const USER2 = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";

  const usdt = await ethers.getContractAt("MockUSDT", MOCK_USDT);
  const amount = ethers.parseUnits("1000", 18);

  const tx = await usdt.mint(USER2, amount);
  await tx.wait();

  const balance = await usdt.balanceOf(USER2);
  console.log("User2 balance after mint:", ethers.formatUnits(balance, 18), "USDT ✅");
}

main().catch(console.error);
