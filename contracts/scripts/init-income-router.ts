import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = hre as any;
  const incomeRouterProxy = process.env.INCOME_ROUTER_PROXY;
  const creatorWallet = process.env.CREATOR_WALLET;
  const usdtAddress = process.env.USDT_ADDRESS;

  if (!incomeRouterProxy) {
    throw new Error("INCOME_ROUTER_PROXY not set in .env");
  }

  if (!creatorWallet) {
    throw new Error("CREATOR_WALLET not set in .env");
  }

  if (!usdtAddress) {
    throw new Error("USDT_ADDRESS not set in .env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Signer:", deployer.address);

  const router = await ethers.getContractAt("IncomeRouter", incomeRouterProxy, deployer);
  const owner = (await router.owner()) as string;
  console.log("IncomeRouter owner  :", owner);
  console.log("Script signer       :", deployer.address);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: Signer is not owner - cannot call setCreatorWallet");
    console.error("Use the wallet that deployed IncomeRouter proxy");
    process.exit(1);
  }

  console.log("Setting creator wallet...");
  const tx1 = await router.setCreatorWallet(creatorWallet);
  await tx1.wait();
  console.log("creatorWallet set to:", creatorWallet);

  const stored = (await router.creatorWallet()) as string;
  console.log("Verified on-chain creatorWallet:", stored);

  const usdt = await ethers.getContractAt("IERC20", usdtAddress, deployer);
  const trapped = (await usdt.balanceOf(incomeRouterProxy)) as bigint;
  console.log("Trapped USDT in IncomeRouter:", ethers.formatUnits(trapped, 18));

  if (trapped === 0n) {
    console.log("No trapped funds - skipping recovery.");
  } else {
    console.log("Recovering trapped funds to creator wallet...");
    const tx2 = await router.recoverUnallocatedFunds(usdtAddress);
    await tx2.wait();

    const afterBalance = (await usdt.balanceOf(incomeRouterProxy)) as bigint;
    console.log("IncomeRouter balance after recovery:", ethers.formatUnits(afterBalance, 18));
    console.log("Recovery complete");
  }

  const creatorBalance = (await usdt.balanceOf(creatorWallet)) as bigint;
  const routerBalance = (await usdt.balanceOf(incomeRouterProxy)) as bigint;
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("INIT COMPLETE");
  console.log("creatorWallet    :", creatorWallet);
  console.log("Creator USDT bal :", ethers.formatUnits(creatorBalance, 18));
  console.log("Router USDT bal  :", ethers.formatUnits(routerBalance, 18));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
