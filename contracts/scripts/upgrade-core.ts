import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  const CORE_PROXY = "0x416c08F71c934f9D7B8a66B1AD982583CDbF0058";

  // Deploy fresh library instances (same bytecode, new addresses)
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

  console.log("\nImporting Core proxy...");
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
  console.log("\nMetaGuildXCore new impl:", coreImpl);
  console.log("Core upgrade complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
