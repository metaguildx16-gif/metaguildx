import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const INCOME_PROXY = "0x72433Cd3d2e41ed2B230510496835803aD245a48";
const PREVIOUS_IMPL = "0x7fdcf6054af357771c76025d40d7c5524a52cca8";
const ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  console.log("Deploying new MetaGuildXIncome implementation...");

  const factory = await ethers.getContractFactory("MetaGuildXIncome");
  const newImpl = await factory.deploy();
  await newImpl.waitForDeployment();

  const newImplAddress = await newImpl.getAddress();
  console.log("New impl:", newImplAddress);

  const proxy = await ethers.getContractAt("MetaGuildXIncome", INCOME_PROXY);
  const tx = await proxy.upgradeToAndCall(newImplAddress, "0x");
  await tx.wait();
  console.log("Upgrade done");

  const implSlot = await ethers.provider.getStorage(INCOME_PROXY, ERC1967_IMPLEMENTATION_SLOT);
  const onChainImpl = "0x" + implSlot.slice(26);
  console.log("On-chain impl:", onChainImpl);
  console.log("Previous impl:", PREVIOUS_IMPL);
  console.log("Impl changed:", onChainImpl.toLowerCase() !== PREVIOUS_IMPL.toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
