import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE_ADDRESS   = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const ROUTER_ADDRESS = "0xe59Ad238162D9591BCC7659A10fe017004a4cA69";

  const core   = await ethers.getContractAt("MetaGuildXCore", CORE_ADDRESS);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER_ADDRESS);

  // Check userId 28 state
  const profile = await core.usersById(28);
  console.log("userId 28 profile:");
  console.log("  sponsorId:", profile.sponsorId.toString());
  console.log("  packageLevel:", profile.packageLevel.toString());
  console.log("  account:", profile.account);

  const paymentAsset = await core.userPrimaryAsset(28);
  console.log("  userPrimaryAsset:", paymentAsset);

  const productionMode = await core.productionMode();
  console.log("  productionMode:", productionMode);

  // Check Router state
  const paused = await router.paused();
  console.log("\nRouter paused:", paused);

  // Check BinaryTree parent of userId 28
  const parent = await core.getParent(28);
  console.log("BinaryTree parent of 28:", parent.toString());

  // Try static call to simulate distributeJoinIncome
  const packagePrices = await core.getPackagePrices();
  console.log("packagePrices:", packagePrices.map((p: bigint) => p.toString()));

  // Simulate call
  console.log("\nSimulating distributeJoinIncome...");
  try {
    await router.distributeJoinIncome.staticCall(
      28,
      profile.sponsorId,
      parent,
      packagePrices[0],
      ethers.ZeroAddress,
      0
    );
    console.log("Static call SUCCESS!");
  } catch (e: any) {
    console.log("Static call FAILED:", e.message);
    if (e.data) console.log("Error data:", e.data);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
