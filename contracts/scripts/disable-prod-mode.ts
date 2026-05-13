import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();
  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  console.log("Core:", CORE);
  console.log("Signer:", deployer.address);
  console.log("Production mode before:", await core.productionMode());
  console.log("Default payment asset before:", await core.defaultPaymentAsset());

  const currentAsset = await core.defaultPaymentAsset();
  const tx = await core.setProductionMode(false, currentAsset);
  await tx.wait();

  console.log("Disable tx:", tx.hash);
  console.log("Production mode after:", await core.productionMode());
  console.log("Default payment asset after:", await core.defaultPaymentAsset());
}

main().catch(console.error);
