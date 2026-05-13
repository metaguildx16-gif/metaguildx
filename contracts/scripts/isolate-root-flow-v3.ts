import { ethers, network } from "hardhat";

async function main() {
  const CORE = "0x1429859428C0aBc9C2C47C8Ee9FBaf82cFA0F20f";
  const TREE = "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0";
  const ROUTER = "0x7bc06c482DEAd17c0e297aFbC32f6e63d3846650";
  const USDT = "0x82e01223d51Eb87e16A03E24687EDF0F294da6f1";

  const [deployer] = await ethers.getSigners();
  const usdt = await ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    USDT,
    deployer
  );

  const tree = await ethers.getContractAt(["function assignRoot(uint256)"], TREE);
  const router = await ethers.getContractAt(
    ["function distributeJoinIncome(uint256,uint256,uint256,address)"],
    ROUTER
  );

  const snapshot = await network.provider.send("evm_snapshot");
  try {
    await network.provider.send("hardhat_setBalance", [CORE, "0x3635C9ADC5DEA00000"]);
    await network.provider.send("hardhat_impersonateAccount", [CORE]);
    const coreSigner = await ethers.getSigner(CORE);

    console.log("core usdt before:", (await usdt.balanceOf(CORE)).toString());
    await (await usdt.transfer(CORE, ethers.parseUnits("10", 18))).wait();
    console.log("core usdt after:", (await usdt.balanceOf(CORE)).toString());

    try {
      await (await tree.connect(coreSigner).assignRoot(1n)).wait();
      console.log("assignRoot: SUCCESS");
    } catch (error: any) {
      console.log("assignRoot: FAIL", error?.message ?? String(error));
      console.log("assignRoot data:", error?.data ?? error?.info?.error?.data ?? error?.error?.data ?? null);
    }

    try {
      await (await router.connect(coreSigner).distributeJoinIncome(1n, 0n, 100n, USDT)).wait();
      console.log("distributeJoinIncome: SUCCESS");
    } catch (error: any) {
      console.log("distributeJoinIncome: FAIL", error?.message ?? String(error));
      console.log(
        "distributeJoinIncome data:",
        error?.data ?? error?.info?.error?.data ?? error?.error?.data ?? null
      );
    }
  } finally {
    await network.provider.send("evm_revert", [snapshot]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
