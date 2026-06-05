import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const CORE    = "0x19F72c5a287334086fD34D41ebe6bb534524D202";
  const INCOME  = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
  const ROUTER  = "0xe59Ad238162D9591BCC7659A10fe017004a4cA69";

  const core   = await ethers.getContractAt("MetaGuildXCore", CORE);
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME);

  // userId 28 state
  const profile    = await core.usersById(28);
  const parent     = await core.getParent(28);
  const pkgPrices  = await core.getPackagePrices();
  const pkgAmount  = pkgPrices[0];

  console.log("sponsorId:", profile.sponsorId.toString());
  console.log("parent:", parent.toString());
  console.log("pkgAmount:", pkgAmount.toString());
  console.log("productionMode:", await core.productionMode());

  // Check income state for userId 28
  const escrow = await income.getEscrow(28);
  console.log("userId 28 escrow:", escrow.toString());

  const totalEarnings = await income.totalEarnings(28, 1);
  console.log("userId 28 totalEarnings[1]:", totalEarnings.toString());

  // Check sponsor (userId 3) state
  const escrow3 = await income.getEscrow(3);
  console.log("userId 3 escrow:", escrow3.toString());

  const totalEarnings3 = await income.totalEarnings(3, 1);
  console.log("userId 3 totalEarnings[1]:", totalEarnings3.toString());

  // Check Router onlyCore — who is core in Router?
  const router = await ethers.getContractAt("IncomeRouter", ROUTER);
  const routerCore = await router.coreContract();
  console.log("\nRouter coreContract:", routerCore);
  console.log("Core address:      ", CORE);
  console.log("Match:", routerCore.toLowerCase() === CORE.toLowerCase());
}

main().catch((e) => { console.error(e); process.exit(1); });
