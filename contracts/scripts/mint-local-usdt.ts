import { ethers } from "hardhat";

async function main() {
  const wallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const usdtAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const amount = 10000n * 10n ** 18n;

  const usdt = await ethers.getContractAt("MockUSDT", usdtAddress);
  await (await usdt.mint(wallet, amount)).wait();

  const balance = await usdt.balanceOf(wallet);
  console.log(`Minted to ${wallet}`);
  console.log(`USDT: ${usdtAddress}`);
  console.log(`Balance: ${balance.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
