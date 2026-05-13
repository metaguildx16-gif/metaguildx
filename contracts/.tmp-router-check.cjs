const hre = require('hardhat');
(async () => {
  const oldRouterAddr = '0x617fCC45363cebfff2188f8Ccf4e31407cE3C5C4';
  const newRouterAddr = '0x03dB566EF538b4264f841644B702585427f7Cd66';
  const oldCashbackAddr = '0xcef40182fFAF9c8aA36fE85afA138129f53c6258';
  const systemAddr = '0x283Bab36CFDE3fE440f5aCcdcf3c7FA8dd8fD9FC';
  const oldRouter = await hre.ethers.getContractAt('IncomeRouter', oldRouterAddr);
  const newRouter = await hre.ethers.getContractAt('IncomeRouter', newRouterAddr);
  const oldCashback = await hre.ethers.getContractAt('CashbackPool', oldCashbackAddr);
  console.log('oldRouter core:', await oldRouter.coreContract());
  console.log('newRouter core:', await newRouter.coreContract());
  console.log('oldRouter manager:', await oldRouter.upgradeManagerContract());
  console.log('newRouter manager:', await newRouter.upgradeManagerContract());
  console.log('oldRouter creator:', await oldRouter.creatorWallet());
  console.log('newRouter creator:', await newRouter.creatorWallet());
  console.log('oldCashback owner:', await oldCashback.owner());
  console.log('system address:', systemAddr);
})().catch((e)=>{ console.error(e); process.exit(1); });
