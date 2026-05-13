import { ethers, upgrades } from "hardhat";

async function main() {
  const CORE_PROXY = "0x0Ae6275740A14AD04B360940425cfb8Ff412C290";
  const ROUTER_PROXY = "0x232d052aE450fEE285343dACbE09DdD1FC71ee9F";

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const upgradeCycleLibAddress = process.env.UPGRADE_CYCLE_LIB;
  if (!upgradeCycleLibAddress) {
    throw new Error("UPGRADE_CYCLE_LIB env var is required");
  }

  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    signer: deployer,
    libraries: {
      UpgradeCycleLib: upgradeCycleLibAddress,
    },
  });

  await upgrades.forceImport(CORE_PROXY, CoreFactory, {
    kind: "uups",
    unsafeAllowLinkedLibraries: true,
  });
  const coreUpgraded = await upgrades.upgradeProxy(CORE_PROXY, CoreFactory, {
    kind: "uups",
    redeployImplementation: "always",
    unsafeAllowLinkedLibraries: true,
  });
  await coreUpgraded.waitForDeployment();
  const newCoreImpl = await upgrades.erc1967.getImplementationAddress(CORE_PROXY);
  console.log("Core new impl:", newCoreImpl);

  const RouterFactory = await ethers.getContractFactory("IncomeRouter", {
    signer: deployer,
  });

  await upgrades.forceImport(ROUTER_PROXY, RouterFactory, { kind: "uups" });
  const routerUpgraded = await upgrades.upgradeProxy(ROUTER_PROXY, RouterFactory, {
    kind: "uups",
    redeployImplementation: "always",
  });
  await routerUpgraded.waitForDeployment();
  const newRouterImpl = await upgrades.erc1967.getImplementationAddress(ROUTER_PROXY);
  console.log("Router new impl:", newRouterImpl);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
