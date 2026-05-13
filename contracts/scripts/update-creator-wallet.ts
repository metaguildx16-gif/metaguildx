import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
const CORE_PROXY = "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec";
const ROUTER_PROXY = "0x79870332B3959a3e3A2A1D01c4cE497809Bf7B35";
  const NEW_CREATOR_WALLET = "0xbFF19De173697D07B904a4c7b79e4A524B456991";

  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY);
  const router = await ethers.getContractAt("IncomeRouter", ROUTER_PROXY);

  console.log("Updating creator wallet...");
  console.log("Signer:", deployer.address);
  console.log("Core  :", CORE_PROXY);
  console.log("Router:", ROUTER_PROXY);
  console.log("New creator wallet:", NEW_CREATOR_WALLET);

  const coreBefore = await core.creatorFeeWallet();
  const routerBefore = await router.creatorWallet();

  console.log("Core creator before  :", coreBefore);
  console.log("Router creator before:", routerBefore);

  if (coreBefore.toLowerCase() !== NEW_CREATOR_WALLET.toLowerCase()) {
    const tx = await core.setCreatorFeeWallet(NEW_CREATOR_WALLET);
    await tx.wait();
    console.log("Core update tx       :", tx.hash);
  } else {
    console.log("Core already updated : YES");
  }

  if (routerBefore.toLowerCase() !== NEW_CREATOR_WALLET.toLowerCase()) {
    const tx = await router.setCreatorWallet(NEW_CREATOR_WALLET);
    await tx.wait();
    console.log("Router update tx     :", tx.hash);
  } else {
    console.log("Router already updated: YES");
  }

  const coreAfter = await core.creatorFeeWallet();
  const routerAfter = await router.creatorWallet();

  console.log("Core creator after   :", coreAfter);
  console.log("Router creator after :", routerAfter);
  console.log(
    "Core verified        :",
    coreAfter.toLowerCase() === NEW_CREATOR_WALLET.toLowerCase() ? "YES" : "NO"
  );
  console.log(
    "Router verified      :",
    routerAfter.toLowerCase() === NEW_CREATOR_WALLET.toLowerCase() ? "YES" : "NO"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
