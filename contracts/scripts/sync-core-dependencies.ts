import { ethers } from "hardhat";

async function main() {
  const SYSTEM = process.env.SYSTEM_PROXY ?? process.env.SYSTEM_PROXY_ADDRESS ?? "0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC";
  const INCOME_ROUTER =
    process.env.INCOME_ROUTER_ADDRESS ??
    process.env.INCOME_ROUTER_PROXY ??
    "0x03dB566EF538b4264f841644B702585427f7Cd66";
  const CASHBACK_POOL = process.env.CASHBACK_POOL_ADDRESS ?? "0xDa478bBdcFFE06110BeE4292b15B12626E52354b";

  const [owner] = await ethers.getSigners();
  const router = await ethers.getContractAt("IncomeRouter", INCOME_ROUTER, owner);
  const cashback = await ethers.getContractAt("CashbackPool", CASHBACK_POOL, owner);

  console.log("Owner           :", owner.address);
  console.log("System          :", SYSTEM);
  console.log("IncomeRouter    :", INCOME_ROUTER);
  console.log("CashbackPool    :", CASHBACK_POOL);

  const routerCore = await router.coreContract();
  const cashbackCore = await cashback.coreContract();

  console.log("Router core     :", routerCore);
  console.log("Cashback core   :", cashbackCore);

  if (routerCore.toLowerCase() !== SYSTEM.toLowerCase()) {
    const tx = await router.setCoreContract(SYSTEM);
    await tx.wait();
    console.log("Router core synced   :", tx.hash);
  } else {
    console.log("Router core already synced");
  }

  if (cashbackCore.toLowerCase() !== SYSTEM.toLowerCase()) {
    const tx = await cashback.setCoreContract(SYSTEM);
    await tx.wait();
    console.log("Cashback core synced :", tx.hash);
  } else {
    console.log("Cashback core already synced");
  }

  console.log("Final router core   :", await router.coreContract());
  console.log("Final cashback core :", await cashback.coreContract());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
