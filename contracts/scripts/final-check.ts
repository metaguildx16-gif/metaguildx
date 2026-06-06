import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0x19F72c5a287334086fD34D41ebe6bb534524D202");
  const income = await ethers.getContractAt("MetaGuildXIncome", "0x72433Cd3d2e41ed2B230510496835803aD245a48");
  const staking = await ethers.getContractAt("MGXStaking", "0xEd70b05b28bfbc4885111260F4d3eEE127B043c9");
  const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", "0xF4975eB104932bDBcA491A9Cb985439eA03863e0");

  console.log("=== FINAL SYSTEM CHECK ===\n");

  // Users
  const nextId = await core.nextUserId();
  console.log("Total users:", (Number(nextId)-1).toString());

  // Failed distributions
  const failed = await core.getFailedUserIds();
  let activeFailures = 0;
  for (const uid of failed) {
    const fd = await core.failedDistribution(uid);
    if (fd) activeFailures++;
  }
  console.log("Active failed distributions:", activeFailures, activeFailures === 0 ? "✅" : "❌");

  // Core balance
  const coreBal = await usdt.balanceOf("0x19F72c5a287334086fD34D41ebe6bb534524D202");
  console.log("Core USDT balance:", ethers.formatUnits(coreBal, 18));

  // Staking
  const rewardPool = await staking.rewardPool();
  const totalStaked = await staking.totalStaked();
  const rewardRate = await staking.rewardRate();
  console.log("Staking rewardPool:", ethers.formatUnits(rewardPool, 18), "MGX", rewardPool > 0n ? "✅" : "❌");
  console.log("Total staked:", ethers.formatUnits(totalStaked, 18), "MGX");
  console.log("Reward rate:", rewardRate.toString(), "bps");

  // Production mode
  const prodMode = await core.productionMode();
  console.log("Production mode:", prodMode ? "✅" : "❌");

  // Payment asset
  const defaultAsset = await core.defaultPaymentAsset();
  console.log("Default payment asset:", defaultAsset === "0xF4975eB104932bDBcA491A9Cb985439eA03863e0" ? "USDT ✅" : "WRONG ❌");

  // All impl versions
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const contracts: [string, string][] = [
    ["Core",        "0x19F72c5a287334086fD34D41ebe6bb534524D202"],
    ["Income",      "0x72433Cd3d2e41ed2B230510496835803aD245a48"],
    ["Router",      "0xe59Ad238162D9591BCC7659A10fe017004a4cA69"],
    ["Upgrade",     "0x2a9Ed16e119da2CDB241Ac672bB5ece059730D50"],
    ["Staking",     "0xEd70b05b28bfbc4885111260F4d3eEE127B043c9"],
    ["TokenEngine", "0x68F028Cb932114AE700FD0dc263f2e9d8FcFE351"],
  ];
  console.log("\n=== Implementation Versions ===");
  for (const [name, proxy] of contracts) {
    const impl = await ethers.provider.getStorage(proxy, implSlot);
    console.log(name + ":", "0x" + impl.slice(26));
  }

  console.log("\n=== Summary ===");
  console.log("Users:", (Number(nextId)-1));
  console.log("Failed:", activeFailures === 0 ? "None ✅" : activeFailures + " ACTIVE ❌");
  console.log("System:", prodMode && defaultAsset === "0xF4975eB104932bDBcA491A9Cb985439eA03863e0" ? "READY ✅" : "NOT READY ❌");
}
main().catch(console.error);
