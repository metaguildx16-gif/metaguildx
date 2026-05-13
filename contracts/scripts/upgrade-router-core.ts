import { ethers, upgrades } from "hardhat";

async function main() {
  const CORE_PROXY = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const ROUTER_PROXY = "0x6AD732D64727A749Df3959A6DA12066b4ab664Bb";

  console.log("Upgrading IncomeRouter...");
  const Router = await ethers.getContractFactory("IncomeRouter");
  await (await upgrades.upgradeProxy(ROUTER_PROXY, Router, {
    redeployImplementation: "always"
  })).waitForDeployment();
  const routerImpl = await upgrades.erc1967.getImplementationAddress(ROUTER_PROXY);
  console.log("Router impl:", routerImpl);

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
  const coreImpl = await upgrades.erc1967.getImplementationAddress(CORE_PROXY);
  console.log("Core impl:", coreImpl);

  console.log("Upgrade complete ✅");
}

main().catch(console.error);
