import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const INCOME = process.env.INCOME_ENGINE_ADDRESS!;
  console.log("Upgrading MetaGuildXIncome:", INCOME);

  const Factory = await ethers.getContractFactory(
    "MetaGuildXIncome"
  );

  const upgraded = await upgrades.upgradeProxy(
    INCOME,
    Factory
  );
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967
    .getImplementationAddress(INCOME);
  console.log("New impl:", newImpl);
  console.log("Upgrade success ✅");
}

main().catch(console.error);
