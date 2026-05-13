import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY = process.env.UPGRADE_ENGINE_PROXY ?? "0x402B53d24EAf7624D5c7fdeFF9b8cD1d3b787278";
  const ROUTER = process.env.INCOME_ROUTER_PROXY ?? process.env.INCOME_ROUTER_ADDRESS!;
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading MetaGuildXUpgrade...");
  console.log("Proxy:", PROXY);
  console.log("Signer:", deployer.address);
  console.log("Router:", ROUTER);

  const Factory = await ethers.getContractFactory("MetaGuildXUpgrade");
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory);
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log("New impl:", newImpl);

  const upgradeEngine = await ethers.getContractAt("MetaGuildXUpgrade", PROXY);
  const routerBefore = await upgradeEngine.routerContract();
  console.log("routerContract before:", routerBefore);

  if (routerBefore.toLowerCase() !== ROUTER.toLowerCase()) {
    const tx = await upgradeEngine.setRouterContract(ROUTER);
    await tx.wait();
    console.log("setRouterContract tx:", tx.hash);
  }

  console.log("routerContract after:", await upgradeEngine.routerContract());
  console.log("MetaGuildXUpgrade upgraded ✅");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
