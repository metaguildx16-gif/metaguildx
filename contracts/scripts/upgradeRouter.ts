import { ethers, upgrades } from "hardhat";

const ROUTER_PROXY = "0xd496eC1Cf0E66a7beECe21b8Bd908F335aBbDfe8";
const CORE_PROXY = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

function decodeImplementation(raw: string) {
  return ethers.getAddress(`0x${raw.slice(-40)}`);
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Upgrading with:", owner.address);

  console.log("=== BEFORE ===");
  const oldRouterImplRaw = await ethers.provider.getStorage(ROUTER_PROXY, IMPL_SLOT);
  const oldCoreImplRaw = await ethers.provider.getStorage(CORE_PROXY, IMPL_SLOT);
  const oldRouterImpl = decodeImplementation(oldRouterImplRaw);
  const oldCoreImpl = decodeImplementation(oldCoreImplRaw);
  console.log("Old Router impl:", oldRouterImpl);
  console.log("Old Core impl:", oldCoreImpl);

  console.log("=== UPGRADING CORE ===");
  const UpgradeCycleLib = await ethers.getContractFactory("UpgradeCycleLib");
  const lib = await UpgradeCycleLib.deploy();
  await lib.waitForDeployment();
  const libAddress = await lib.getAddress();
  console.log("UpgradeCycleLib:", libAddress);

  const MetaGuildXCore = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      UpgradeCycleLib: libAddress,
    },
  });

  const upgradedCore = await upgrades.upgradeProxy(CORE_PROXY, MetaGuildXCore, {
    unsafeAllowLinkedLibraries: true,
  });
  await upgradedCore.waitForDeployment();
  console.log("Core upgraded");

  console.log("=== UPGRADING ROUTER ===");
  const IncomeRouter = await ethers.getContractFactory("IncomeRouter", owner);
  const upgradedRouter = await upgrades.upgradeProxy(ROUTER_PROXY, IncomeRouter, {
    redeployImplementation: "always",
  });
  await upgradedRouter.waitForDeployment();
  console.log("Router upgraded");

  console.log("=== AFTER ===");
  const newRouterImplRaw = await ethers.provider.getStorage(ROUTER_PROXY, IMPL_SLOT);
  const newCoreImplRaw = await ethers.provider.getStorage(CORE_PROXY, IMPL_SLOT);
  const newRouterImpl = decodeImplementation(newRouterImplRaw);
  const newCoreImpl = decodeImplementation(newCoreImplRaw);
  console.log("New Router impl:", newRouterImpl);
  console.log("New Core impl:", newCoreImpl);

  console.log("=== VERIFY ===");
  const core = await ethers.getContractAt("MetaGuildXCore", CORE_PROXY, owner);

  const rootUser = await core.usersById(1n);
  console.log("Root User 1 exists:", rootUser.id === 1n ? "YES" : "NO");

  const usdtAddress = await core.defaultPaymentAsset();
  console.log("USDT address:", usdtAddress);

  const parent12 = await core.getParent(12n);
  console.log("getParent(12):", parent12.toString());

  const eligible1 = await core.isLevelEligibleUser(1n);
  console.log("User 1 level eligible:", eligible1 ? "YES" : "NO");

  const eligible12 = await core.isLevelEligibleUser(12n);
  console.log("User 12 level eligible:", eligible12 ? "YES" : "NO");

  console.log("=== UPGRADE COMPLETE ===");
  console.log("Run verification test next");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
