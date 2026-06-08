import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  const paymentLib = await (await ethers.getContractFactory("MetaGuildXPaymentLib")).deploy();
  await paymentLib.waitForDeployment();
  const placementLib = await (await ethers.getContractFactory("MetaGuildXPlacementLib")).deploy();
  await placementLib.waitForDeployment();
  const upgradeCycleLib = await (await ethers.getContractFactory("UpgradeCycleLib")).deploy();
  await upgradeCycleLib.waitForDeployment();
  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: await paymentLib.getAddress(),
      MetaGuildXPlacementLib: await placementLib.getAddress(),
      UpgradeCycleLib: await upgradeCycleLib.getAddress(),
    }
  });
  console.log("Deploying new implementation...");
  const impl = await CoreFactory.deploy();
  await impl.waitForDeployment();
  console.log("NEW IMPLEMENTATION:", await impl.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
