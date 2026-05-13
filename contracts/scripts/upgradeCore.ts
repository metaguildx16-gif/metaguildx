import { ethers, upgrades } from "hardhat";

const PROXY_ADDRESS = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EXPECTED_USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

function decodeImplementation(raw: string) {
  return ethers.getAddress(`0x${raw.slice(-40)}`);
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Upgrading with owner:", owner.address);

  console.log("=== BEFORE UPGRADE ===");
  const oldImplRaw = await ethers.provider.getStorage(PROXY_ADDRESS, IMPL_SLOT);
  const oldImpl = decodeImplementation(oldImplRaw);
  console.log("Old implementation:", oldImpl);

  console.log("=== DEPLOYING NEW IMPLEMENTATION ===");
  const UpgradeCycleLib = await ethers.getContractFactory("UpgradeCycleLib");
  const lib = await UpgradeCycleLib.deploy();
  await lib.waitForDeployment();
  const libAddress = await lib.getAddress();
  console.log("UpgradeCycleLib:", libAddress);

  const MetaGuildXCore = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      UpgradeCycleLib: libAddress
    }
  });

  console.log("=== UPGRADING PROXY ===");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MetaGuildXCore, {
    unsafeAllowLinkedLibraries: true
  });
  await upgraded.waitForDeployment();
  console.log("Proxy upgraded successfully");

  console.log("=== AFTER UPGRADE ===");
  const newImplRaw = await ethers.provider.getStorage(PROXY_ADDRESS, IMPL_SLOT);
  const newImpl = decodeImplementation(newImplRaw);
  console.log("New implementation:", newImpl);

  console.log("=== VERIFY FIXES ===");
  const core = await ethers.getContractAt("MetaGuildXCore", PROXY_ADDRESS, owner);
  const rootUser = await core.usersById(1n);
  console.log("Root User 1 exists:", rootUser.id === 1n ? "YES" : "NO");

  const usdtAddress = await core.defaultPaymentAsset();
  console.log("USDT address:", usdtAddress);
  console.log(
    "USDT same:",
    usdtAddress.toLowerCase() === EXPECTED_USDT.toLowerCase() ? "YES" : "NO"
  );

  const testCall = await core.adminReleaseStrandedEscrow.populateTransaction(1n);
  console.log("Fix 5 adminReleaseStrandedEscrow exists:", testCall ? "YES" : "NO");

  console.log("=== UPGRADE COMPLETE ===");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
