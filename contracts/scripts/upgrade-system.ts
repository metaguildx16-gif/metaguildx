import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const { ethers, upgrades } = hre;

  const systemProxy =
    process.env.CORE_PROXY_ADDRESS ??
    process.env.VITE_SYSTEM_ADDRESS ??
      "0xcea26779d6C0d80525702a5a7362Aa4d08F9E1Ec" ??
    process.env.SYSTEM_PROXY_ADDRESS ??
    process.env.SYSTEM_PROXY;
  if (!systemProxy) {
    throw new Error("CORE_PROXY_ADDRESS or VITE_SYSTEM_ADDRESS or SYSTEM_PROXY_ADDRESS or SYSTEM_PROXY not set");
  }

  const [deployer] = await ethers.getSigners();

  console.log("Upgrading MetaGuildXCore...");
  console.log("Proxy  :", systemProxy);
  console.log("Signer :", deployer.address);

  const UpgradeCycleLib = await ethers.getContractFactory("UpgradeCycleLib");
  const lib = await UpgradeCycleLib.deploy();
  await lib.waitForDeployment();
  const libAddress = await lib.getAddress();
  console.log("UpgradeCycleLib deployed:", libAddress);

  const Core = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      UpgradeCycleLib: libAddress
    }
  });

  const upgraded = await upgrades.upgradeProxy(systemProxy, Core, {
    unsafeAllowLinkedLibraries: true
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(systemProxy);

  console.log("Proxy address (unchanged) :", systemProxy);
  console.log("New implementation        :", newImpl);
  console.log("UpgradeCycleLib address   :", libAddress);
  console.log("MetaGuildXCore upgrade complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
