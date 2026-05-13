import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = hre as any;
  const [owner] = await ethers.getSigners();

  const incomeRouterAddress = process.env.INCOME_ROUTER_ADDRESS || process.env.INCOME_ROUTER_PROXY;
  const usdtAddress = process.env.USDT_ADDRESS;
  const creatorWallet = process.env.CREATOR_WALLET;

  if (!incomeRouterAddress || !usdtAddress || !creatorWallet) {
    throw new Error("Required env values are missing. Check INCOME_ROUTER_ADDRESS, USDT_ADDRESS, and CREATOR_WALLET.");
  }

  const incomeRouter = await ethers.getContractAt("IncomeRouter", incomeRouterAddress, owner);

  console.log("Running emergency sweep...");
  const tx = await incomeRouter.emergencySweep(usdtAddress, creatorWallet);
  await tx.wait();
  console.log("Emergency sweep complete");
  console.log("TX:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
