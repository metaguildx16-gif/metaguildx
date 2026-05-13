import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers } = hre as any;
  const provider = ethers.provider;

  const usdtAddress = process.env.USDT_ADDRESS;
  const incomeRouterAddress = process.env.INCOME_ROUTER_ADDRESS || process.env.INCOME_ROUTER_PROXY;
  const cashbackPoolAddress = process.env.CASHBACK_POOL_ADDRESS;
  const systemAddress = process.env.SYSTEM_PROXY_ADDRESS || process.env.SYSTEM_PROXY;
  const creatorWallet = process.env.CREATOR_WALLET;

  if (!usdtAddress || !incomeRouterAddress || !cashbackPoolAddress || !systemAddress || !creatorWallet) {
    throw new Error("Required env values are missing. Check USDT_ADDRESS, INCOME_ROUTER_ADDRESS, CASHBACK_POOL_ADDRESS, SYSTEM_PROXY_ADDRESS, and CREATOR_WALLET.");
  }

  const usdt = new ethers.Contract(
    usdtAddress,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );

  const [routerBal, cashbackBal, systemBal, creatorBal] = await Promise.all([
    usdt.balanceOf(incomeRouterAddress),
    usdt.balanceOf(cashbackPoolAddress),
    usdt.balanceOf(systemAddress),
    usdt.balanceOf(creatorWallet)
  ]);

  const fmt = (value: bigint) => ethers.formatUnits(value, 18);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("PRE-REGISTRATION STATE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("IncomeRouter USDT  :", fmt(routerBal));
  console.log("CashbackPool USDT  :", fmt(cashbackBal));
  console.log("System USDT        :", fmt(systemBal));
  console.log("Creator USDT       :", fmt(creatorBal));
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("EXPECTED after User2 registers:");
  console.log("IncomeRouter USDT  : 0.0 (must be zero)");
  console.log("Creator USDT gain  : +5.00 USDT");
  console.log("User1 wallet gain  : +5.00 USDT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (routerBal > 0n) {
    console.log("WARNING: Router has stuck funds!");
    console.log("Run emergency-recover.ts before proceeding");
  } else {
    console.log("Router is clean - safe to register");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
