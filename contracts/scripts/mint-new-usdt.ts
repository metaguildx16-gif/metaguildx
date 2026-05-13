import { ethers } from "hardhat";

async function main() {
  const NEW_USDT = "0x4F493fA958BC923E6e1aF59F22B5A41406BB7719";
  const usdt = await ethers.getContractAt("MockUSDT", NEW_USDT);

  const wallets = [
    "0x8ABC4fF35207a7eA76743D29Ce7F3b3adda0538E",
    "0x768ABB0cb74DFE05e8B81919595D9366370053a0",
  ];

  for (const wallet of wallets) {
    const tx = await usdt.mint(wallet, ethers.parseUnits("1000", 18));
    await tx.wait();
    const bal = await usdt.balanceOf(wallet);
    console.log(`${wallet}: ${ethers.formatUnits(bal, 18)} USDT ✅`);
  }
}

main().catch(console.error);
