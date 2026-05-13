import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);

  console.log(JSON.stringify({
    incomeRouterContract: await core.incomeRouterContract(),
    incomeEngineContract: await core.incomeEngineContract(),
    upgradeEngineContract: await core.upgradeEngineContract(),
    binaryTreeContract: await core.binaryTreeContract(),
    cashbackPoolContract: await core.cashbackPoolContract(),
    stakingContract: await core.stakingContract(),
    mgxTokenAddress: await core.mgxTokenAddress(),
    usdtAddress: await core.usdtAddress(),
    defaultPaymentAsset: await core.defaultPaymentAsset(),
    placementSigner: await core.placementSigner(),
    creatorFeeWallet: await core.creatorFeeWallet(),
    productionMode: await core.productionMode(),
    unitPrice: (await core.paymentAssetUnitPrice(USDT)).toString(),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
