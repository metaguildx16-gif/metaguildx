import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const UPGRADE_PROXY = "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50";
  const INCOME_PROXY  = "0x72433Cd3d2e41ed2B230510496835803aD245a48";

  const UpgradeFactory = await ethers.getContractFactory("MetaGuildXUpgrade");
  const IncomeFactory  = await ethers.getContractFactory("MetaGuildXIncome");

  // Register proxies in manifest first
  console.log("Importing proxies into manifest...");
  await upgrades.forceImport(UPGRADE_PROXY, UpgradeFactory, { kind: "uups" });
  console.log("MetaGuildXUpgrade imported");
  await upgrades.forceImport(INCOME_PROXY, IncomeFactory, { kind: "uups" });
  console.log("MetaGuildXIncome imported");

  // Now upgrade
  console.log("\nUpgrading MetaGuildXUpgrade...");
  const upgradedUpgrade = await upgrades.upgradeProxy(UPGRADE_PROXY, UpgradeFactory);
  await upgradedUpgrade.waitForDeployment();
  const upgradeImpl = await upgrades.erc1967.getImplementationAddress(UPGRADE_PROXY);
  console.log("MetaGuildXUpgrade impl:", upgradeImpl);

  console.log("\nUpgrading MetaGuildXIncome...");
  const upgradedIncome = await upgrades.upgradeProxy(INCOME_PROXY, IncomeFactory);
  await upgradedIncome.waitForDeployment();
  const incomeImpl = await upgrades.erc1967.getImplementationAddress(INCOME_PROXY);
  console.log("MetaGuildXIncome impl:", incomeImpl);

  console.log("\nBoth upgrades complete!");
  console.log("Upgrade impl:", upgradeImpl);
  console.log("Income impl: ", incomeImpl);
}

main().catch((e) => { console.error(e); process.exit(1); });
