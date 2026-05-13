import { ethers, upgrades } from "hardhat";

async function main() {
  const CORE_PROXY = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const INCOME_PROXY = "0xE54abA50Fa9A22F408C215B8D391B2810A4b46bE";
  const ROUTER_PROXY = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";
  const UPGRADE_PROXY = "0x5Af0aC3662e047cFF3383BB5d53b0c6a8DABAe44";

  console.log("Upgrading MetaGuildXCore...");
  const UpgradeCycleLib = await ethers.getContractFactory("UpgradeCycleLib");
  const upgradeCycleLib = await UpgradeCycleLib.deploy();
  await upgradeCycleLib.waitForDeployment();
  const upgradeCycleLibAddress = await upgradeCycleLib.getAddress();
  console.log("UpgradeCycleLib:", upgradeCycleLibAddress);

  const Core = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      UpgradeCycleLib: upgradeCycleLibAddress
    }
  });
  await (await upgrades.upgradeProxy(CORE_PROXY, Core, {
    redeployImplementation: "always",
    unsafeAllowLinkedLibraries: true
  })).waitForDeployment();
  console.log("Core impl:", await upgrades.erc1967.getImplementationAddress(CORE_PROXY));

  console.log("Upgrading MetaGuildXIncome...");
  const Income = await ethers.getContractFactory("MetaGuildXIncome");
  await (await upgrades.upgradeProxy(INCOME_PROXY, Income, {
    redeployImplementation: "always"
  })).waitForDeployment();
  console.log("Income impl:", await upgrades.erc1967.getImplementationAddress(INCOME_PROXY));

  console.log("Upgrading IncomeRouter...");
  const Router = await ethers.getContractFactory("IncomeRouter");
  await (await upgrades.upgradeProxy(ROUTER_PROXY, Router, {
    redeployImplementation: "always"
  })).waitForDeployment();
  console.log("Router impl:", await upgrades.erc1967.getImplementationAddress(ROUTER_PROXY));

  console.log("Upgrading MetaGuildXUpgrade...");
  const Upgrade = await ethers.getContractFactory("MetaGuildXUpgrade");
  await (await upgrades.upgradeProxy(UPGRADE_PROXY, Upgrade, {
    redeployImplementation: "always"
  })).waitForDeployment();
  console.log("Upgrade impl:", await upgrades.erc1967.getImplementationAddress(UPGRADE_PROXY));

  console.log("\nAll upgrades complete ✅");
}

main().catch(console.error);
