import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

type DeployedAddresses = {
  Core: string;
  Income: string;
  Router: string;
  BinaryTree: string;
  Upgrade: string;
  CashbackPool: string;
  MGXStaking: string;
  MGXToken: string;
  TokenEngine: string;
  USDT: string;
  deployBlock: number;
};

const ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");
const FIXED_USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

function loadAddresses(): DeployedAddresses {
  return JSON.parse(fs.readFileSync(ADDRESSES_PATH, "utf8")) as DeployedAddresses;
}

async function main() {
  const addresses = loadAddresses();
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", addresses.Core, deployer);
  const usdt = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ],
    FIXED_USDT,
    deployer
  );

  const [
    productionMode,
    defaultPaymentAsset,
    routerAddress,
    incomeAddress,
    creatorWallet,
    paymentAssetEnabled,
    unitPrice,
    packagePrices,
    nextUserId,
    rootUserId,
    nonce,
    binaryTreeAddress,
    tokenEngineAddress,
    usdtDecimals,
    deployerBalance,
    deployerAllowance
  ] = await Promise.all([
    core.productionMode(),
    core.defaultPaymentAsset(),
    core.incomeRouterContract(),
    core.incomeEngineContract(),
    core.creatorFeeWallet(),
    core.enabledPaymentAssets(FIXED_USDT),
    core.paymentAssetUnitPrice(FIXED_USDT),
    core.getPackagePrices(),
    core.nextUserId(),
    core.rootUserId(),
    core.nonces(deployer.address),
    core.binaryTreeContract(),
    core.tokenEngineContract(),
    usdt.decimals(),
    usdt.balanceOf(deployer.address),
    usdt.allowance(deployer.address, addresses.Core)
  ]);

  const settlementAmount = packagePrices[0] * unitPrice;

  console.log("=== DEBUG REGISTRATION FLOW ===");
  console.log("deployer:", deployer.address);
  console.log("core:", addresses.Core);
  console.log("usdt:", FIXED_USDT);
  console.log("productionMode:", productionMode);
  console.log("defaultPaymentAsset:", defaultPaymentAsset);
  console.log("router address:", routerAddress);
  console.log("income address:", incomeAddress);
  console.log("binaryTree address:", binaryTreeAddress);
  console.log("tokenEngine address:", tokenEngineAddress);
  console.log("creator wallet:", creatorWallet);
  console.log("payment asset enabled:", paymentAssetEnabled);
  console.log("paymentAssetUnitPrice:", unitPrice.toString());
  console.log("nextUserId:", nextUserId.toString());
  console.log("rootUserId:", rootUserId.toString());
  console.log("nonce:", nonce.toString());
  console.log("package 1 raw:", packagePrices[0].toString());
  console.log("estimated settlement raw:", settlementAmount.toString());
  console.log("estimated settlement:", ethers.formatUnits(settlementAmount, usdtDecimals));
  console.log("deployer USDT balance:", ethers.formatUnits(deployerBalance, usdtDecimals));
  console.log("deployer allowance to core:", ethers.formatUnits(deployerAllowance, usdtDecimals));

  console.log("\n=== ROOT REGISTRATION TARGETS ===");
  console.log("registration type: root user");
  console.log("sponsorId: 0");
  console.log("direct payout target: creator fallback");
  console.log("level payout target: creator fallback");
  console.log("cashback target: creator wallet unless surrendered users exist");
  console.log("creator fee target:", creatorWallet);
  console.log("core receives settlement first, then distributes from its balance");

  const isEconomicallyReady =
    productionMode &&
    defaultPaymentAsset.toLowerCase() === FIXED_USDT.toLowerCase() &&
    paymentAssetEnabled &&
    deployerBalance >= settlementAmount &&
    deployerAllowance >= settlementAmount;

  console.log("\nEconomically ready:", isEconomicallyReady);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
