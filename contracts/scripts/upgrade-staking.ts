import { ethers, upgrades } from "hardhat";

async function main() {
  const PROXY = process.env.MGX_STAKING_ADDRESS!;
  if (!PROXY) {
    throw new Error("MGX_STAKING_ADDRESS env var is required");
  }
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading MGXStaking...");
  console.log("Proxy:", PROXY);
  console.log("Signer:", deployer.address);

  const Factory = await ethers.getContractFactory("MGXStaking");
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory);
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log("MGXStaking upgraded âœ…");
  console.log("New impl:", newImpl);

  const staking = await ethers.getContractAt("MGXStaking", PROXY);
  console.log("coreContract:", await staking.coreContract());
  console.log("incomeContract:", await staking.incomeContract());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
