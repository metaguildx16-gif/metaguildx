import { ethers } from "hardhat";

async function main() {
  const USDT = process.env.USDT_ADDRESS!;
  const CORE = process.env.SYSTEM_PROXY_ADDRESS!;
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  const freshUser = ethers.Wallet.createRandom().connect(provider);
  const freshAddr = freshUser.address;
  console.log("Fresh user:", freshAddr);

  await (
    await deployer.sendTransaction({
      to: freshAddr,
      value: ethers.parseEther("0.01"),
    })
  ).wait();

  const usdt = await ethers.getContractAt(
    [
      "function mint(address,uint256) external",
      "function approve(address,uint256) external returns (bool)",
      "function transfer(address,uint256) external returns (bool)",
      "function transferFrom(address,address,uint256) external returns (bool)",
      "function balanceOf(address) view returns (uint256)",
      "function allowance(address,address) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ],
    USDT,
    deployer
  );

  await (await usdt.mint(freshAddr, ethers.parseUnits("50", 18))).wait();
  console.log("Minted ✅");

  const bal = await usdt.balanceOf(freshAddr);
  console.log("Balance:", ethers.formatUnits(bal, 18));

  const decimals = await usdt.decimals();
  console.log("Decimals:", decimals.toString());

  const usdtUser = usdt.connect(freshUser);
  await (await usdtUser.approve(CORE, ethers.parseUnits("50", 18))).wait();
  console.log("Approved Core ✅");

  const allowance = await usdt.allowance(freshAddr, CORE);
  console.log("Allowance:", ethers.formatUnits(allowance, 18));

  const settlement = ethers.parseUnits("10", 18);
  console.log("Settlement needed:", ethers.formatUnits(settlement, 18));
  console.log("Has enough:", bal >= settlement);

  console.log("\n=== TEST transferFrom ===");
  try {
    await (await usdtUser.approve(deployer.address, settlement)).wait();

    const tx = await usdt.transferFrom(freshAddr, deployer.address, settlement);
    await tx.wait();
    console.log("transferFrom: SUCCESS ✅");

    const newBal = await usdt.balanceOf(freshAddr);
    console.log("New balance:", ethers.formatUnits(newBal, 18));
  } catch (err: any) {
    console.log("transferFrom FAILED:");
    console.log("reason:", err.reason ?? err.message);
  }

  const freshUser2 = ethers.Wallet.createRandom().connect(provider);
  const freshAddr2 = freshUser2.address;

  await (
    await deployer.sendTransaction({
      to: freshAddr2,
      value: ethers.parseEther("0.01"),
    })
  ).wait();
  await (await usdt.mint(freshAddr2, ethers.parseUnits("50", 18))).wait();
  await (await usdt.connect(freshUser2).approve(CORE, ethers.parseUnits("50", 18))).wait();

  console.log("\n=== SIMULATE Core transferFrom ===");
  console.log("from:", freshAddr2);
  console.log("to: Core =", CORE);
  console.log("amount:", ethers.formatUnits(settlement, 18));

  await (await usdt.connect(freshUser2).approve(deployer.address, settlement)).wait();

  try {
    const tx = await usdt.transferFrom(freshAddr2, CORE, settlement);
    const receipt = await tx.wait();
    console.log("Core transfer: SUCCESS ✅");
    console.log("Gas used:", receipt?.gasUsed.toString());
  } catch (err: any) {
    console.log("Core transfer FAILED:");
    console.log("reason:", err.reason ?? err.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
