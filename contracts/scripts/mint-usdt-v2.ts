import { ethers } from "hardhat";

async function main() {
  const USDT = "0xF4975eB104932bDBcA491A9Cb985439eA03863e0";
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);

  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const balBefore = await usdt.balanceOf(deployer.address);
  console.log("Balance before:", ethers.formatUnits(balBefore, 18));

  const amount = ethers.parseUnits("1000", 18);

  try {
    const tx = await usdt.mint(deployer.address, amount);
    await tx.wait();
    console.log("mint(address, amount) ✅");
  } catch (e1: any) {
    console.log("mint(address, amount) failed:", e1.message?.slice(0, 60));
    try {
      const tx = await (usdt as any).mint(amount);
      await tx.wait();
      console.log("mint(amount) ✅");
    } catch (e2: any) {
      console.log("mint(amount) failed:", e2.message?.slice(0, 60));
      try {
        const tx = await (usdt as any).faucet();
        await tx.wait();
        console.log("faucet() ✅");
      } catch (e3: any) {
        console.log("faucet() failed:", e3.message?.slice(0, 60));
      }
    }
  }

  const balAfter = await usdt.balanceOf(deployer.address);
  console.log("Balance after:", ethers.formatUnits(balAfter, 18));
}

main().catch(console.error);
