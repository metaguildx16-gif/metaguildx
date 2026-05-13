import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

type DeploymentRecord = {
  deployment?: {
    address?: string;
  };
  configuration?: {
    usdtToken?: string;
  };
};

function loadDeploymentUsdt(): string | null {
  const deploymentDir = path.resolve(__dirname, "../deployments");
  const candidates = ["opbnbTestnet.json", "testnet-fresh.json"];

  for (const file of candidates) {
    const fullPath = path.join(deploymentDir, file);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8")) as DeploymentRecord;
    if (parsed.deployment?.address?.toLowerCase() === process.env.SYSTEM_PROXY_ADDRESS?.toLowerCase()) {
      return parsed.configuration?.usdtToken ?? null;
    }
  }

  return null;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const coreAddress = process.env.SYSTEM_PROXY_ADDRESS!;
  const deploymentUsdt = loadDeploymentUsdt();
  const desiredUsdt = deploymentUsdt ?? process.env.USDT_ADDRESS ?? process.env.MOCK_USDT_ADDRESS;

  if (!desiredUsdt) {
    throw new Error("No desired USDT address found in deployments or env");
  }

  const core = await ethers.getContractAt("MetaGuildXCore", coreAddress);

  console.log("Fixing payment asset...");
  console.log("Core proxy          :", coreAddress);
  console.log("Signer              :", deployer.address);
  console.log("Deployment USDT      :", deploymentUsdt ?? "not found for current live core");
  console.log("Desired USDT         :", desiredUsdt);

  const currentDefault = await core.defaultPaymentAsset();
  const currentUsdt = await core.usdtAddress();
  const enabled = await core.enabledPaymentAssets(desiredUsdt);
  const unitPrice = await core.paymentAssetUnitPrice(desiredUsdt);

  console.log("Current default asset:", currentDefault);
  console.log("Current core USDT    :", currentUsdt);
  console.log("Desired enabled      :", enabled);
  console.log("Desired unit price   :", unitPrice.toString());

  if (
    currentDefault.toLowerCase() === desiredUsdt.toLowerCase() &&
    currentUsdt.toLowerCase() === desiredUsdt.toLowerCase()
  ) {
    console.log("Payment asset already matches desired USDT. No update needed ✅");
  } else {
    if (!enabled || unitPrice === 0n) {
      throw new Error("Desired USDT is not enabled/configured on core");
    }

    if (currentUsdt.toLowerCase() !== desiredUsdt.toLowerCase()) {
      const tx = await core.setUsdtAddress(desiredUsdt);
      await tx.wait();
      console.log("setUsdtAddress() applied ✅", tx.hash);
    }

    if (currentDefault.toLowerCase() !== desiredUsdt.toLowerCase()) {
      const tx = await core.setDefaultPaymentAsset(desiredUsdt);
      await tx.wait();
      console.log("setDefaultPaymentAsset() applied ✅", tx.hash);
    }
  }

  console.log("Verified defaultPaymentAsset:", await core.defaultPaymentAsset());
  console.log("Verified usdtAddress        :", await core.usdtAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
