import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const ROUTER = process.env.INCOME_ROUTER_ADDRESS!;
  console.log("Upgrading IncomeRouter:", ROUTER);

  const Factory = await ethers.getContractFactory(
    "IncomeRouter"
  );
  const upgraded = await upgrades.upgradeProxy(
    ROUTER,
    Factory
  );
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967
    .getImplementationAddress(ROUTER);
  console.log("New impl:", newImpl);
  console.log("Upgrade success ✅");
}

main().catch(console.error);
