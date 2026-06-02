import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const INCOME_PROXY = "0x16f7F2590Af7f3657AC4dA1416b1Ab4e852091F5";
const PREVIOUS_IMPL = "0x9Db1FC9F11A56D32182c86247E6e0644930e457f";
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
