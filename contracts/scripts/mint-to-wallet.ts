import { ethers } from "hardhat";

async function main() {
  const USDT_ADDRESS = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const RECIPIENT = "0x768ABB0cb74DFE05e8B81919595D9366370053a0";
  const AMOUNT = ethers.parseUnits("1000", 18);

  const usdt = await ethers.getContractAt("MockUSDT", USDT_ADDRESS);
  await usdt.mint(RECIPIENT, AMOUNT);

  console.log(`Minted 1000 USDT to: ${RECIPIENT} ✅`);
}

main().catch(console.error);
