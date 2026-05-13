import { ethers } from "hardhat";

async function main() {
  const coreAddress = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";
  const stakingAddress = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

  const core = await ethers.getContractAt("MetaGuildXCore", coreAddress);
  const tx = await core.setStakingContract(stakingAddress);
  await tx.wait();

  console.log("staking contract linked");
  console.log(`core=${coreAddress}`);
  console.log(`staking=${await core.stakingContract()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
