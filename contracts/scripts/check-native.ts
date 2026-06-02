import { ethers } from "hardhat";
async function main() {
  const core = await ethers.getContractAt("MetaGuildXCore", "0xF28019a3cC992619b652967B96B3813bA3830D91");
  const usdt = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const isNative = await core.nativePaymentAssets(usdt);
  const unitPrice = await core.paymentAssetUnitPrice(usdt);
  console.log("USDT isNative:", isNative);
  console.log("USDT unitPrice:", unitPrice.toString());
}
main().catch(console.error);
