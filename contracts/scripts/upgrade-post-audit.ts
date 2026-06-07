import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with:", deployer.address);

  // Core
  const CoreFactory = await ethers.getContractFactory("MetaGuildXCore", {
    libraries: {
      MetaGuildXPaymentLib: "0xc6d8271247eE8A103ADb462b804C0214ecB166E9",
      MetaGuildXPlacementLib: "0xCD6FC32a3f46F2cd50C1E59A2Ccf0831267Ad13F",
      UpgradeCycleLib: "0x5C78da0133d3A269949256808D10611F66A65711",
    }
  });
  const coreImpl = await CoreFactory.deploy();
  await coreImpl.waitForDeployment();
  const coreImplAddr = await coreImpl.getAddress();
  const coreProxy = await ethers.getContractAt("MetaGuildXCore",
    "0x19F72c5a287334086fD34D41ebe6bb534524D202", deployer);
  await (await coreProxy.upgradeToAndCall(coreImplAddr, "0x")).wait();
  console.log("Core upgraded:", coreImplAddr);

  // Income
  const IncomeFactory = await ethers.getContractFactory("MetaGuildXIncome");
  const incomeImpl = await IncomeFactory.deploy();
  await incomeImpl.waitForDeployment();
  const incomeImplAddr = await incomeImpl.getAddress();
  const incomeProxy = await ethers.getContractAt("MetaGuildXIncome",
    "0x72433Cd3d2e41ed2B230510496835803aD245a48", deployer);
  await (await incomeProxy.upgradeToAndCall(incomeImplAddr, "0x")).wait();
  console.log("Income upgraded:", incomeImplAddr);

  // Staking
  const StakingFactory = await ethers.getContractFactory("MGXStaking");
  const stakingImpl = await StakingFactory.deploy();
  await stakingImpl.waitForDeployment();
  const stakingImplAddr = await stakingImpl.getAddress();
  const stakingProxy = await ethers.getContractAt("MGXStaking",
    "0xEd70b05b28bfbc4885111260F4d3eEE127B043c9", deployer);
  await (await stakingProxy.upgradeToAndCall(stakingImplAddr, "0x")).wait();
  console.log("Staking upgraded:", stakingImplAddr);

  console.log("\nAll upgrades complete!");
}

main().catch((e) => { console.error(e); process.exit(1); });
