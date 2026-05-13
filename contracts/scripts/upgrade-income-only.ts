import { ethers, upgrades } from "hardhat";

async function main() {
  const INCOME_PROXY = "0x3F2a92DA56e6F659A9F2C0794E036A739F4F5B15";

  console.log("Upgrading MetaGuildXIncome...");
  const Income = await ethers.getContractFactory("MetaGuildXIncome");
  await (await upgrades.upgradeProxy(INCOME_PROXY, Income, {
    redeployImplementation: "always"
  })).waitForDeployment();
  const impl = await upgrades.erc1967.getImplementationAddress(INCOME_PROXY);
  console.log("Income impl:", impl);
}

main().catch(console.error);
