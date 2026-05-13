import { ethers } from "hardhat";

async function main() {
  const SYSTEM = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const OLD_ROUTER = "0x617fCC45363cebfff2188f8Ccf4e31407cE3C5C4";
  const NEW_ROUTER = "0x03dB566EF538b4264f841644B702585427f7Cd66";

  const system = await ethers.getContractAt("MetaGuildXSystem", SYSTEM);
  const oldRouter = await ethers.getContractAt("IncomeRouter", OLD_ROUTER);
  const newRouter = await ethers.getContractAt("IncomeRouter", NEW_ROUTER);

  console.log("System incomeContract:", await system.incomeContract());
  console.log("Old router core     :", await oldRouter.coreContract());
  console.log("Old router manager  :", await oldRouter.upgradeManagerContract());
  console.log("New router core     :", await newRouter.coreContract());
  console.log("New router manager  :", await newRouter.upgradeManagerContract());
}

main().catch(console.error);
