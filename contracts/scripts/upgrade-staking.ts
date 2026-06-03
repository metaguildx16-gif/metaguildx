import { ethers } from "hardhat";
async function main() {
  const proxyAddr = "0x1f36aDb8eeB968000aFA1c8CFE6f38B0568D33b7";
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const oldImpl = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("Old impl:", "0x" + oldImpl.slice(26));
  const factory = await ethers.getContractFactory("MGXStaking");
  const newImpl = await factory.deploy();
  await newImpl.waitForDeployment();
  console.log("New impl:", await newImpl.getAddress());
  const proxy = await ethers.getContractAt("MGXStaking", proxyAddr);
  const tx = await proxy.upgradeToAndCall(await newImpl.getAddress(), "0x");
  await tx.wait();
  const newImplOnChain = await ethers.provider.getStorage(proxyAddr, implSlot);
  console.log("On-chain impl:", "0x" + newImplOnChain.slice(26));
  console.log("Changed:", oldImpl !== newImplOnChain ? "YES ✅" : "NO ❌");
}
main().catch(console.error);
