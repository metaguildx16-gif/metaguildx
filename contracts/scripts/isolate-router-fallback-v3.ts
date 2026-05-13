import { ethers, network } from "hardhat";

async function main() {
  const CORE = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";
  const ROUTER = "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650";
  const USDT = "0x82e01223d51Eb87e16A03E24687EDF0F294da6f1";

  const [deployer] = await ethers.getSigners();
  const usdt = await ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    USDT,
    deployer
  );
  const core = await ethers.getContractAt(
    ["function routeCreatorFallbackIncome(uint256,uint256,string,address,address)", "function creatorFeeWallet() view returns (address)"],
    CORE
  );

  const snapshot = await network.provider.send("evm_snapshot");
  try {
    await network.provider.send("hardhat_setBalance", [ROUTER, "0x3635C9ADC5DEA00000"]);
    await network.provider.send("hardhat_impersonateAccount", [ROUTER]);
    const routerSigner = await ethers.getSigner(ROUTER);
    const creator = await core.creatorFeeWallet();

    await (await usdt.transfer(CORE, ethers.parseUnits("10", 18))).wait();
    console.log("core usdt:", (await usdt.balanceOf(CORE)).toString());

    for (const [label, amount] of [
      ["direct", 46n],
      ["level", 40n]
    ] as const) {
      try {
        await (
          await core.connect(routerSigner).routeCreatorFallbackIncome(1n, amount, label, USDT, creator)
        ).wait();
        console.log(`routeCreatorFallbackIncome ${label}: SUCCESS`);
      } catch (error: any) {
        console.log(`routeCreatorFallbackIncome ${label}: FAIL`, error?.message ?? String(error));
        console.log(
          `routeCreatorFallbackIncome ${label} data:`,
          error?.data ?? error?.info?.error?.data ?? error?.error?.data ?? null
        );
      }
    }
  } finally {
    await network.provider.send("evm_revert", [snapshot]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
