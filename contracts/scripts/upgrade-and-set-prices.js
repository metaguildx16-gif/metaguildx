const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const CORE_PROXY = "0xE3cD200609E223c96987c9FEa41C6014e8625c2F";

  // Deploy fresh libraries
  console.log("Deploying libraries...");
  const paymentLib = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();
  console.log("MetaGuildXPaymentLib:", paymentLibAddress);

  const placementLib = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  await placementLib.waitForDeployment();
  const placementLibAddress = await placementLib.getAddress();
  console.log("MetaGuildXPlacementLib:", placementLibAddress);

  const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  await upgradeCycleLib.waitForDeployment();
  const upgradeCycleLibAddress = await upgradeCycleLib.getAddress();
  console.log("UpgradeCycleLib:", upgradeCycleLibAddress);

  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: paymentLibAddress,
      MetaGuildXPlacementLib: placementLibAddress,
      UpgradeCycleLib: upgradeCycleLibAddress,
    }
  });

  console.log("Importing Core proxy...");
  await upgrades.forceImport(CORE_PROXY, CoreFactory, {
    kind: "uups",
    unsafeAllowLinkedLibraries: true
  });

  console.log("Upgrading MetaGuildXCore...");
  const upgraded = await upgrades.upgradeProxy(CORE_PROXY, CoreFactory, {
    unsafeAllowLinkedLibraries: true
  });
  await upgraded.waitForDeployment();

  const coreImpl = await upgrades.erc1967.getImplementationAddress(CORE_PROXY);
  console.log("New impl:", coreImpl);
  console.log("Core upgraded!");

  // Set correct package prices
  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY);
  const S = 10n;
  const prices = [
    10n   * S,
    20n   * S,
    40n   * S,
    80n   * S,
    160n  * S,
    320n  * S,
    640n  * S,
    1280n * S,
    2560n * S,
    5120n * S,
  ];

  console.log("Setting package prices...");
  const tx = await core.setPackagePrices(prices);
  await tx.wait();
  console.log("Package prices updated!");

  const updated = await core.getPackagePrices();
  updated.forEach((p, i) => {
    console.log("Pkg" + (i+1) + ": " + p.toString() + " = $" + (Number(p)/10));
  });
}

main().catch(console.error);
