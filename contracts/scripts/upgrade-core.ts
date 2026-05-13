import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const upgradeCycleLibAddress = process.env.UPGRADE_CYCLE_LIB!;
  const placementLib = await ethers.deployContract("MetaGuildXPlacementLib");
  await placementLib.waitForDeployment();
  const placementLibAddress = await placementLib.getAddress();

  const paymentLib = await ethers.deployContract("MetaGuildXPaymentLib");
  await paymentLib.waitForDeployment();
  const paymentLibAddress = await paymentLib.getAddress();

  console.log("Upgrading Core:", CORE);
  console.log("UpgradeCycleLib:", upgradeCycleLibAddress);
  console.log("PlacementLib:", placementLibAddress);
  console.log("PaymentLib:", paymentLibAddress);

  const Factory = await ethers.getContractFactory(
    "MetaGuildXCore",
    {
      libraries: {
        UpgradeCycleLib: upgradeCycleLibAddress,
        MetaGuildXPlacementLib: placementLibAddress,
        MetaGuildXPaymentLib: paymentLibAddress
      }
    }
  );

  const upgraded = await upgrades.upgradeProxy(
    CORE,
    Factory,
    {
      unsafeAllowLinkedLibraries: true
    }
  );
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967
    .getImplementationAddress(CORE);
  console.log("New impl:", newImpl);
  console.log("Core upgrade success ✅");
}

main().catch(console.error);
