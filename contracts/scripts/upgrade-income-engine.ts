import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY = process.env.INCOME_ENGINE_ADDRESS ?? "0x87d752D160299c09BaDaac3dd66FBac483A5b67b";
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading MetaGuildXIncome...");
  console.log("Proxy:", PROXY);
  console.log("Signer:", deployer.address);

  const Factory = await ethers.getContractFactory("MetaGuildXIncome");
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory, {
    redeployImplementation: "always"
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log("New impl:", newImpl);

  const income = await ethers.getContractAt("MetaGuildXIncome", PROXY);
  console.log("coreContract:", await income.coreContract());
  console.log("upgradeEngineContract:", await income.upgradeEngineContract());
  console.log("defaultPaymentAsset:", await income.defaultPaymentAsset());
  console.log("Income upgrade complete âœ…");
}

main().catch(console.error);
