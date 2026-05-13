import { ethers } from "hardhat";

async function main() {
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const USDT = process.env.USDT_ADDRESS!;

  const core = await ethers.getContractAt(
    [
      "function enabledPaymentAssets(address) view returns (bool)",
      "function paymentAssetUnitPrice(address) view returns (uint256)",
      "function nativePaymentAssets(address) view returns (bool)",
      "function defaultPaymentAsset() view returns (address)",
      "function getPackagePrices() view returns (uint256[] memory)",
    ],
    CORE
  );

  console.log("=== PAYMENT ASSET CHECK ===");

  const defAsset = await core.defaultPaymentAsset();
  console.log("defaultPaymentAsset:", defAsset);
  console.log("USDT address:", USDT);
  console.log("Match:", defAsset.toLowerCase() === USDT.toLowerCase());

  const isEnabled = await core.enabledPaymentAssets(USDT);
  console.log("\nenabledPaymentAssets(USDT):", isEnabled);

  const unitPrice = await core.paymentAssetUnitPrice(USDT);
  console.log("paymentAssetUnitPrice(USDT):", unitPrice.toString());

  const isNative = await core.nativePaymentAssets(USDT);
  console.log("isNativePaymentAsset:", isNative);

  const prices = await core.getPackagePrices();
  console.log("\nPackage prices:", prices.map((p: bigint) => p.toString()));

  const pkg1Price = prices[0];
  const settlement = pkg1Price * unitPrice;
  console.log("\nSettlement for Package 1:");
  console.log("  platformAmount:", pkg1Price.toString());
  console.log("  unitPrice:", unitPrice.toString());
  console.log("  settlement:", settlement.toString());
  console.log("  = ", ethers.formatUnits(settlement, 18), "USDT");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
