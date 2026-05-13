import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  console.log("Router:", ROUTER);

  const router = await ethers.getContractAt(
    [
      "function creatorWallet() view returns (address)",
      "function coreContract() view returns (address)",
      "function owner() view returns (address)",
      "function usdtAddress() view returns (address)",
    ],
    ROUTER
  );

  try {
    console.log("creatorWallet:", await router.creatorWallet());
  } catch (e) {
    const err = e as { message?: string };
    console.log("creatorWallet() FAILED:", err.message);
  }

  try {
    console.log("coreContract:", await router.coreContract());
  } catch (e) {
    const err = e as { message?: string };
    console.log("coreContract() FAILED:", err.message);
  }

  try {
    console.log("usdtAddress:", await router.usdtAddress());
  } catch (e) {
    const err = e as { message?: string };
    console.log("usdtAddress() FAILED:", err.message);
  }

  try {
    console.log("owner:", await router.owner());
  } catch (e) {
    const err = e as { message?: string };
    console.log("owner() FAILED:", err.message);
  }
}

main().catch(console.error);
