const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy libraries
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

  // Deploy new implementation only
  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: paymentLibAddress,
      MetaGuildXPlacementLib: placementLibAddress,
      UpgradeCycleLib: upgradeCycleLibAddress,
    }
  });

  const impl = await CoreFactory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("\nNew Core Implementation:", implAddress);
  console.log("\nNext: Gnosis Safe-?? upgradeToAndCall ????????");
  console.log("Proxy:", "0xE3cD200609E223c96987c9FEa41C6014e8625c2F");
  console.log("New Impl:", implAddress);
}

main().catch(console.error);
