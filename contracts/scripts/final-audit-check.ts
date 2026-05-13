import { ethers } from "hardhat";

async function main() {
  const CORE = "0xbBD9e768298E7b636A7a762478F19671954FF0C0";
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";

  const core = await ethers.getContractAt("MetaGuildXCore", CORE);
  const usdt = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    USDT
  );

  const unitPrice = await (core as any).paymentAssetUnitPrice(USDT);
  const pkg1 = await core.getPackagePriceByLevel(1);
  const nextId = await core.nextUserId();
  const failed = await core.getFailedUserIds();
  const prodMode = await core.productionMode();
  const coreBal = await usdt.balanceOf(CORE);

  console.log("=== SYSTEM STATE ===");
  console.log("nextUserId  :", nextId.toString());
  console.log("productionMode:", prodMode);
  console.log("unitPrice   :", unitPrice.toString(), "(must be 1e17)");
  console.log("pkg1 units  :", pkg1.toString(), "(must be 100)");
  console.log("pkg1 USDT   :", ethers.formatUnits(pkg1 * unitPrice, 18));
  console.log("Core USDT   :", ethers.formatUnits(coreBal, 18));
  console.log("failedIds   :", failed.toString() || "none ✅");
  console.log("unitPrice OK:", unitPrice === 100000000000000000n ? "✅" : "❌");
}

main().catch(console.error);
