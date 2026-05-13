import { ethers } from "hardhat";

async function main() {
  const CORE = "0x03810a53e98f74AC17531569e84D0feA4C4Ec616";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const bal = await usdt.balanceOf(deployer.address);
  console.log("Deployer USDT:", ethers.formatUnits(bal, 18));

  try {
    const asset = await core.defaultPaymentAsset();
    const unitPrice = await (core as any).paymentAssetUnitPrice(asset);
    console.log("paymentAssetUnitPrice:", unitPrice.toString());
  } catch (e: any) {
    console.log("paymentAssetUnitPrice error:", e.message?.slice(0, 60));
  }

  try {
    const up = await (core as any).getUnitPrice(USDT);
    console.log("getUnitPrice:", up.toString());
  } catch {}

  console.log("\n=== Unit conversion options ===");
  const factors = [BigInt(1e14), BigInt(1e15), BigInt(1e16), BigInt(1e17), BigInt(1e18)];
  for (const f of factors) {
    console.log(`100 units × ${f} = ${ethers.formatUnits(100n * f, 18)} USDT`);
  }
}

main().catch(console.error);
