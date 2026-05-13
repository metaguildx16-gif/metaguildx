import { ethers, upgrades } from "hardhat";

const INCOME_PROXY = "0xcD4a223ac91E551BF0e278dF1bE9eb29901A4FeB";
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EXPECTED_CORE = "0x9490E2C603c5a6D3c0E66af8494E766470dA1E4B";

function decodeImplementation(raw: string) {
  return ethers.getAddress(`0x${raw.slice(-40)}`);
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Upgrading with owner:", owner.address);

  console.log("=== BEFORE ===");
  const oldImplRaw = await ethers.provider.getStorage(INCOME_PROXY, IMPL_SLOT);
  const oldImpl = decodeImplementation(oldImplRaw);
  console.log("Old implementation:", oldImpl);

  console.log("=== UPGRADING INCOME PROXY ===");
  const MetaGuildXIncome = await ethers.getContractFactory("MetaGuildXIncome");
  const upgraded = await upgrades.upgradeProxy(INCOME_PROXY, MetaGuildXIncome);
  await upgraded.waitForDeployment();
  console.log("Income proxy upgraded successfully");

  console.log("=== AFTER ===");
  const newImplRaw = await ethers.provider.getStorage(INCOME_PROXY, IMPL_SLOT);
  const newImpl = decodeImplementation(newImplRaw);
  console.log("New implementation:", newImpl);

  console.log("=== VERIFY FIXES ===");
  const income = await ethers.getContractAt("MetaGuildXIncome", INCOME_PROXY, owner);
  const coreAddr = await income.coreContract();
  console.log("Core address in Income:", coreAddr);
  console.log(
    "Core address correct:",
    coreAddr.toLowerCase() === EXPECTED_CORE.toLowerCase() ? "YES" : "NO"
  );

  console.log("=== UPGRADE COMPLETE ===");
  console.log("Now run: releaseStrandedEscrow.ts");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
