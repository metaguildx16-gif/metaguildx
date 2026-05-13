import { ethers } from "hardhat";

async function main() {
  const CORE = "0xAC171ac2364A27Ff0BBF85fD339edF96832BB001";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const unitPrice = await (core as any).paymentAssetUnitPrice(USDT);
  const prodMode = await core.productionMode();
  const bal = await usdt.balanceOf(deployer.address);
  const allowance = await usdt.allowance(deployer.address, CORE);
  const pkg1 = await core.getPackagePriceByLevel(1);
  const settlement = pkg1 * unitPrice;

  console.log("productionMode:", prodMode);
  console.log("unitPrice     :", unitPrice.toString());
  console.log("pkg1 units    :", pkg1.toString());
  console.log("settlement    :", ethers.formatUnits(settlement, 18), "USDT");
  console.log("deployer bal  :", ethers.formatUnits(bal, 18));
  console.log("allowance     :", ethers.formatUnits(allowance, 18));
  console.log("unitPrice OK  :", unitPrice === 100000000000000000n ? "✅" : "❌ NOT SET!");
}

main().catch(console.error);
