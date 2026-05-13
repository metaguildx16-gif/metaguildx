import { ethers } from "hardhat";

async function main() {
  const SYSTEM = "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const INCOME_ROUTER = "0x03dB566EF538b4264f841644B702585427f7Cd66";
  const CASHBACK_POOL = "0xDa478bBdcFFE06110BeE4292b15B12626E52354b";

  const [owner] = await ethers.getSigners();
  const system = await ethers.getContractAt("MetaGuildXSystem", SYSTEM, owner);

  console.log("Owner           :", owner.address);
  console.log("System          :", SYSTEM);
  console.log("Target router   :", INCOME_ROUTER);
  console.log("Target cashback :", CASHBACK_POOL);

  const currentIncome = await system.incomeContract();
  const currentCashback = await system.cashbackContract();

  console.log("Current router  :", currentIncome);
  console.log("Current cashback:", currentCashback);

  if (currentIncome.toLowerCase() !== INCOME_ROUTER.toLowerCase()) {
    const tx = await system.setIncomeContract(INCOME_ROUTER);
    await tx.wait();
    console.log("IncomeRouter synced:", tx.hash);
  } else {
    console.log("IncomeRouter already synced");
  }

  if (currentCashback.toLowerCase() !== CASHBACK_POOL.toLowerCase()) {
    const tx = await system.setCashbackContract(CASHBACK_POOL);
    await tx.wait();
    console.log("CashbackPool synced:", tx.hash);
  } else {
    console.log("CashbackPool already synced");
  }

  console.log("Final router    :", await system.incomeContract());
  console.log("Final cashback  :", await system.cashbackContract());
}

main().catch(console.error);
