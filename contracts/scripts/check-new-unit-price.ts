import { ethers } from "hardhat";

async function main() {
  const CORE = "0xe987521C9FDE4CD09a62E0369BaE59663F9B7625";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const pkg1 = await core.getPackagePriceByLevel(1);
  const unitPrice = await (core as any).paymentAssetUnitPrice(USDT);
  const settlementAmt = pkg1 * unitPrice;
  const bal = await usdt.balanceOf(deployer.address);
  const allowance = await usdt.allowance(deployer.address, CORE);

  console.log("pkg1 units    :", pkg1.toString());
  console.log("unitPrice     :", unitPrice.toString());
  console.log("settlementAmt :", ethers.formatUnits(settlementAmt, 18), "USDT");
  console.log("deployer bal  :", ethers.formatUnits(bal, 18), "USDT");
  console.log("allowance     :", ethers.formatUnits(allowance, 18), "USDT");
  console.log("bal OK        :", bal >= settlementAmt ? "✅" : "❌");
  console.log("allowance OK  :", allowance >= settlementAmt ? "✅" : "❌");
}

main().catch(console.error);
