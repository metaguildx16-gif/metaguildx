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

  const nextId = await core.nextUserId();
  console.log("nextUserId:", nextId.toString());
  if (Number(nextId) > 1) {
    console.log("Root already registered ✅");
    return;
  }

  let pkg1: bigint = 0n;
  for (const fn of ["getPackagePriceByLevel", "getPackagePrice", "packagePrices"]) {
    try {
      pkg1 = await (core as any)[fn](1);
      console.log(`pkg1 via ${fn}(1):`, pkg1.toString(), "units");
      break;
    } catch {}
  }
  if (pkg1 === 0n) {
    console.log("Could not get pkg1 price — check getter name");
    return;
  }

  const settlementAmt = pkg1 * BigInt(1e16);
  console.log("Settlement amount:", ethers.formatUnits(settlementAmt, 18), "USDT");

  const bal = await usdt.balanceOf(deployer.address);
  console.log("Deployer USDT balance:", ethers.formatUnits(bal, 18));
  if (bal < settlementAmt) {
    console.log("❌ Insufficient USDT balance");
    return;
  }

  const approveTx = await usdt.approve(CORE, settlementAmt * 10n);
  await approveTx.wait();
  console.log("USDT approved ✅");

  try {
    const tx = await (core as any).registerRoot(deployer.address, 1);
    const receipt = await tx.wait();
    console.log("Root registered ✅ Tx:", receipt.hash);
  } catch (e: any) {
    console.log("registerRoot failed:", e.message?.slice(0, 100));
    for (const fn of ["registerRootUser", "setRootUser", "initRoot"]) {
      try {
        const tx = await (core as any)[fn](deployer.address, 1);
        const receipt = await tx.wait();
        console.log(`${fn} success ✅ Tx:`, receipt.hash);
        break;
      } catch {}
    }
  }

  const newNextId = await core.nextUserId();
  console.log("nextUserId after:", newNextId.toString());
}

main().catch(console.error);
