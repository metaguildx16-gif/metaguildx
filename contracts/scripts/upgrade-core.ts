import { ethers } from "hardhat";
async function main() {
  const proxyAddr = "0xF28019a3cC992619b652967B96B3813bA3830D91";
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const oldImpl = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("Old impl:", "0x" + oldImpl.slice(26));

  console.log("Deploying MetaGuildXPaymentLib...");
  const paymentLibFactory = await ethers.getContractFactory("MetaGuildXPaymentLib");
  const paymentLib = await paymentLibFactory.deploy();
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();
  console.log("MetaGuildXPaymentLib:", paymentLibAddress);

  console.log("Deploying MetaGuildXPlacementLib...");
  const placementLibFactory = await ethers.getContractFactory("MetaGuildXPlacementLib");
  const placementLib = await placementLibFactory.deploy();
  await placementLib.waitForDeployment();
  const placementLibAddress = await placementLib.getAddress();
  console.log("MetaGuildXPlacementLib:", placementLibAddress);

  console.log("Deploying UpgradeCycleLib...");
  const upgradeCycleLibFactory = await ethers.getContractFactory("UpgradeCycleLib");
  const upgradeCycleLib = await upgradeCycleLibFactory.deploy();
  await upgradeCycleLib.waitForDeployment();
  const upgradeCycleLibAddress = await upgradeCycleLib.getAddress();
  console.log("UpgradeCycleLib:", upgradeCycleLibAddress);

  const factory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: paymentLibAddress,
      MetaGuildXPlacementLib: placementLibAddress,
      UpgradeCycleLib: upgradeCycleLibAddress
    }
  });

  const newImpl = await factory.deploy();
  await newImpl.waitForDeployment();
  console.log("New impl:", await newImpl.getAddress());
  const proxy = await ethers.getContractAt("MetaGuildXCore", proxyAddr);
  const tx = await proxy.upgradeToAndCall(await newImpl.getAddress(), "0x");
  await tx.wait();
  const newImplOnChain = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("On-chain impl:", "0x" + newImplOnChain.slice(26));
  console.log("Changed:", oldImpl !== newImplOnChain ? "YES ✅" : "NO ❌");
}
main().catch(console.error);
