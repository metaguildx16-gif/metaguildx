import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const CORE = "0x63125067659EEC130Cd7df8fe7fA4319511EEE6E";
  const CORRECT_USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const usdtPriceInPlatformUnits = 10n ** 17n;

  const coreAbi = [
    "function defaultPaymentAsset() view returns (address)",
    "function usdtAddress() view returns (address)",
    "function setDefaultPaymentAsset(address) external",
    "function setUsdtAddress(address) external",
    "function configurePaymentAsset(address,bool,bool,uint256) external",
    "function enabledPaymentAssets(address) view returns (bool)",
    "function paymentAssetUnitPrice(address) view returns (uint256)",
    "function owner() view returns (address)"
  ];

  const core = new ethers.Contract(CORE, coreAbi, deployer);

  const owner = await core.owner();
  console.log("Core owner:", owner);
  console.log("Deployer:", deployer.address);

  const currentDefault = await core.defaultPaymentAsset();
  const currentUsdt = await core.usdtAddress();
  const enabled = await core.enabledPaymentAssets(CORRECT_USDT);
  const unitPrice = await core.paymentAssetUnitPrice(CORRECT_USDT);

  console.log("Current defaultPaymentAsset:", currentDefault);
  console.log("Current usdtAddress:", currentUsdt);
  console.log("Correct USDT:", CORRECT_USDT);
  console.log("USDT enabled:", enabled);
  console.log("USDT unit price:", unitPrice.toString());

  if (
    currentDefault.toLowerCase() === CORRECT_USDT.toLowerCase() &&
    currentUsdt.toLowerCase() === CORRECT_USDT.toLowerCase() &&
    enabled &&
    unitPrice === usdtPriceInPlatformUnits
  ) {
    console.log("Already correct! No fix needed.");
    return;
  }

  let configureTxHash = "";
  let setUsdtTxHash = "";
  let setDefaultTxHash = "";

  if (!enabled || unitPrice !== usdtPriceInPlatformUnits) {
    console.log("\nConfiguring correct USDT payment asset...");
    const configureTx = await core.configurePaymentAsset(
      CORRECT_USDT,
      true,
      false,
      usdtPriceInPlatformUnits
    );
    await configureTx.wait();
    configureTxHash = configureTx.hash;
    console.log("configurePaymentAsset tx:", configureTxHash);
  }

  if (currentUsdt.toLowerCase() !== CORRECT_USDT.toLowerCase()) {
    console.log("\nSetting correct USDT as usdtAddress...");
    const setUsdtTx = await core.setUsdtAddress(CORRECT_USDT);
    await setUsdtTx.wait();
    setUsdtTxHash = setUsdtTx.hash;
    console.log("setUsdtAddress tx:", setUsdtTxHash);
  }

  if (currentDefault.toLowerCase() !== CORRECT_USDT.toLowerCase()) {
    console.log("\nSetting correct USDT as default payment asset...");
    const setDefaultTx = await core.setDefaultPaymentAsset(CORRECT_USDT);
    await setDefaultTx.wait();
    setDefaultTxHash = setDefaultTx.hash;
    console.log("setDefaultPaymentAsset tx:", setDefaultTxHash);
  }

  const newDefault = await core.defaultPaymentAsset();
  const newUsdt = await core.usdtAddress();
  const newEnabled = await core.enabledPaymentAssets(CORRECT_USDT);
  const newUnitPrice = await core.paymentAssetUnitPrice(CORRECT_USDT);

  console.log("\nVerified defaultPaymentAsset:", newDefault);
  console.log("Verified usdtAddress:", newUsdt);
  console.log("Verified enabled:", newEnabled);
  console.log("Verified unit price:", newUnitPrice.toString());

  if (
    newDefault.toLowerCase() === CORRECT_USDT.toLowerCase() &&
    newUsdt.toLowerCase() === CORRECT_USDT.toLowerCase()
  ) {
    console.log("\n✅ Payment asset fix complete!");
    console.log("Users can now register with correct USDT");
  }

  console.log("\nNote: User 2 failedDistribution=true");
  console.log("After Core receives the correct settlement flow, run adminRetryDistribution(2)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
