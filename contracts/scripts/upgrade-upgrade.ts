import { ethers } from "hardhat";
async function main() {
  const proxyAddr = "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50";
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const old = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("Old impl:", "0x" + old.slice(26));
  const factory = await ethers.getContractFactory("MetaGuildXUpgrade");
  const newImpl = await factory.deploy();
  await newImpl.waitForDeployment();
  console.log("New impl:", await newImpl.getAddress());
  const proxy = await ethers.getContractAt("MetaGuildXUpgrade", proxyAddr);
  const tx = await proxy.upgradeToAndCall(await newImpl.getAddress(), "0x");
  await tx.wait();
  const updated = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("On-chain:", "0x" + updated.slice(26));
  console.log("Changed:", old !== updated ? "YES ✅" : "NO ❌");
}
main().catch(console.error);
